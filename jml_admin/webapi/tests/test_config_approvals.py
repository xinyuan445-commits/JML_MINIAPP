import json

import pytest
from flask import Flask, g

from config_approvals import _route_steps_changed, _validate_payload, config_approval_blueprint


def test_approval_category_names_include_before_after_without_changing_payload():
    from copy import deepcopy
    from unittest.mock import MagicMock
    from config_approvals import _add_product_category_names
    rows = [{'module_type': 'route', 'before_data': {'product_codes': ['old']},
             'after_data': {'product_codes': ['12', 'missing']}},
            {'module_type': 'process', 'before_data': None, 'after_data': {}}]
    original = deepcopy(rows)
    cur = MagicMock()
    cur.fetchall.return_value = [{'code': '12', 'name': '实木单贴肤感板'}, {'code': 'old', 'name': '旧类别'}]
    _add_product_category_names(cur, rows)
    assert cur.execute.call_args.args[1] == ('12', 'missing', 'old')
    assert rows[0]['product_category_names'] == {'12': '实木单贴肤感板', 'old': '旧类别'}
    assert rows[0]['before_data'] == original[0]['before_data']
    assert rows[0]['after_data'] == original[0]['after_data']
    assert rows[1] == original[1]
    cur.reset_mock()
    _add_product_category_names(cur, [rows[1]])
    cur.execute.assert_not_called()


class ApprovalDatabase:
    def __init__(self):
        self.approvals = {}
        self.processes = []
        self.lastrowid = 0
        self.result = None
        self.results = []
        self.commits = 0
        self.rollbacks = 0

    def cursor(self, dictionary=False):
        return self

    def execute(self, query, params=None):
        compact = " ".join(query.split())
        if "INSERT INTO mo_config_approval_yx" in compact:
            self.lastrowid += 1
            row_id = self.lastrowid
            self.approvals[row_id] = {
                "id": row_id,
                "request_no": None,
                "module_type": params[0],
                "action_type": params[1],
                "target_key": params[2],
                "pending_key": params[3],
                "before_data": params[4],
                "after_data": params[5],
                "status": "pending",
                "revision": 1,
                "applicant_account_id": params[6],
                "applicant_name": params[7],
            }
        elif compact.startswith("UPDATE mo_config_approval_yx SET request_no"):
            self.approvals[params[1]]["request_no"] = params[0]
        elif compact.startswith("SELECT applicant_account_id,MAX(applicant_name)"):
            applicants = {}
            for row in self.matching_rows(compact, params):
                account_id = row["applicant_account_id"]
                applicants[account_id] = max(applicants.get(account_id, ""), row["applicant_name"])
            self.results = [
                {"applicant_account_id": account_id, "applicant_name": name}
                for account_id, name in sorted(applicants.items(), key=lambda item: (item[1], item[0]))
            ]
        elif compact.startswith("SELECT COUNT(*) AS total FROM mo_config_approval_yx"):
            self.result = {"total": len(self.matching_rows(compact, params))}
        elif compact.startswith("SELECT * FROM mo_config_approval_yx") and "LIMIT" in compact:
            rows = sorted(self.matching_rows(compact, params[:-2]), key=lambda row: row["id"], reverse=True)
            limit, offset = params[-2:]
            self.results = [dict(row) for row in rows[offset:offset + limit]]
        elif compact.startswith("SELECT * FROM mo_config_approval_yx"):
            self.result = self.approvals.get(params[0])
        elif compact.startswith("UPDATE mo_config_approval_yx SET target_key"):
            row = self.approvals[params[5]]
            row.update({
                "target_key": params[0],
                "pending_key": params[1],
                "before_data": params[2],
                "after_data": params[3],
                "revision": params[4],
                "status": "pending",
            })
        elif "INSERT INTO mo_process_yx" in compact:
            self.lastrowid += 1
            self.processes.append({
                "id": self.lastrowid,
                "process_code": params[0],
                "process_name": params[1],
                "description": params[2],
                "sort": params[3],
                "is_active": 1,
            })
        elif compact.startswith("UPDATE mo_config_approval_yx SET status"):
            row = self.approvals[params[4]]
            row.update({
                "status": params[0],
                "pending_key": None,
                "reviewer_account_id": params[1],
                "reviewer_name": params[2],
                "review_comment": params[3],
            })
        elif "INSERT INTO mo_admin_audit_log_yx" in compact:
            pass
        else:
            raise AssertionError(compact)

    def fetchone(self):
        return self.result

    def fetchall(self):
        return self.results

    def matching_rows(self, query, params):
        rows = list(self.approvals.values())
        index = 0
        if "module_type IN (" in query:
            count = query.split("module_type IN (")[1].split(")")[0].count("%s")
            modules = params[:count]
            rows = [row for row in rows if row["module_type"] in modules]
            index += count
        if "status='pending'" in query:
            rows = [row for row in rows if row["status"] == "pending"]
        if "status<>'pending'" in query:
            rows = [row for row in rows if row["status"] != "pending"]
        if "module_type=%s" in query:
            rows = [row for row in rows if row["module_type"] == params[index]]
            index += 1
        if "applicant_account_id=%s" in query:
            rows = [row for row in rows if row["applicant_account_id"] == params[index]]
        return rows

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        pass


@pytest.fixture()
def approval_client():
    database = ApprovalDatabase()
    app = Flask(__name__)
    app.config.update(TESTING=True, ACCOUNT_ID=1, PERMISSIONS={"process.add"})

    @app.before_request
    def load_actor():
        account_id = app.config["ACCOUNT_ID"]
        g.admin_account = {"id": account_id}
        g.admin_display_name = f"用户{account_id}"
        g.audit_username = f"user-{account_id}"
        g.admin_permissions = set(app.config["PERMISSIONS"])

    app.register_blueprint(config_approval_blueprint(
        lambda: database,
        lambda _cur, _route_id: 0,
        lambda _cur, _route_id, _group: None,
        lambda name, version: f"{name} V{version}",
    ))
    return app, app.test_client(), database


def submit_process(client):
    return client.post("/api/admin/config-approvals/submit", json={
        "module_type": "process",
        "action_type": "create",
        "payload": {
            "process_code": "P-01",
            "process_name": "下料",
            "description": "",
            "sort": 10,
        },
    })


def test_route_version_requires_changed_steps():
    with pytest.raises(ValueError, match="请至少配置一道工序"):
        _validate_payload("route", "version", {"id": 79})

    before = [
        {"seq": 1, "process_id": 35, "station_id": 38},
        {"seq": 2, "process_id": 36, "station_id": 39},
    ]
    unchanged = [
        {"seq": 1, "process_id": 35, "station_id": 38},
        {"seq": 2, "process_id": 36, "station_id": 39},
    ]
    changed = [
        {"seq": 1, "process_id": 35, "station_id": 38},
        {"seq": 2, "process_id": 36, "station_id": 40},
    ]
    assert not _route_steps_changed(before, unchanged)
    assert _route_steps_changed(before, changed)


def test_submission_only_creates_pending_request(approval_client):
    _, client, database = approval_client
    response = submit_process(client)
    assert response.status_code == 200
    assert response.get_json()["data"]["request_no"] == "APR-00000001"
    assert database.processes == []
    assert database.approvals[1]["status"] == "pending"
    assert json.loads(database.approvals[1]["after_data"])["process_code"] == "P-01"


def test_different_approver_applies_change_atomically(approval_client):
    app, client, database = approval_client
    assert submit_process(client).status_code == 200
    app.config.update(ACCOUNT_ID=2, PERMISSIONS={"process.approve"})
    response = client.post("/api/admin/config-approvals/review", json={
        "id": 1,
        "revision": 1,
        "decision": "approve",
        "comment": "同意",
    })
    assert response.status_code == 200
    assert database.approvals[1]["status"] == "approved"
    assert database.processes[0]["process_name"] == "下料"
    assert database.commits == 2


def test_applicant_with_approval_permission_can_approve_own_request(approval_client):
    app, client, database = approval_client
    assert submit_process(client).status_code == 200
    app.config["PERMISSIONS"] = {"process.add", "process.approve"}
    response = client.post("/api/admin/config-approvals/review", json={
        "id": 1,
        "revision": 1,
        "decision": "approve",
    })
    assert response.status_code == 200
    assert database.approvals[1]["status"] == "approved"
    assert database.processes[0]["process_code"] == "P-01"


def test_stale_revision_cannot_be_approved_after_applicant_edits(approval_client):
    app, client, database = approval_client
    assert submit_process(client).status_code == 200
    response = client.post("/api/admin/config-approvals/update", json={
        "id": 1,
        "revision": 1,
        "payload": {
            "process_code": "P-01",
            "process_name": "下料-修改",
            "sort": 20,
        },
    })
    assert response.status_code == 200
    assert database.approvals[1]["revision"] == 2
    app.config.update(ACCOUNT_ID=2, PERMISSIONS={"process.approve"})
    stale = client.post("/api/admin/config-approvals/review", json={
        "id": 1,
        "revision": 1,
        "decision": "approve",
    })
    assert stale.status_code == 400
    assert "已修改" in stale.get_json()["msg"]
    assert database.processes == []


def test_processed_request_cannot_be_edited(approval_client):
    app, client, _ = approval_client
    assert submit_process(client).status_code == 200
    app.config["PERMISSIONS"] = {"process.add", "process.approve"}
    assert client.post("/api/admin/config-approvals/review", json={
        "id": 1,
        "revision": 1,
        "decision": "approve",
    }).status_code == 200
    response = client.post("/api/admin/config-approvals/update", json={
        "id": 1,
        "revision": 1,
        "payload": {"process_code": "P-01", "process_name": "不应修改"},
    })
    assert response.status_code == 400
    assert "已处理" in response.get_json()["msg"]


def test_rejected_request_can_be_edited_and_resubmitted(approval_client):
    app, client, database = approval_client
    assert submit_process(client).status_code == 200
    app.config["PERMISSIONS"] = {"process.add", "process.approve"}
    assert client.post("/api/admin/config-approvals/review", json={
        "id": 1,
        "revision": 1,
        "decision": "reject",
        "comment": "请修改名称",
    }).status_code == 200
    assert database.approvals[1]["status"] == "rejected"
    response = client.post("/api/admin/config-approvals/update", json={
        "id": 1,
        "revision": 1,
        "payload": {"process_code": "P-01", "process_name": "下料-已修改"},
    })
    assert response.status_code == 200
    assert database.approvals[1]["status"] == "pending"
    assert database.approvals[1]["revision"] == 2


def seed_pending_rows(database):
    for row_id in range(1, 26):
        database.approvals[row_id] = {
            "id": row_id,
            "request_no": f"APR-{row_id:08d}",
            "module_type": "process",
            "action_type": "create",
            "target_key": f"P-{row_id}",
            "before_data": None,
            "after_data": json.dumps({"process_code": f"P-{row_id}", "process_name": f"工序{row_id}"}),
            "status": "pending",
            "revision": 1,
            "applicant_account_id": 2 if row_id < 25 else 3,
            "applicant_name": "同名申请人",
        }
    database.approvals[26] = {**database.approvals[25], "id": 26, "module_type": "workstation", "applicant_account_id": 4}
    database.approvals[27] = {**database.approvals[25], "id": 27, "status": "approved", "applicant_account_id": 5}


def test_pending_applicant_filter_covers_all_pages_and_preserves_permission_scope(approval_client):
    app, client, database = approval_client
    seed_pending_rows(database)
    app.config["PERMISSIONS"] = {"process.approve"}
    response = client.get("/api/admin/config-approvals?scope=pending&applicant_account_id=2&pageSize=10&current=3")
    body = response.get_json()
    assert response.status_code == 200
    assert body["total"] == 24
    assert [row["id"] for row in body["data"]] == [4, 3, 2, 1]
    assert {row["applicant_account_id"] for row in body["data"]} == {2}
    assert {item["applicant_account_id"] for item in body["applicants"]} == {2, 3}
    assert body["data"][0]["after_data"]["process_code"] == "P-4"
    hidden = client.get("/api/admin/config-approvals?scope=pending&applicant_account_id=4").get_json()
    assert hidden["data"] == []
    assert hidden["total"] == 0


def test_applicant_options_follow_module_filter_and_no_permission_returns_nothing(approval_client):
    app, client, database = approval_client
    seed_pending_rows(database)
    app.config["PERMISSIONS"] = {"process.approve", "workstation.approve"}
    body = client.get("/api/admin/config-approvals?scope=pending&module_type=workstation").get_json()
    assert body["total"] == 1
    assert [item["applicant_account_id"] for item in body["applicants"]] == [4]
    app.config["PERMISSIONS"] = {"approval.mine"}
    body = client.get("/api/admin/config-approvals?scope=pending").get_json()
    assert body["data"] == []
    assert body["applicants"] == []


@pytest.mark.parametrize("applicant", ["0", "-1", "invalid", "1 OR 1=1"])
def test_invalid_applicant_filter_is_rejected(approval_client, applicant):
    app, client, _ = approval_client
    app.config["PERMISSIONS"] = {"process.approve"}
    response = client.get("/api/admin/config-approvals", query_string={"scope": "pending", "applicant_account_id": applicant})
    assert response.status_code == 400
    assert response.get_json()["msg"] == "申请人无效"


def test_review_rechecks_status_and_module_permission_for_each_request(approval_client):
    app, client, database = approval_client
    seed_pending_rows(database)
    app.config["PERMISSIONS"] = {"process.approve"}
    for row_id, expected in [(1, 200), (27, 400), (26, 400), (2, 200)]:
        response = client.post("/api/admin/config-approvals/review", json={
            "id": row_id, "revision": 1, "decision": "reject", "comment": "统一驳回原因",
        })
        assert response.status_code == expected
    assert database.approvals[1]["status"] == "rejected"
    assert database.approvals[2]["status"] == "rejected"
    assert database.approvals[26]["status"] == "pending"
    assert database.approvals[27]["status"] == "approved"
