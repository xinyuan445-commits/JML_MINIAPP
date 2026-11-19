import json
from copy import deepcopy
from unittest.mock import MagicMock

import pytest
from flask import g, session
from werkzeug.security import check_password_hash

import app as webapp
from admin_permissions import (
    ALL_PERMISSIONS, DEFAULT_PERMISSIONS, BUSINESS_VIEWS, READ_RULES, WRITE_RULES,
    account_permissions, identity_key, load_account, normalize_permissions,
    page_request_enabled, permission_catalog, permits,
)
from oidc_auth import OidcAuthenticator, OidcIdentity, OidcSettings

WRITE_AUDIT = webapp._write_audit


def test_permission_catalog_groups_reports2_under_dashboard():
    report = next(item for item in permission_catalog() if item["key"] == "reports2")
    assert report["group"] == "数据看板"
    assert report["permissions"] == [{"key": "reports2.view", "name": "查看"}]


@pytest.fixture(autouse=True)
def isolated_app(monkeypatch):
    webapp.app.config.update(TESTING=True, SECRET_KEY="test-only-flask-secret")
    monkeypatch.setattr(webapp, "_oidc_authenticator", OidcAuthenticator(OidcSettings.from_env({"OIDC_ENABLED": "0"})))
    monkeypatch.setattr(webapp, "u8_db", MagicMock(side_effect=AssertionError("No real ERP connection")))
    monkeypatch.setattr(webapp, "_write_audit", lambda response: None)


def client_for_admin():
    client = webapp.app.test_client()
    with client.session_transaction() as values:
        values.update(admin_user_id=7, admin_username="local-admin", admin_role="admin", admin_auth_version=0)
    return client


class PermissionDatabase:
    def __init__(self, permissions=ALL_PERMISSIONS):
        self.user = {"id": 7, "username": "local-admin", "display_name": "本地管理员", "is_active": 1, "role": "admin"}
        self.account = {"id": 9, "is_active": 1, "session_version": 0, "auth_source": "session", "local_user_id": 7, "display_name": "本地管理员"}
        self.permissions = sorted(permissions)
        self.calls = []
        self.query = ""
        self.rowcount = 1
        self.lastrowid = 20
        self.commits = 0
        self.rollbacks = 0
        self.admin_count = 1
        self.before_role = {"id": 4, "name": "打印员", "code": "printer", "permissions": '["production-label.view"]', "is_system": 0, "is_active": 1}

    def cursor(self, dictionary=False): return self
    def execute(self, query, params=None):
        self.query = query
        self.calls.append((query, params))
    def fetchone(self):
        if "COUNT(*)" in self.query: return {"total": self.admin_count}
        if "FROM mo_admin_user_yx" in self.query: return self.user
        if "FROM mo_admin_account_yx" in self.query: return deepcopy(self.account)
        if "FOR UPDATE" in self.query: return {"id": 1}
        if "SELECT * FROM mo_admin_role_yx" in self.query: return self.before_role
        raise AssertionError(self.query)
    def fetchall(self):
        if "SELECT r.code,r.permissions" in self.query:
            return [{"code": "custom", "permissions": json.dumps(self.permissions)}]
        if "FROM mo_admin_page_setting_yx" in self.query:
            return []
        if "SELECT id FROM mo_admin_role_yx WHERE id IN" in self.query:
            return [{"id": value} for value in self.calls[-1][1]]
        if "SELECT role_id FROM mo_admin_account_role_yx" in self.query: return [{"role_id": 1}]
        raise AssertionError(self.query)
    def commit(self): self.commits += 1
    def rollback(self): self.rollbacks += 1
    def close(self): pass


def connect(monkeypatch, permissions=ALL_PERMISSIONS):
    database = PermissionDatabase(permissions)
    monkeypatch.setattr(webapp, "db", lambda: database)
    return database


def test_all_existing_admin_api_routes_have_explicit_rules():
    anonymous = {"/api/currentUser", "/api/login/account", "/api/login/outLogin", "/api/mo/_auth-test"}
    for rule in webapp.app.url_map.iter_rules():
        if not rule.rule.startswith("/api/") or rule.rule in anonymous: continue
        for method in rule.methods - {"OPTIONS"}:
            mapping = READ_RULES if method in {"GET", "HEAD"} else WRITE_RULES
            assert rule.rule in mapping, (rule.rule, method)
            assert mapping[rule.rule] <= ALL_PERMISSIONS


@pytest.mark.parametrize("permission", sorted(ALL_PERMISSIONS))
def test_view_granted_with_each_operation(permission):
    result = normalize_permissions([permission])
    assert permission in result
    view_permission = f"{permission.split('.')[0]}.view"
    if view_permission in ALL_PERMISSIONS:
        assert view_permission in result


def test_route_create_is_independent_from_edit_and_can_view_own_request():
    permissions = normalize_permissions(["route.add"])
    assert "route.edit" not in permissions
    assert "route.view" in permissions
    assert "approval.mine" in permissions


@pytest.mark.parametrize("values", [["forged.admin"], "process.add", [None], [1]])
def test_unknown_permission_is_rejected(values):
    with pytest.raises(ValueError): normalize_permissions(values)


@pytest.mark.parametrize("path,requirements", list(WRITE_RULES.items()))
def test_viewer_cannot_call_any_write_action(path, requirements):
    assert not permits(BUSINESS_VIEWS, path, "POST")
    assert permits(requirements, path, "POST")
    assert not permits([], path, "POST")


def test_unknown_api_is_fail_closed_even_for_admin():
    assert not permits(ALL_PERMISSIONS, "/api/admin/unknown", "GET")
    assert not permits(ALL_PERMISSIONS, "/api/admin/unknown", "POST")


def test_disabled_page_overrides_existing_operation_permission():
    assert not page_request_enabled({"process"}, "/api/mo/process/add", "POST")
    assert page_request_enabled({"process"}, "/api/mo/process/list", "GET")
    assert not page_request_enabled({"process", "route"}, "/api/mo/process/list", "GET")
    assert page_request_enabled({"page-settings"}, "/api/admin/page-settings", "GET")


@pytest.mark.parametrize("permission", ["route.view", "workorder.view", "completed.view"])
def test_shared_route_lookup_accepts_any_consuming_page(permission):
    assert permits([permission], "/api/mo/route/list", "GET")


def test_local_session_role_does_not_override_granular_permissions(monkeypatch):
    database = connect(monkeypatch, ["production-label.view"])
    client = client_for_admin()
    assert client.get("/api/currentUser").get_json()["data"]["permissions"] == ["production-label.view"]
    assert client.post("/api/mo/production-label/print-log", json={}).status_code == 403
    assert client.get("/api/admin/accounts").status_code == 403
    database.permissions.append("production-label.print")
    assert client.post("/api/mo/production-label/print-log", json={"mo_code": "TEST"}).status_code == 200
    database.permissions.remove("production-label.print")
    assert client.post("/api/mo/production-label/print-log", json={}).status_code == 403


@pytest.mark.parametrize("change", ["local_disabled", "account_disabled", "password_reset"])
def test_existing_session_invalidated_on_next_request(monkeypatch, change):
    database = connect(monkeypatch)
    client = client_for_admin()
    assert client.get("/api/currentUser").status_code == 200
    if change == "local_disabled": database.user["is_active"] = 0
    elif change == "account_disabled": database.account["is_active"] = 0
    else: database.account["session_version"] += 1
    assert client.get("/api/currentUser").status_code == 401
    with client.session_transaction() as values: assert "admin_username" not in values


def test_database_failure_never_falls_back_to_cached_admin(monkeypatch):
    monkeypatch.setattr(webapp, "db", MagicMock(side_effect=RuntimeError("database unavailable")))
    client = client_for_admin()
    assert client.post("/api/mo/process/add", json={}).status_code == 503
    assert client.get("/healthz").status_code == 200
    assert client.post("/api/login/outLogin").status_code == 200


@pytest.mark.parametrize("path", [
    "/api/mo/process/add",
    "/api/mo/workstation/update",
    "/api/mo/product-category/toggle",
    "/api/mo/route/set-processes",
    "/api/mo/route/version/restore",
])
def test_legacy_configuration_writes_require_approval(monkeypatch, path):
    connect(monkeypatch)
    response = client_for_admin().post(path, json={})
    assert response.status_code == 409
    assert "审批中心" in response.get_json()["msg"]


def test_delete_permission_is_removed():
    assert "route.delete" not in ALL_PERMISSIONS


def test_pending_workstation_create_is_visible_but_inactive():
    cursor = MagicMock()
    cursor.fetchall.return_value = [{
        "id": 12,
        "request_no": "APR-00000012",
        "action_type": "create",
        "target_key": "TEST",
        "after_data": {
            "station_code": "TEST",
            "station_name": "测试工站",
            "description": "",
        },
        "status": "pending",
        "applicant_account_id": 9,
        "applicant_name": "测试员",
        "apply_time": "2026-09-19 10:00:00",
        "revision": 1,
    }]
    with webapp.app.test_request_context("/api/mo/workstation/list?include_pending=1"):
        g.admin_account = {"id": 9}
        rows = webapp._include_pending_config(cursor, "workstation", [])
    assert rows[0]["station_code"] == "TEST"
    assert rows[0]["approval_status"] == "pending"
    assert rows[0]["is_active"] == 0


def test_pending_edit_marks_existing_row_without_applying_proposal():
    cursor = MagicMock()
    cursor.fetchall.return_value = [{
        "id": 13,
        "request_no": "APR-00000013",
        "action_type": "edit",
        "target_key": "8",
        "after_data": {"id": 8, "station_name": "新名称"},
        "status": "pending",
        "applicant_account_id": 9,
        "applicant_name": "测试员",
        "apply_time": "2026-09-19 10:00:00",
        "revision": 2,
    }]
    original = [{"id": 8, "station_code": "S-08", "station_name": "原名称", "is_active": 1}]
    with webapp.app.test_request_context("/api/mo/workstation/list?include_pending=1"):
        g.admin_account = {"id": 9}
        rows = webapp._include_pending_config(cursor, "workstation", original)
    assert rows[0]["station_name"] == "原名称"
    assert rows[0]["approval_status"] == "pending"


def test_identity_key_separates_sources_and_issuers():
    assert len({identity_key("session", 7), identity_key("oidc", "7", "issuer1"), identity_key("oidc", "7", "issuer2")}) == 3


def test_oidc_role_ceiling_and_suite_admin():
    database = PermissionDatabase()
    account = database.account
    permissions, _ = account_permissions(database, account, platform_can_write=False)
    assert permissions and all(p.endswith(".view") or p == "nonorder.view-all" for p in permissions)
    assert "nonorder.view-all" in permissions
    assert "nonorder.review" not in permissions
    database.permissions = []
    permissions, _ = account_permissions(database, account, platform_roles=["suite-admin"])
    assert permissions == DEFAULT_PERMISSIONS
    # New task privileges require explicit assignment, even for a platform admin.
    assert not any(p.startswith('nonorder.') for p in permissions)
    database.permissions = ['nonorder.view', 'nonorder.review']
    permissions, _ = account_permissions(database, account, platform_roles=['suite-admin'])
    assert {'nonorder.view', 'nonorder.review'} <= permissions
    assert 'nonorder.transfer' not in permissions
    account["is_active"] = 0
    assert account_permissions(database, account, platform_roles=["suite-admin"])[0] == set()


def test_route_delete_is_disabled_for_oidc_admin(monkeypatch):
    connect(monkeypatch, ["route.edit", "route.view"])
    identity = OidcIdentity(subject="domain-123", username="DOMAIN\\test", display_name="测试", roles=frozenset(["production-admin"]))
    auth = MagicMock()
    auth.is_platform_request.return_value = True
    auth.authenticate.return_value = identity
    auth.can_view.return_value = True
    auth.can_write.return_value = True
    auth.settings.issuer_url = "https://issuer.test/realm"
    monkeypatch.setattr(webapp, "_oidc_authenticator", auth)
    response = webapp.app.test_client().post("/api/mo/route/admin-authorize")
    assert response.status_code == 409
    assert "删除功能已停用" in response.get_json()["msg"]


def test_first_authenticated_account_registers_once_and_does_not_overwrite_assignments():
    cur = MagicMock()
    cur.fetchone.side_effect = [None, {"id": 25}]
    cur.rowcount = 1
    cur.lastrowid = 25
    assert load_account(cur, "oidc", "stable-subject", "https://issuer.test", "name", "姓名")["id"] == 25
    assert any("INSERT INTO mo_admin_account_role_yx" in str(call) for call in cur.execute.call_args_list)
    cur.reset_mock()
    cur.fetchone.side_effect = None
    cur.fetchone.return_value = {"id": 25}
    load_account(cur, "oidc", "stable-subject", "https://issuer.test", "new-name", "新姓名")
    assert cur.execute.call_count == 1


def test_roles_management_forbidden_without_explicit_grant(monkeypatch):
    connect(monkeypatch, ["reports.view"])
    client = client_for_admin()
    assert client.post("/api/admin/roles/save", json={"code": "forged", "name": "forged", "permissions": list(ALL_PERMISSIONS)}).status_code == 403


def test_system_role_cannot_be_changed(monkeypatch):
    database = connect(monkeypatch)
    database.before_role["is_system"] = 1
    response = client_for_admin().post("/api/admin/roles/save", json={"id": 1, "name": "changed", "permissions": [], "is_active": False})
    assert response.status_code == 400
    assert database.rollbacks == 1


def test_role_update_is_audited_with_operator_and_permissions(monkeypatch):
    database = connect(monkeypatch)
    response = client_for_admin().post("/api/admin/roles/save", json={"id": 4, "name": "标签打印", "permissions": ["production-label.print"]})
    assert response.status_code == 200
    audit = next(params for sql, params in database.calls if "INSERT INTO mo_admin_audit_log_yx" in sql)
    assert audit[0] == "local-admin"
    assert "production-label.view" in audit[5]


def test_cannot_remove_last_local_admin(monkeypatch):
    database = connect(monkeypatch)
    database.admin_count = 0
    response = client_for_admin().post("/api/admin/accounts/save", json={"id": 9, "display_name": "测试", "role_ids": [], "is_active": True})
    assert response.status_code == 400
    assert "至少保留" in response.get_json()["msg"]
    assert database.rollbacks == 1


def test_cannot_disable_self(monkeypatch):
    connect(monkeypatch)
    response = client_for_admin().post("/api/admin/accounts/save", json={"id": 9, "display_name": "测试", "role_ids": [1], "is_active": False})
    assert response.status_code == 400
    assert "当前登录" in response.get_json()["msg"]


def test_password_reset_hashes_secret_invalidates_sessions_and_does_not_audit_secret(monkeypatch):
    database = connect(monkeypatch)
    password = "test-new-password-123"
    response = client_for_admin().post("/api/admin/accounts/password", json={"id": 9, "password": password})
    assert response.status_code == 200
    hashed = next(params[0] for sql, params in database.calls if "SET password_hash" in sql)
    assert check_password_hash(hashed, password)
    assert any("session_version=session_version+1" in sql for sql, _ in database.calls)
    audit = next(params for sql, params in database.calls if "INSERT INTO mo_admin_audit_log_yx" in sql)
    assert password not in str(audit) and hashed not in str(audit)
    assert password not in response.get_data(as_text=True)


def test_domain_password_cannot_be_reset_locally(monkeypatch):
    database = connect(monkeypatch)
    database.account["auth_source"] = "oidc"
    response = client_for_admin().post("/api/admin/accounts/password", json={"id": 9, "password": "test-password-123"})
    assert response.status_code == 400
    assert not any("SET password_hash" in sql for sql, _ in database.calls)


def test_authorization_change_rolls_back_if_audit_write_fails(monkeypatch):
    database = connect(monkeypatch)
    execute = database.execute
    def fail_audit(sql, params=None):
        if "INSERT INTO mo_admin_audit_log_yx" in sql: raise RuntimeError("audit unavailable")
        execute(sql, params)
    database.execute = fail_audit
    response = client_for_admin().post("/api/admin/roles/save", json={"id": 4, "name": "测试", "permissions": ["reports.view"]})
    assert response.status_code == 503
    assert database.rollbacks == 1


def test_disable_then_enable_cannot_revive_old_session(monkeypatch):
    database = connect(monkeypatch)
    real_resolve = webapp._resolve_admin_access
    def managing_user():
        g.admin_account = {"id": 1}
        g.admin_permissions = set(ALL_PERMISSIONS)
        return True
    monkeypatch.setattr(webapp, "_resolve_admin_access", managing_user)
    original_execute = database.execute
    def mutate(sql, params=None):
        original_execute(sql, params)
        if "session_version=session_version+1" in sql:
            database.account["session_version"] += 1
        if "mo_admin_account_yx SET display_name" in sql:
            database.account["is_active"] = params[1]
    database.execute = mutate
    client = client_for_admin()
    body = {"id": 9, "display_name": "测试", "role_ids": [1], "is_active": False}
    assert client.post("/api/admin/accounts/save", json=body).status_code == 200
    assert database.account["session_version"] == 1
    body["is_active"] = True
    assert client.post("/api/admin/accounts/save", json=body).status_code == 200
    monkeypatch.setattr(webapp, "_resolve_admin_access", real_resolve)
    assert client.get("/api/currentUser").status_code == 401


def test_account_creation_does_not_use_plain_password_or_legacy_admin_role(monkeypatch):
    database = connect(monkeypatch)
    password = "example-new-password"
    response = client_for_admin().post("/api/admin/accounts/save", json={
        "username": "new-printer", "display_name": "打印员", "password": password, "role_ids": [4],
    })
    assert response.status_code == 200
    sql, params = next((sql, params) for sql, params in database.calls if "INSERT INTO mo_admin_user_yx" in sql)
    assert "'viewer'" in sql
    assert params[0] == "new-printer" and check_password_hash(params[1], password)
    assert any("INSERT INTO mo_admin_account_role_yx" in sql and params[1] == 4 for sql, params in database.calls)
    audit = next(params for sql, params in database.calls if "INSERT INTO mo_admin_audit_log_yx" in sql)
    assert password not in str(audit)


def test_identity_id_reuse_does_not_keep_old_session(monkeypatch):
    database = connect(monkeypatch)
    database.user["id"] = 999
    assert client_for_admin().get("/api/currentUser").status_code == 401


def test_failed_security_requests_are_audited_without_secrets(monkeypatch):
    database = connect(monkeypatch, [])
    monkeypatch.setattr(webapp, "_write_audit", WRITE_AUDIT)
    response = client_for_admin().post("/api/admin/accounts/password", json={
        "id": 9, "password": "must-not-log-this", "token": "must-not-log-jwt", "extra": "must-not-log-extra",
    })
    assert response.status_code == 403
    audit = next(params for sql, params in database.calls if "INSERT INTO mo_admin_audit_log_yx" in sql)
    assert json.loads(audit[5]) == {"id": 9}
    assert audit[6] == 403


def test_successful_security_audit_is_not_duplicated(monkeypatch):
    database = connect(monkeypatch)
    monkeypatch.setattr(webapp, "_write_audit", WRITE_AUDIT)
    response = client_for_admin().post("/api/admin/roles/save", json={"id": 4, "name": "标签", "permissions": ["production-label.view"]})
    assert response.status_code == 200
    assert sum("INSERT INTO mo_admin_audit_log_yx" in sql for sql, _ in database.calls) == 1


def test_initializer_does_not_replace_existing_account_roles():
    from init_admin_permissions import initialize
    database = MagicMock()
    cur = database.cursor.return_value
    users = [{"id": 7, "username": "original", "display_name": "原管理员", "role": "admin", "is_active": 1}]
    cur.fetchall.side_effect = [[], users, [], users]
    cur.fetchone.return_value = {"id": 9, "is_active": 1}
    initialize(database)
    initialize(database)
    queries = [call.args[0] for call in cur.execute.call_args_list]
    assert sum("CREATE TABLE IF NOT EXISTS" in sql for sql in queries) == 10
    assert not any("DELETE" in sql or "INSERT INTO mo_admin_account_role_yx" in sql for sql in queries)
    assert not any("password" in sql for sql in queries)
    assert database.commit.call_count == 2


def test_initializer_ignores_semicolons_in_sql_line_comments():
    from init_admin_permissions import initialize
    database = MagicMock()
    cursor = database.cursor.return_value
    cursor.fetchall.return_value = []
    initialize(database)
    statements = [call.args[0].strip() for call in cursor.execute.call_args_list]
    assert len(statements) == 14  # Five CREATEs, two approval migrations, five role seeds, role migration and user lookup.
    assert all(sql.startswith("CREATE TABLE IF NOT EXISTS") for sql in statements[:3])
    assert not any("does not change ERP" in sql or sql.startswith("--") for sql in statements)


def test_initializer_adds_route_trace_to_roles_that_can_view_completed_records():
    from init_admin_permissions import initialize
    database = MagicMock()
    cursor = database.cursor.return_value
    cursor.fetchone.return_value = {"Field": "existing"}
    cursor.fetchall.side_effect = [
        [{"id": 6, "code": "custom", "permissions": '["completed.view"]'}],
        [],
    ]

    initialize(database)

    updates = [
        call.args[1]
        for call in cursor.execute.call_args_list
        if call.args[0].startswith("UPDATE mo_admin_role_yx SET permissions")
    ]
    assert len(updates) == 1
    assert set(json.loads(updates[0][0])) == {"completed.view", "route-trace.view"}


def test_initializer_adds_report_center_pages_to_existing_report_roles():
    from init_admin_permissions import initialize
    database = MagicMock()
    cursor = database.cursor.return_value
    cursor.fetchone.return_value = {"Field": "existing"}
    cursor.fetchall.side_effect = [
        [{"id": 6, "code": "custom", "permissions": '["reports.view"]'}],
        [],
    ]

    initialize(database)

    updates = [
        call.args[1]
        for call in cursor.execute.call_args_list
        if call.args[0].startswith("UPDATE mo_admin_role_yx SET permissions")
    ]
    assert len(updates) == 1
    assert set(json.loads(updates[0][0])) == {
        "receipt-comparison.view",
        "reports.view",
        "reports2.view",
        "workorder-process-report.view",
    }


def test_initializer_adds_completion_report_to_existing_label_roles():
    from init_admin_permissions import initialize
    database = MagicMock()
    cursor = database.cursor.return_value
    cursor.fetchone.return_value = {"Field": "existing"}
    cursor.fetchall.side_effect = [
        [{
            "id": 6,
            "code": "custom",
            "permissions": '["production-label.view", "production-label.print"]',
        }],
        [],
    ]

    initialize(database)

    updates = [
        call.args[1]
        for call in cursor.execute.call_args_list
        if call.args[0].startswith("UPDATE mo_admin_role_yx SET permissions")
    ]
    assert len(updates) == 1
    assert set(json.loads(updates[0][0])) == {
        "completion-flow-report.print",
        "completion-flow-report.view",
        "production-label.print",
        "production-label.view",
    }
