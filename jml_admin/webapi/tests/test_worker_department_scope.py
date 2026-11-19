import os
from unittest.mock import MagicMock, patch

import pytest
pytestmark = pytest.mark.usefixtures("legacy_admin_access")


os.environ["FLASK_SECRET_KEY"] = "test-only-flask-secret"
with patch("dotenv.load_dotenv", return_value=False), patch(
    "mysql.connector.pooling.MySQLConnectionPool",
    return_value=MagicMock(),
):
    import app as webapp


class ScopeCursor:
    def __init__(self, selected=None):
        self.selected = selected or []
        self.query = ""
        self.params = None
        self.inserted = []

    def execute(self, query, params=None):
        self.query = query
        self.params = params

    def executemany(self, query, params):
        self.query = query
        self.inserted = list(params)

    def fetchall(self):
        if "SELECT dept_id FROM mo_worker_department_scope_yx" in self.query:
            return [{"dept_id": dept_id} for dept_id in self.selected]
        if "dept_id IN" in self.query:
            return [{"dept_id": dept_id} for dept_id in (self.params or [])]
        if "FROM ding_department_yx" in self.query:
            return [
                {
                    "dept_id": 1,
                    "parent_dept_id": None,
                    "dept_name": "根部门",
                    "dept_level": 1,
                    "dept_path": "根部门",
                },
                {
                    "dept_id": 661823215,
                    "parent_dept_id": 1,
                    "dept_name": "默认部门一",
                    "dept_level": 2,
                    "dept_path": "根部门/默认部门一",
                },
                {
                    "dept_id": 594600049,
                    "parent_dept_id": 1,
                    "dept_name": "默认部门二",
                    "dept_level": 2,
                    "dept_path": "根部门/默认部门二",
                },
            ]
        return []

    def close(self):
        pass


class ScopeConnection:
    def __init__(self, selected=None):
        self.scope_cursor = ScopeCursor(selected)

    def cursor(self, dictionary=False):
        return self.scope_cursor

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        pass


@pytest.fixture
def client():
    webapp.app.config.update(TESTING=True, SECRET_KEY="test-only-flask-secret")
    client = webapp.app.test_client()
    with client.session_transaction() as session:
        session["admin_username"] = "admin"
        session["admin_role"] = "admin"
    return client


def test_get_scope_returns_legacy_defaults_when_not_configured(client, monkeypatch):
    connection = ScopeConnection()
    monkeypatch.setattr(webapp, "db", lambda: connection)

    response = client.get("/api/mo/worker-department-scope")

    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["configured"] is False
    assert data["selected_dept_ids"] == [594600049, 661823215]


def test_save_scope_replaces_selected_departments(client, monkeypatch):
    connection = ScopeConnection()
    monkeypatch.setattr(webapp, "db", lambda: connection)
    monkeypatch.setattr(webapp, "_write_audit", lambda _response: None)

    response = client.post(
        "/api/mo/worker-department-scope",
        json={"dept_ids": [30, 10, 20, 10]},
    )

    assert response.status_code == 200
    assert response.get_json()["data"]["selected_dept_ids"] == [10, 20, 30]
    assert connection.scope_cursor.inserted == [
        (10, "admin"),
        (20, "admin"),
        (30, "admin"),
    ]


def test_save_scope_rejects_empty_selection(client):
    response = client.post(
        "/api/mo/worker-department-scope",
        json={"dept_ids": []},
    )

    assert response.get_json()["code"] == 1
    assert response.get_json()["msg"] == "请至少选择一个部门"
