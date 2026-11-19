import json
from copy import deepcopy
from unittest.mock import MagicMock

import pytest

import app as webapp
from init_station_permissions import initialize
from oidc_auth import OidcAuthenticator, OidcSettings
from test_admin_permissions import WRITE_AUDIT, client_for_admin
from test_station_permissions import StationDatabase, client_for_global_admin

BASE = "/api/admin/station-permissions/exemptions"
PAYLOAD = {"staff_ids": ["scanner-1", "leader-1"], "revision": 0}


class ExemptionDatabase(StationDatabase):
    def __init__(self, permissions):
        super().__init__(permissions)
        self.exemption = None
        self.exemption_snapshot = None

    def execute(self, query, params=None):
        super().execute(query, params)
        if "INSERT INTO mo_station_staff_exemption_yx" in query:
            self.exemption_snapshot = (deepcopy(self.exemption),)
            identifiers, revision, operator = params
            self.exemption = {"staff_ids": identifiers, "revision": revision,
                "updated_by": operator, "update_time": "2026-09-09 10:00:00"}

    def fetchone(self):
        if "FROM mo_station_staff_exemption_yx" in self.query:
            return deepcopy(self.exemption)
        return super().fetchone()

    def commit(self):
        super().commit()
        self.exemption_snapshot = None

    def rollback(self):
        super().rollback()
        if self.exemption_snapshot is not None:
            self.exemption = self.exemption_snapshot[0]
            self.exemption_snapshot = None


@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    webapp.app.config.update(TESTING=True, SECRET_KEY="test-only-flask-secret")
    monkeypatch.setattr(webapp, "_oidc_authenticator", OidcAuthenticator(OidcSettings.from_env({"OIDC_ENABLED": "0"})))
    monkeypatch.setattr(webapp, "_write_audit", lambda response: None)
    monkeypatch.setattr(webapp, "u8_db", MagicMock(side_effect=AssertionError("No real ERP connection")))


def connect(monkeypatch, manage=True):
    permissions = ["station-permissions.view"] + (["station-permissions.manage"] if manage else [])
    database = ExemptionDatabase(permissions)
    monkeypatch.setattr(webapp, "db", lambda: database)
    return database


def test_empty_save_reload_clear_and_no_reporting_changes(monkeypatch):
    database = connect(monkeypatch)
    client = client_for_global_admin()
    empty = client.get(BASE).get_json()["data"]
    assert empty == {"staff_ids": [], "staff": [], "revision": 0, "updated_by": None,
        "update_time": None, "enforcement_enabled": False}
    saved = client.post(BASE + "/save", json=PAYLOAD)
    assert saved.status_code == 200
    assert saved.get_json()["data"] == {"id": 1, "revision": 1, "enforcement_enabled": False}
    result = client.get(BASE).get_json()["data"]
    assert result["staff_ids"] == ["leader-1", "scanner-1"]
    assert [person["id"] for person in result["staff"]] == result["staff_ids"]
    assert all(set(person) == {"id", "name", "position", "status"} for person in result["staff"])
    assert result["revision"] == 1 and result["enforcement_enabled"] is False
    assert result["updated_by"] == "admin" and result["update_time"]
    assert client.post(BASE + "/save", json={"staff_ids": [], "revision": 1}).status_code == 200
    cleared = client.get(BASE).get_json()["data"]
    assert cleared["staff_ids"] == [] and cleared["staff"] == [] and cleared["revision"] == 2
    assert not database.configs
    mutations = [sql for sql, _ in database.calls if sql.strip().startswith(("INSERT", "UPDATE", "DELETE", "CREATE", "ALTER"))]
    assert all("INSERT INTO mo_station_staff_exemption_yx" in sql or "INSERT INTO mo_admin_audit_log_yx" in sql for sql in mutations)


@pytest.mark.parametrize("method,path", [("GET", BASE), ("POST", BASE + "/save")])
def test_anonymous_forged_headers_and_unauthorized_rejected(monkeypatch, method, path):
    database = connect(monkeypatch)
    headers = {"X-Auth-Request-User": "leader-1", "X-JML-User": "leader-1", "X-Forwarded-User": "leader-1"}
    assert webapp.app.test_client().open(path, method=method, json=PAYLOAD, headers=headers).status_code == 401
    database.permissions = []
    assert client_for_global_admin().open(path, method=method, json=PAYLOAD).status_code == 403
    assert database.exemption is None


def test_view_permission_can_read_but_not_save(monkeypatch):
    database = connect(monkeypatch, manage=False)
    client = client_for_global_admin()
    assert client.get(BASE).status_code == 200
    assert client.head(BASE).status_code == 200
    assert client.post(BASE + "/save", json=PAYLOAD).status_code == 403
    assert database.exemption is None


def test_non_admin_cannot_read_or_save_exemptions_even_with_manage_permission(monkeypatch):
    database = connect(monkeypatch)
    client = client_for_admin()
    assert client.get(BASE).status_code == 403
    assert client.post(BASE + "/save", json=PAYLOAD).status_code == 403
    assert database.exemption is None


@pytest.mark.parametrize("changes", [
    {"staff_ids": ["missing"]}, {"staff_ids": "scanner-1"}, {"staff_ids": None},
    {"staff_ids": [None]}, {"staff_ids": [True]}, {"staff_ids": [42]},
    {"staff_ids": [""]}, {"staff_ids": ["  "]}, {"staff_ids": ["x" * 65]},
    {"staff_ids": ["scanner-1\n"]}, {"staff_ids": ["scanner-1"] * 101},
    {"revision": True}, {"revision": -1}, {"revision": "0"}, {"revision": None}, {"revision": 1},
    {"enforcement_enabled": True}, {"enabled": False}, {"userid": "scanner-1"},
    {"username": "forged-admin"}, {"station_id": 28}, {"role_ids": [1]},
])
def test_invalid_configuration_cannot_write(monkeypatch, changes):
    database = connect(monkeypatch)
    assert client_for_global_admin().post(BASE + "/save", json={**PAYLOAD, **changes}).status_code == 400
    assert database.exemption is None


@pytest.mark.parametrize("body", [[], "scanner-1", {}, {"staff_ids": []}, {"revision": 0}])
def test_invalid_body_rejected(monkeypatch, body):
    database = connect(monkeypatch)
    assert client_for_global_admin().post(BASE + "/save", json=body).status_code == 400
    assert database.exemption is None


def test_duplicate_ids_deduplicated(monkeypatch):
    database = connect(monkeypatch)
    assert client_for_global_admin().post(BASE + "/save", json={**PAYLOAD,
        "staff_ids": ["scanner-1", " scanner-1 "]}).status_code == 200
    assert json.loads(database.exemption["staff_ids"]) == ["scanner-1"]


def test_stale_revision_cannot_overwrite_or_clear(monkeypatch):
    database = connect(monkeypatch)
    client = client_for_global_admin()
    assert client.post(BASE + "/save", json=PAYLOAD).status_code == 200
    before = deepcopy(database.exemption)
    assert client.post(BASE + "/save", json={"staff_ids": [], "revision": 0}).status_code == 400
    assert database.exemption == before
    assert any("FROM mo_station_staff_exemption_yx WHERE id=1 FOR UPDATE" in sql for sql, _ in database.calls)


def test_inactive_and_missing_staff_remain_visible_and_removable(monkeypatch):
    database = connect(monkeypatch)
    client = client_for_global_admin()
    assert client.post(BASE + "/save", json=PAYLOAD).status_code == 200
    database.people["leader-1"]["status"] = "0"
    del database.people["scanner-1"]
    result = client.get(BASE).get_json()["data"]
    assert result["staff_ids"] == ["leader-1", "scanner-1"]
    assert [person["status"] for person in result["staff"]] == ["0", "missing"]
    assert result["staff"][1]["name"] == "人员已不存在"
    assert client.post(BASE + "/save", json={**PAYLOAD, "revision": 1}).status_code == 400
    assert client.post(BASE + "/save", json={"staff_ids": [], "revision": 1}).status_code == 200


def test_audit_uses_authenticated_operator_and_rolls_back_with_change(monkeypatch):
    database = connect(monkeypatch)
    client = client_for_global_admin()
    assert client.post(BASE + "/save", json=PAYLOAD, headers={"X-Auth-Request-User": "forged-admin"}).status_code == 200
    audits = [params for sql, params in database.calls if "INSERT INTO mo_admin_audit_log_yx" in sql]
    assert len(audits) == 1 and audits[0][0] == "admin"
    assert audits[0][1] == "保存工站豁免人员配置"
    assert json.loads(audits[0][5]) == {"before": None, "after": {"staff_ids": ["leader-1", "scanner-1"]}, "enforcement_enabled": False}
    assert database.exemption["updated_by"] == "admin"
    before = deepcopy(database.exemption)
    database.fail_audit = True
    assert client.post(BASE + "/save", json={"staff_ids": [], "revision": 1}).status_code == 503
    assert database.exemption == before


def test_first_save_rolls_back_if_audit_fails(monkeypatch):
    database = connect(monkeypatch)
    database.fail_audit = True
    assert client_for_global_admin().post(BASE + "/save", json=PAYLOAD).status_code == 503
    assert database.exemption is None


def test_failed_change_is_audited_without_sensitive_fields(monkeypatch):
    database = connect(monkeypatch, manage=False)
    monkeypatch.setattr(webapp, "_write_audit", WRITE_AUDIT)
    assert client_for_global_admin().post(BASE + "/save", json={**PAYLOAD, "token": "never-log", "secret": "never-log"}).status_code == 403
    audits = [params for sql, params in database.calls if "INSERT INTO mo_admin_audit_log_yx" in sql]
    assert len(audits) == 1 and audits[0][1] == "配置工站豁免人员失败"
    assert json.loads(audits[0][5]) == PAYLOAD
    assert "never-log" not in audits[0][5]


def test_initializer_creates_table_idempotently_without_seeding_or_overwriting():
    database = MagicMock()
    cur = database.cursor.return_value
    cur.fetchone.return_value = {"id": 1, "permissions": '["station-permissions.view","station-permissions.manage"]'}
    initialize(database)
    initialize(database)
    statements = [call.args[0] for call in cur.execute.call_args_list]
    exemption_statements = [sql for sql in statements if "mo_station_staff_exemption_yx" in sql]
    assert len(exemption_statements) == 2
    assert all(sql.startswith("CREATE TABLE IF NOT EXISTS") and "CHECK (id = 1)" in sql for sql in exemption_statements)
    assert not any(sql.lstrip().startswith(("INSERT", "UPDATE", "DELETE", "TRUNCATE", "DROP")) for sql in exemption_statements)
