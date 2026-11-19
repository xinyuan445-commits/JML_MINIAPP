import json
from datetime import datetime, timedelta
from copy import deepcopy
from unittest.mock import Mock

import pytest
from flask import Flask, jsonify, request
from routes import mo
from routes.mo_station_v2 import ACTIONS, mo_station_v2_bp
from services import mo_station_access as security


class Database:
    def __init__(self):
        self.enabled = True
        self.people = [{"id": "staff-1", "name": "员工甲", "status": "1", "is_reset": "0", "openid": None, "unionid": None,
            "userid": "account-one", "mobile": "13800000000", "pwd": "unused"}]
        self.stations = [{"id": 1, "station_name": "工站甲"}, {"id": 2, "station_name": "工站乙"}, {"id": 3, "station_name": "未试用工站"}]
        self.configs = [{"station_id": 1, "leader_staff_id": "staff-1", "scanner_staff_ids": '[]'},
            {"station_id": 2, "leader_staff_id": "other", "scanner_staff_ids": '[]'}]
        self.exemptions = []
        self.now = datetime(2026, 10, 13, 4)
        self.proxies = []
        self.executions = {10: {"id": 10, "mo_code": "ORDER", "sort_seq": 1, "route_id": 1, "seq": 1, "station_id": 1, "status": "done"},
            20: {"id": 20, "mo_code": "ORDER", "sort_seq": 2, "route_id": 1, "seq": 1, "station_id": 2, "status": "done"}}
        self.tasks = {"mo_receive_work_yx": {30: {"execution_id": 10}}, "mo_rework_yx": {40: {"source_execution_id": 10}}}
        self.handover = {"id": 50, "route_id": 1, "to_seq": 1}
        self.binding = None
        self.bound = {"route_id": 1}
        self.route_stations = [1, 2]
        self.calls, self.writes, self.persisted = [], [], []
        self.snapshot = None
        self.query = ""
        self.params = None
        self.rollbacks = 0

    def cursor(self, **_kwargs):
        return self

    def execute(self, query, params=None):
        self.query, self.params = " ".join(query.split()), params
        self.calls.append((self.query, params))
        if self.query.startswith(("TEST WRITE", "INSERT INTO mo_station_receive_binding_yx")):
            self.writes.append((self.query, params))

    def fetchall(self):
        q, p = self.query, self.params
        if "FROM jml_staff" in q:
            if "WHERE BINARY id=" in q:
                return deepcopy([row for row in self.people if row["id"] == p[0]])
            return deepcopy([row for row in self.people if row["openid"] == p[0] or p[1] and row["unionid"] == p[1]])
        if "FROM mo_workstation_yx" in q:
            return deepcopy(self.stations)
        if "FROM mo_station_staff_config_yx" in q:
            return deepcopy(self.configs)
        if "FROM mo_station_staff_proxy_yx" in q:
            return [{"station_id": row["station_id"]} for row in self.proxies
                if row["staff_id"] == p[0] and row["starts_at"] <= self.now < row["ends_at"]]
        if "JOIN mo_step_station_yx" in q:
            return [{"station_id": station} for station in self.route_stations]
        if "FROM mo_execution_yx" in q and "status='processing'" in q:
            return [deepcopy(row) for row in self.executions.values() if row["status"] == "processing" and (row["mo_code"], row["sort_seq"]) == p]
        row = self.fetchone()
        return [row] if row else []

    def fetchone(self):
        q, p = self.query, self.params
        if "FROM mo_station_access_setting_yx" in q:
            return {"enabled": int(self.enabled), "report_access_mode": "exempt", "revision": 0}
        if "FROM jml_staff" in q:
            rows = self.fetchall()
            return rows[0] if rows else None
        if "FROM mo_station_staff_exemption_yx" in q:
            return {"staff_ids": json.dumps(self.exemptions)}
        if "FROM mo_execution_yx WHERE id=" in q:
            return deepcopy(self.executions.get(p[0]))
        if "FROM mo_wo_route_yx" in q:
            return deepcopy(self.bound)
        if "FROM mo_wo_state_yx" in q:
            return None
        if "FROM mo_handover_yx" in q:
            return deepcopy(self.handover)
        if "FROM mo_station_receive_binding_yx" in q:
            return deepcopy(self.binding)
        for table, rows in self.tasks.items():
            if f"FROM {table} WHERE id=" in q:
                return deepcopy(rows.get(p[0]))
        raise AssertionError(q)

    def start_transaction(self):
        self.snapshot = deepcopy(self.writes)

    def commit(self):
        self.persisted = deepcopy(self.writes)

    def rollback(self):
        self.rollbacks += 1
        if self.snapshot is not None:
            self.writes = deepcopy(self.snapshot)

    def close(self):
        pass


@pytest.fixture
def setup(monkeypatch):
    database = Database()
    monkeypatch.setattr(security, "database", lambda: database)
    response = Mock(status_code=200)
    response.json.return_value = {"code": "1", "data": {**database.people[0], "isFactory": "1", "staffAreaList": []}}
    monkeypatch.setattr(security.requests, "get", Mock(return_value=response))
    app = Flask(__name__)
    app.register_blueprint(mo.mo_bp, url_prefix="/api/mo")
    app.register_blueprint(mo_station_v2_bp, url_prefix="/api/mo-v2")
    app.config["TESTING"] = True
    return database, app.test_client(), response


def headers(database):
    return {"staff-id": database.people[0]["id"]}


def fake_writer(monkeypatch, action="complete"):
    def write():
        conn = mo.get_db2()
        conn.cursor().execute("TEST WRITE", request.get_json())
        conn.commit()
        conn.close()
        return jsonify({"code": 0, "data": {"handover_id": 50}})
    monkeypatch.setattr(mo, ACTIONS[action], write)


def test_admin_disabled_blocks_new_writes_without_authenticating(setup, monkeypatch):
    db, client, _ = setup
    db.enabled = False
    monkeypatch.setattr(security, "staff_from_cache", Mock(side_effect=AssertionError("must not read staff")))
    for path in ("complete", "rework/start"):
        assert client.post("/api/mo-v2/" + path, json={}).status_code == 409
    assert client.get("/api/mo-v2/context").status_code == 409
    assert all('mo_station_access_setting_yx' in sql for sql, _ in db.calls)


def test_old_validation_unchanged_when_disabled_and_cannot_bypass_when_enabled(setup):
    db, client, _ = setup
    db.enabled = False
    response = client.post("/api/mo/start", json={})
    assert response.status_code == 200
    assert response.json == {"code": 1, "msg": "参数不完整"}
    db.enabled = True
    assert client.post("/api/mo/start", json={"user_id": "missing"}).status_code == 403


def test_cached_employee_needs_no_extra_login_or_wechat_binding(setup):
    db, client, _ = setup
    response = client.get("/api/mo-v2/context?exec_id=10", headers=headers(db))
    assert response.status_code == 200
    assert response.json["data"]["can_operate"] is True
    assert response.json["data"]["staff_id"] == "staff-1"
    assert all("pwd" not in sql and "openid" not in sql for sql, _ in db.calls)
    security.requests.get.assert_not_called()


@pytest.mark.parametrize("identity,status", [(None, 401), ("missing", 403), ("account-one", 403)])
def test_missing_or_unknown_employee_is_rejected(setup, identity, status):
    db, client, _ = setup
    response = client.get("/api/mo-v2/context?exec_id=10", headers={"staff-id": identity} if identity else {})
    assert response.status_code == status


def test_employee_disable_and_binding_change_apply_immediately(setup):
    db, client, _ = setup
    db.people[0]["status"] = "0"
    assert client.get("/api/mo-v2/context?exec_id=10", headers=headers(db)).status_code == 403
    db.people[0]["status"] = "1"
    db.configs = []
    assert client.get("/api/mo-v2/context?exec_id=10", headers=headers(db)).json["data"]["can_operate"] is False


@pytest.mark.parametrize("start_delta,end_delta,allowed", [(-1, 1, True), (0, 1, True), (1, 2, False), (-1, 0, False)])
def test_station_proxy_period_is_inclusive_start_exclusive_end(setup, start_delta, end_delta, allowed):
    db, client, _ = setup
    db.proxies = [{"station_id": 2, "staff_id": "staff-1",
        "starts_at": db.now + timedelta(seconds=start_delta), "ends_at": db.now + timedelta(seconds=end_delta)}]
    assert client.get("/api/mo-v2/context?exec_id=20", headers=headers(db)).json["data"]["can_operate"] is allowed
    # The permanent leader grant on station 1 is never replaced by a proxy grant.
    assert client.get("/api/mo-v2/context?exec_id=10", headers=headers(db)).json["data"]["can_operate"] is True


@pytest.mark.parametrize("role", ["leader", "scanner", "exempt", "none"])
def test_proxy_expiry_does_not_revoke_other_permission_sources(setup, role):
    db, client, _ = setup
    db.configs[0]["leader_staff_id"] = "other"
    if role == "leader": db.configs[0]["leader_staff_id"] = "staff-1"
    if role == "scanner": db.configs[0]["scanner_staff_ids"] = '["staff-1"]'
    if role == "exempt": db.exemptions = ["staff-1"]
    db.proxies = [{"station_id": 1, "staff_id": "staff-1", "starts_at": db.now - timedelta(days=1), "ends_at": db.now}]
    assert client.get("/api/mo-v2/context?exec_id=10", headers=headers(db)).json["data"]["can_operate"] is (role != "none")


@pytest.mark.parametrize("action", ["complete", "rework/start"])
@pytest.mark.parametrize("legacy", [False, True])
def test_proxy_cannot_submit_after_expiry_on_new_or_legacy_api(setup, monkeypatch, action, legacy):
    db, client, _ = setup
    db.configs[0]["leader_staff_id"] = "other"
    db.proxies = [{"station_id": 1, "staff_id": "staff-1", "starts_at": db.now - timedelta(days=1), "ends_at": db.now}]
    handler = Mock(side_effect=AssertionError("expired proxy must not write"))
    monkeypatch.setattr(mo, ACTIONS[action], handler)
    path = "/api/mo/" if legacy else "/api/mo-v2/"
    response = client.post(path + action, json={"exec_id": 10, "user_id": "staff-1"}, headers=headers(db))
    assert response.status_code == 403
    handler.assert_not_called()


@pytest.mark.parametrize("legacy", [False, True])
def test_active_proxy_can_submit_without_permanent_grant(setup, monkeypatch, legacy):
    db, client, _ = setup
    db.configs[0]["leader_staff_id"] = "other"
    db.proxies = [{"station_id": 1, "staff_id": "staff-1", "starts_at": db.now,
        "ends_at": db.now + timedelta(hours=1)}]
    fake_writer(monkeypatch)
    path = "/api/mo/" if legacy else "/api/mo-v2/"
    response = client.post(path + "complete", json={"exec_id": 10, "user_id": "staff-1"}, headers=headers(db))
    assert response.status_code == 200 and response.json["code"] == 0
    assert db.persisted[0][1]["station_id"] == 1
    assert db.configs[0]["leader_staff_id"] == "other"


def test_proxy_has_no_inactive_station_or_inactive_employee_access(setup):
    db, client, _ = setup
    db.configs = []
    db.proxies = [{"station_id": 2, "staff_id": "staff-1", "starts_at": db.now, "ends_at": db.now + timedelta(hours=1)}]
    db.stations = [row for row in db.stations if row["id"] != 2]
    assert client.get("/api/mo-v2/context?exec_id=20", headers=headers(db)).json["data"]["can_operate"] is False
    db.people[0]["status"] = "0"
    assert client.get("/api/mo-v2/context?exec_id=20", headers=headers(db)).status_code == 403


def test_exempt_employee_without_wechat_binding_can_access_other_station(setup):
    db, client, _ = setup
    db.exemptions = ["staff-1"]
    response = client.get("/api/mo-v2/context?exec_id=20", headers=headers(db))
    assert response.json["data"]["can_operate"] is True
    assert response.json["data"]["is_exempt"] is True


@pytest.mark.parametrize("path", ["auth", "account-login"])
def test_extra_login_endpoints_removed(setup, path):
    db, client, _ = setup
    assert client.post("/api/mo-v2/" + path, json={}).status_code == 404
    assert not db.calls


@pytest.mark.parametrize("role", ["leader", "scanner", "exempt", "none"])
def test_permissions_follow_staff_ids_not_names_or_admin_labels(setup, role):
    db, client, _ = setup
    db.configs[0]["leader_staff_id"] = "other"
    if role == "leader": db.configs[0]["leader_staff_id"] = "staff-1"
    if role == "scanner": db.configs[0]["scanner_staff_ids"] = '["staff-1"]'
    if role == "exempt": db.exemptions = ["staff-1"]
    response = client.get("/api/mo-v2/context?exec_id=10", headers={**headers(db), "X-Role": "admin"})
    assert response.status_code == 200
    assert response.json["data"]["can_operate"] is (role != "none")


def test_off_policy_ignores_permissions_and_on_policy_denies_unconfigured_stations(setup):
    db, _client, _ = setup
    db.enabled = False
    assert security.policy(db, "staff-1")["allowed"] == {1, 2, 3}
    assert not any("staff_config" in q or "exemption" in q for q, _ in db.calls)
    db.enabled = True
    assert security.policy(db, "staff-1")["allowed"] == {1}


def test_missing_configuration_has_no_operating_rights(setup):
    db, client, _ = setup
    db.configs = []
    assert client.get("/api/mo-v2/context?exec_id=10", headers=headers(db)).json['data']['can_operate'] is False


def test_unassigned_historical_execution_is_not_guessed(setup):
    db, client, _ = setup
    db.executions[10]["station_id"] = None
    assert client.get("/api/mo-v2/context?exec_id=10", headers=headers(db)).status_code == 409


def test_unauthorized_submission_never_calls_existing_business_handler(setup, monkeypatch):
    db, client, _ = setup
    handler = Mock(side_effect=AssertionError("must not submit"))
    monkeypatch.setattr(mo, "complete_work", handler)
    response = client.post("/api/mo-v2/complete", json={"exec_id": 20, "station_id": 1}, headers=headers(db))
    assert response.status_code == 403
    handler.assert_not_called()
    assert not db.persisted


def test_valid_submission_uses_cached_operator_and_one_transaction(setup, monkeypatch):
    db, client, _ = setup
    fake_writer(monkeypatch)
    response = client.post("/api/mo-v2/complete", json={"exec_id": 10}, headers=headers(db))
    assert response.status_code == 200 and response.json["code"] == 0
    assert len(db.persisted) == 1
    assert db.persisted[0][1] == {"exec_id": 10, "station_id": 1, "user_id": "staff-1"}


def test_inconsistent_header_and_body_operator_rejected(setup, monkeypatch):
    db, client, _ = setup
    fake_writer(monkeypatch)
    assert client.post("/api/mo-v2/complete", json={"exec_id": 10, "user_id": "other"}, headers=headers(db)).status_code == 403
    assert not db.persisted


@pytest.mark.parametrize("kind", ["return-error", "throw", "rollback"])
def test_business_failure_rolls_back_all_writes(setup, monkeypatch, kind):
    db, client, _ = setup
    def write():
        conn = mo.get_db2()
        conn.cursor().execute("TEST WRITE", "uncommitted")
        if kind == "throw": raise RuntimeError("password=private")
        if kind == "rollback": conn.rollback()
        return jsonify({"code": 1, "msg": "数量不符"})
    monkeypatch.setattr(mo, "complete_work", write)
    response = client.post("/api/mo-v2/complete", json={"exec_id": 10}, headers=headers(db))
    assert response.json["code"] != 0 and "private" not in response.text
    assert not db.persisted and not db.writes


def test_combined_checks_all_task_relationships_before_mutating(setup, monkeypatch):
    db, client, _ = setup
    db.tasks["mo_rework_yx"][40]["source_execution_id"] = 20
    fake_writer(monkeypatch, "complete-combined")
    payload = {"exec_id": 10, "normal_type": "completion", "normal": {}, "rework": {"rework_id": 40}}
    assert client.post("/api/mo-v2/complete-combined", json=payload, headers=headers(db)).status_code == 409
    assert not db.persisted


@pytest.mark.parametrize("action,payload", [
    ("receive-work/start", {"exec_id": 10}), ("receive-work/complete", {"receive_id": 30}),
    ("rework/start", {"exec_id": 10}), ("rework/complete", {"rework_id": 40}),
    ("complete-combined", {"exec_id": 10, "normal_type": "receive", "normal": {"receive_id": 30}, "rework": {"rework_id": 40}}),
])
def test_all_task_writes_resolve_the_actual_execution(setup, monkeypatch, action, payload):
    db, client, _ = setup
    fake_writer(monkeypatch, action)
    assert client.post("/api/mo-v2/" + action, json=payload, headers=headers(db)).json["code"] == 0
    assert db.persisted[0][1]["station_id"] == 1


@pytest.mark.parametrize("action", ["receive-first", "receive"])
def test_receiving_remembers_target_station_in_same_commit(setup, monkeypatch, action):
    db, client, _ = setup
    fake_writer(monkeypatch, action)
    payload = {"mo_code": "ORDER", "sort_seq": 1, "handover_id": 50, "station_id": 1}
    assert client.post("/api/mo-v2/" + action, json=payload, headers=headers(db)).json["code"] == 0
    assert len(db.persisted) == 2
    assert db.persisted[1][1] == (50, 1, "staff-1")


def test_start_cannot_change_received_station_or_use_extra_exec_id_to_bypass_route(setup, monkeypatch):
    db, client, _ = setup
    db.binding = {"station_id": 2}
    fake_writer(monkeypatch, "start")
    payload = {"mo_code": "ORDER", "sort_seq": 1, "station_id": 1, "exec_id": 10}
    assert client.post("/api/mo-v2/start", json=payload, headers=headers(db)).status_code == 403
    assert not db.persisted


def test_no_bound_route_uses_erp_category_not_caller_category(setup):
    db, _client, response = setup
    db.bound = None
    response.json.return_value = {"code": 0, "data": {"header": {"CategoryName": "真实类别"}}}
    resolver = Mock(return_value=1)
    body = {"mo_code": "ORDER", "sort_seq": 1, "category_name": "伪造类别"}
    security.route_target(db, body, resolver)
    assert resolver.call_args.args[-1] == "真实类别"
    assert body["category_name"] == "真实类别"


def test_original_business_validation_is_reused(setup):
    db, client, _ = setup
    response = client.post("/api/mo-v2/complete", json={"exec_id": 10, "mo_code": "ORDER", "sort_seq": 1, "qty_a": 1, "qty_c": 1}, headers=headers(db))
    assert response.json["code"] == 1
    assert "照片" in response.json["msg"]
    assert not db.persisted


def test_settings_public_only_returns_switch_and_no_cache(setup):
    db, client, _ = setup
    for enabled in (True, False, True):
        db.enabled = enabled
        result = client.get('/api/mo-v2/settings')
        assert result.status_code == 200
        assert result.json == {'code': 0, 'data': {
            'enabled': enabled, 'report_access_mode': 'exempt', 'revision': 0}}
        assert result.headers['Cache-Control'] == 'no-store'


def test_removed_trial_environment_cannot_override_admin_switch_or_filter_staff(setup, monkeypatch):
    db, client, _ = setup
    monkeypatch.setenv('MO_STATION_V2_ENABLED', '0')
    monkeypatch.setenv('MO_STATION_TRIAL_STAFF_IDS', 'nobody')
    monkeypatch.setenv('MO_STATION_PILOT_STATION_IDS', 'invalid')
    assert client.get('/api/mo-v2/context?exec_id=10', headers=headers(db)).status_code == 200
    db.enabled = False
    monkeypatch.setenv('MO_STATION_V2_ENABLED', '1')
    assert client.get('/api/mo-v2/context?exec_id=10', headers=headers(db)).status_code == 409


@pytest.mark.parametrize('action', list(ACTIONS))
def test_every_old_operating_endpoint_rejects_unknown_employee_when_enabled(setup, monkeypatch, action):
    db, client, _ = setup
    fake_writer(monkeypatch, action)
    response = client.post('/api/mo/' + action, json={'exec_id': 10, 'user_id': 'missing'}, headers={'staff-id': 'missing'})
    assert response.status_code == 403
    assert not db.persisted


def test_disabled_old_write_retains_payload_and_no_new_identity_or_station_queries(setup, monkeypatch):
    db, client, _ = setup
    db.enabled = False
    fake_writer(monkeypatch)
    original = {'exec_id': 10, 'user_id': 'old-account', 'qty_a': 3}
    assert client.post('/api/mo/complete', json=original).json['code'] == 0
    assert db.persisted[0][1] == original
    assert not any('jml_staff' in q or 'staff_config' in q for q, _ in db.calls)


def test_setting_failure_does_not_fall_back_to_unprotected_write(setup, monkeypatch):
    db, client, _ = setup
    monkeypatch.setattr(security, 'setting', Mock(side_effect=RuntimeError('secret=hidden')))
    fake_writer(monkeypatch)
    result = client.post('/api/mo/complete', json={'exec_id': 10})
    assert result.status_code == 503 and 'hidden' not in result.text
    assert not db.persisted


def test_exempt_employee_can_operate_unconfigured_active_station(setup):
    db, client, _ = setup
    db.executions[10]['station_id'] = 3
    db.exemptions = ['staff-1']
    assert client.get('/api/mo-v2/context?exec_id=10', headers=headers(db)).json['data']['can_operate'] is True


def test_legacy_request_uses_existing_user_id_without_new_login(setup, monkeypatch):
    db, client, _ = setup
    fake_writer(monkeypatch)
    result = client.post("/api/mo/complete", json={"exec_id": 10, "user_id": "staff-1"})
    assert result.json["code"] == 0
    assert db.persisted[0][1]["user_id"] == "staff-1"


@pytest.mark.parametrize("action,payload", [
    ("start", {"mo_code": "ORDER", "sort_seq": 1, "station_id": 1}),
    ("rework/start", {"exec_id": 10}),
])
@pytest.mark.parametrize("allowed", [True, False])
def test_selected_workers_do_not_grant_or_remove_operator_permission(setup, monkeypatch, action, payload, allowed):
    db, client, _ = setup
    fake_writer(monkeypatch, action)
    if not allowed:
        db.configs[0]["leader_staff_id"] = "other"
    workers = ["different-ding-worker"] if allowed else ["staff-1"]
    result = client.post("/api/mo-v2/" + action,
        json={**payload, "worker_ids": workers, "temp_worker_count": 2}, headers=headers(db))
    assert result.status_code == (200 if allowed else 403)
    if allowed:
        assert db.persisted[0][1]["worker_ids"] == workers
        assert db.persisted[0][1]["temp_worker_count"] == 2
        assert db.persisted[0][1]["user_id"] == "staff-1"
    else:
        assert not db.persisted
