import json
from copy import deepcopy
from unittest.mock import MagicMock

import pytest

import app as webapp
from init_station_permissions import initialize
from oidc_auth import OidcAuthenticator, OidcSettings
from test_admin_permissions import PermissionDatabase, client_for_admin

BASE = "/api/admin/station-permissions"
PAYLOAD = {"station_id": 28, "leader_staff_id": "leader-1", "scanner_staff_ids": ["scanner-1", "scanner-2"], "revision": 0}


class StationDatabase(PermissionDatabase):
    def __init__(self, permissions):
        super().__init__(permissions)
        self.stations = {28: {"id": 28, "station_name": "倒角", "station_code": "WS-DJ", "is_active": 1},
            37: {"id": 37, "station_name": "拉丝", "station_code": "WS-LS", "is_active": 1}}
        self.people = {identifier: {"id": identifier, "name": name, "position": "生产", "status": "1"}
            for identifier, name in [("leader-1", "线长甲"), ("scanner-1", "扫码甲"), ("scanner-2", "扫码乙")]}
        self.configs = {}
        self.snapshot = None
        self.fail_audit = False
        self.setting = {"enabled": 0, "report_access_mode": "exempt", "revision": 0}
        self.setting_snapshot = None

    def execute(self, query, params=None):
        super().execute(query, params)
        if query.startswith("UPDATE mo_station_access_setting_yx"):
            self.setting_snapshot = deepcopy(self.setting)
            self.setting = {"enabled": params[0], "report_access_mode": params[1], "revision": params[2]}
        if "INSERT INTO mo_station_staff_config_yx" in query:
            self.snapshot = deepcopy(self.configs)
            station, leader, scanners, revision, operator = params
            self.configs[station] = {"leader_staff_id": leader, "scanner_staff_ids": scanners,
                "revision": revision, "updated_by": operator, "update_time": "2026-09-08 12:00:00"}
        if "INSERT INTO mo_admin_audit_log_yx" in query and self.fail_audit:
            raise RuntimeError("audit unavailable")

    def fetchone(self):
        if "FROM mo_station_access_setting_yx" in self.query:
            return deepcopy(self.setting)
        params = self.calls[-1][1]
        if "FROM mo_workstation_yx WHERE id=" in self.query:
            return self.stations.get(params[0])
        if "FROM mo_station_staff_config_yx WHERE station_id=" in self.query:
            return deepcopy(self.configs.get(params[0]))
        return super().fetchone()

    def fetchall(self):
        if self.query.endswith("LIMIT 0"):
            return []
        params = self.calls[-1][1]
        if "LEFT JOIN mo_station_staff_config_yx" in self.query:
            empty = {"leader_staff_id": None, "scanner_staff_ids": None, "revision": None, "updated_by": None, "update_time": None}
            return [{**row, **deepcopy(self.configs.get(identifier, empty))} for identifier, row in self.stations.items()]
        if "FROM jml_staff" in self.query:
            return [deepcopy(person) for identifier, person in self.people.items()
                if (not params or identifier in params) and ("status='1'" not in self.query or person["status"] == "1")]
        return super().fetchall()

    def commit(self):
        super().commit()
        self.setting_snapshot = None
        self.snapshot = None

    def rollback(self):
        super().rollback()
        if self.setting_snapshot is not None:
            self.setting = self.setting_snapshot
            self.setting_snapshot = None
        if self.snapshot is not None:
            self.configs = self.snapshot
            self.snapshot = None


@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    webapp.app.config.update(TESTING=True, SECRET_KEY="test-only-flask-secret")
    monkeypatch.setattr(webapp, "_oidc_authenticator", OidcAuthenticator(OidcSettings.from_env({"OIDC_ENABLED": "0"})))
    monkeypatch.setattr(webapp, "_write_audit", lambda response: None)


def connect(monkeypatch, manage=True):
    permissions = ["station-permissions.view"] + (["station-permissions.manage"] if manage else [])
    database = StationDatabase(permissions)
    monkeypatch.setattr(webapp, "db", lambda: database)
    return database


def client_for_global_admin():
    client = client_for_admin()
    with client.session_transaction() as values:
        values["admin_username"] = "admin"
    return client


def test_save_reload_clear_and_no_reporting_changes(monkeypatch):
    database = connect(monkeypatch)
    client = client_for_admin()
    assert client.post(BASE + "/save", json=PAYLOAD).status_code == 200
    result = client.get(BASE).get_json()["data"]
    assert "enforcement_enabled" not in result
    row = result["stations"][0]
    assert row["leader"]["id"] == "leader-1"
    assert [person["id"] for person in row["scanners"]] == ["scanner-1", "scanner-2"]
    assert row["revision"] == 1 and row["configured"] is True
    assert result["stations"][1]["configured"] is False
    assert client.post(BASE + "/save", json={**PAYLOAD, "leader_staff_id": None, "scanner_staff_ids": [], "revision": 1}).status_code == 200
    row = client.get(BASE).get_json()["data"]["stations"][0]
    assert row["leader"] is None and row["scanners"] == [] and row["revision"] == 2
    assert 37 not in database.configs
    mutations = [sql for sql, _ in database.calls if sql.strip().startswith(("INSERT", "UPDATE", "DELETE", "CREATE", "ALTER"))]
    assert all("INSERT INTO mo_station_staff_config_yx" in sql or "INSERT INTO mo_admin_audit_log_yx" in sql for sql in mutations)


@pytest.mark.parametrize("method,path", [("GET", BASE), ("GET", BASE + "/staff"), ("POST", BASE + "/save")])
def test_anonymous_and_unauthorized_are_rejected(monkeypatch, method, path):
    database = connect(monkeypatch)
    assert webapp.app.test_client().open(path, method=method, json=PAYLOAD).status_code == 401
    database.permissions = []
    assert client_for_admin().open(path, method=method, json=PAYLOAD).status_code == 403


def test_view_permission_is_sufficient_for_reads_but_not_save(monkeypatch):
    database = connect(monkeypatch, manage=False)
    client = client_for_admin()
    assert client.get(BASE).status_code == 200
    assert client.get(BASE + "/staff").status_code == 200
    assert client.post(BASE + "/save", json=PAYLOAD).status_code == 403
    assert not database.configs


def test_staff_response_is_minimal_and_only_active(monkeypatch):
    database = connect(monkeypatch)
    database.people["scanner-2"]["status"] = "0"
    result = client_for_admin().get(BASE + "/staff").get_json()["data"]
    assert {row["id"] for row in result} == {"leader-1", "scanner-1"}
    sql = next(sql for sql, _ in database.calls if "FROM jml_staff" in sql)
    assert sql.startswith("SELECT id,name,position,status ")
    assert all(set(row) == {"id", "name", "position", "status"} for row in result)


@pytest.mark.parametrize("changes", [
    {"station_id": 999}, {"station_id": True}, {"station_id": "28"},
    {"leader_staff_id": "missing"}, {"leader_staff_id": 42}, {"leader_staff_id": ""},
    {"scanner_staff_ids": ["missing"]}, {"scanner_staff_ids": "scanner-1"}, {"scanner_staff_ids": [None]},
    {"revision": True}, {"revision": -1}, {"revision": 4},
    {"enforcement_enabled": True}, {"enabled": False},
])
def test_invalid_configuration_cannot_write(monkeypatch, changes):
    database = connect(monkeypatch)
    response = client_for_admin().post(BASE + "/save", json={**PAYLOAD, **changes})
    assert response.status_code == 400
    assert not database.configs


def test_non_object_request_rejected(monkeypatch):
    connect(monkeypatch)
    assert client_for_admin().post(BASE + "/save", json=[]).status_code == 400


def test_duplicate_ids_are_deduplicated_and_people_can_work_multiple_stations(monkeypatch):
    database = connect(monkeypatch)
    client = client_for_admin()
    assert client.post(BASE + "/save", json={**PAYLOAD, "scanner_staff_ids": ["scanner-1", "scanner-1"]}).status_code == 200
    assert json.loads(database.configs[28]["scanner_staff_ids"]) == ["scanner-1"]
    assert client.post(BASE + "/save", json={**PAYLOAD, "station_id": 37}).status_code == 200
    assert len(database.configs) == 2


def test_stale_revision_cannot_overwrite(monkeypatch):
    database = connect(monkeypatch)
    client = client_for_admin()
    assert client.post(BASE + "/save", json=PAYLOAD).status_code == 200
    before = deepcopy(database.configs)
    assert client.post(BASE + "/save", json={**PAYLOAD, "scanner_staff_ids": []}).status_code == 400
    assert database.configs == before


def test_disabled_or_deleted_staff_stays_visible_and_can_be_removed(monkeypatch):
    database = connect(monkeypatch)
    client = client_for_admin()
    client.post(BASE + "/save", json=PAYLOAD)
    database.people["scanner-1"]["status"] = "0"
    del database.people["scanner-2"]
    row = client.get(BASE).get_json()["data"]["stations"][0]
    assert [person["status"] for person in row["scanners"]] == ["0", "missing"]
    assert client.post(BASE + "/save", json={**PAYLOAD, "revision": 1}).status_code == 400
    assert client.post(BASE + "/save", json={**PAYLOAD, "revision": 1, "scanner_staff_ids": []}).status_code == 200


def test_audit_is_transactional_and_uses_authenticated_operator(monkeypatch):
    database = connect(monkeypatch)
    client = client_for_admin()
    assert client.post(BASE + "/save", json=PAYLOAD).status_code == 200
    entries = [params for sql, params in database.calls if "INSERT INTO mo_admin_audit_log_yx" in sql]
    assert len(entries) == 1 and entries[0][0] == "local-admin"
    assert json.loads(entries[0][5])["enforcement_enabled"] is False
    assert database.configs[28]["updated_by"] == "local-admin"
    before = deepcopy(database.configs)
    database.fail_audit = True
    assert client.post(BASE + "/save", json={**PAYLOAD, "revision": 1, "scanner_staff_ids": []}).status_code == 503
    assert database.configs == before


def test_initializer_upgrades_only_system_role_and_is_idempotent():
    database = MagicMock()
    cur = database.cursor.return_value
    permissions = ["accounts.manage", "station-permissions.view", "custom.keep"]
    role = {"id": 1, "permissions": json.dumps(permissions)}
    cur.fetchone.side_effect = lambda: deepcopy(role)

    def execute(sql, params=None):
        if sql.startswith("UPDATE mo_admin_role_yx"):
            role["permissions"] = params[0]
    cur.execute.side_effect = execute
    assert initialize(database)["enforcement_enabled"] is False
    initialize(database)
    assert set(json.loads(role["permissions"])) == set(permissions) | {"station-permissions.manage"}
    statements = [call.args[0] for call in cur.execute.call_args_list]
    assert sum(sql.startswith("UPDATE mo_admin_role_yx") for sql in statements) == 1
    assert all("station-permissions" in call.args[1][0] for call in cur.execute.call_args_list if call.args[0].startswith("UPDATE"))
    assert not any("mo_admin_account" in sql or "INSERT INTO jml_staff" in sql for sql in statements)


def test_reference_seed_skips_missing_ambiguous_and_existing_people_configs():
    database = MagicMock()
    cur = database.cursor.return_value
    cur.fetchone.return_value = {"id": 1, "permissions": '[]'}
    cur.fetchall.side_effect = [
        [{"id": 28, "station_name": "倒角"}, {"id": 30, "station_name": "修补"}, {"id": 37, "station_name": "拉丝"}],
        [{"id": "leader", "name": "李熙朋"}, {"id": "scan-1", "name": "吴起起"},
         {"id": "duplicate-1", "name": "王兵兵"}, {"id": "duplicate-2", "name": "王兵兵"}],
        [{"station_id": 37}],
    ]
    result = initialize(database, seed_reference=True)
    assert result["created"] == ["修补", "倒角"]
    assert result["skipped_existing"] == ["拉丝"]
    assert result["unmatched_staff"] == ["杨玲", "王兵兵"]
    inserts = [call.args[1] for call in cur.execute.call_args_list if "INSERT INTO mo_station_staff_config_yx" in call.args[0]]
    assert inserts[0][1] == "leader" and json.loads(inserts[0][2]) == []
    assert json.loads(inserts[1][2]) == ["scan-1"]


def test_initializer_checks_rbac_before_creating_table():
    database = MagicMock()
    database.cursor.return_value.fetchone.return_value = None
    with pytest.raises(ValueError, match="init_admin_permissions"):
        initialize(database)
    assert not any("CREATE" in call.args[0] for call in database.cursor.return_value.execute.call_args_list)
