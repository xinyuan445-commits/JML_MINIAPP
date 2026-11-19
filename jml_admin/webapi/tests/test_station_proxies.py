from copy import deepcopy
from datetime import datetime, timedelta

import pytest

import app as webapp
from station_proxies import cleanup_expired, parse_time
from test_admin_permissions import client_for_admin
from test_station_permissions import StationDatabase, PAYLOAD, BASE as STAFF_BASE

BASE = STAFF_BASE + "/proxies"
GRANT = {"staff_id": "scanner-1", "starts_at": "2026-10-13T12:00:00+08:00", "ends_at": "2026-10-13T13:00:00+08:00"}
PAYMENT = {"station_id": 28, "version": "", "proxies": [GRANT]}


class ProxyDatabase(StationDatabase):
    def __init__(self, manage=True):
        super().__init__(["station-permissions.view"] + (["station-permissions.manage"] if manage else []))
        self.now = datetime(2026, 10, 13, 4)
        self.proxies = []
        self.proxy_snapshot = None
        self.next_proxy_id = 1

    def execute(self, query, params=None):
        super().execute(query, params)
        if query.startswith(("DELETE FROM mo_station_staff_proxy_yx", "INSERT INTO mo_station_staff_proxy_yx")):
            if self.proxy_snapshot is None:
                self.proxy_snapshot = deepcopy(self.proxies)
            if query.startswith("DELETE"):
                field = "station_id" if "station_id=%s" in query else "id"
                self.proxies = [row for row in self.proxies if row[field] != params[0]]
            else:
                station, staff, start, end, _operator = params
                self.proxies.append({"id": self.next_proxy_id, "station_id": station,
                    "staff_id": staff, "starts_at": start, "ends_at": end})
                self.next_proxy_id += 1

    def fetchone(self):
        if "UTC_TIMESTAMP() AS now_utc" in self.query:
            return {"now_utc": self.now}
        return super().fetchone()

    def fetchall(self):
        if "FROM mo_station_staff_proxy_yx" in self.query:
            rows = deepcopy(self.proxies)
            if "WHERE station_id=%s" in self.query:
                rows = [row for row in rows if row["station_id"] == self.calls[-1][1][0]]
            if "ends_at>UTC_TIMESTAMP()" in self.query:
                rows = [row for row in rows if row["ends_at"] > self.now]
            if "ends_at<=UTC_TIMESTAMP()" in self.query:
                rows = [row for row in rows if row["ends_at"] <= self.now]
            return sorted(rows, key=lambda row: row["staff_id"])
        return super().fetchall()

    def commit(self):
        super().commit()
        self.proxy_snapshot = None

    def rollback(self):
        super().rollback()
        if self.proxy_snapshot is not None:
            self.proxies = self.proxy_snapshot
            self.proxy_snapshot = None


@pytest.fixture
def database(monkeypatch):
    webapp.app.config.update(TESTING=True, SECRET_KEY="test-only-flask-secret")
    monkeypatch.setattr(webapp, "_write_audit", lambda response: None)
    database = ProxyDatabase()
    monkeypatch.setattr(webapp, "db", lambda: database)
    return database


def current(client):
    return client.get(BASE).json["data"][0]


def test_proxy_add_extend_remove_never_updates_permanent_staff(database):
    client = client_for_admin()
    assert client.post(STAFF_BASE + "/save", json=PAYLOAD).status_code == 200
    permanent = deepcopy(database.configs)
    assert client.post(BASE + "/save", json=PAYMENT).status_code == 200
    row = current(client)
    assert row["proxies"][0]["person"]["id"] == "scanner-1"
    assert row["proxies"][0]["starts_at"] == "2026-10-13T04:00:00+00:00"
    assert client.post(BASE + "/save", json={**PAYMENT, "version": row["version"],
        "proxies": [{**GRANT, "ends_at": "2026-10-14T12:00:00+08:00"}]}).status_code == 200
    assert client.post(BASE + "/save", json={**PAYMENT, "version": current(client)["version"], "proxies": []}).status_code == 200
    assert not database.proxies
    assert database.configs == permanent


@pytest.mark.parametrize("method,path", [("GET", BASE), ("POST", BASE + "/save")])
def test_proxy_endpoints_require_login_and_permissions(database, method, path):
    assert webapp.app.test_client().open(path, method=method, json=PAYMENT).status_code == 401
    database.permissions = []
    assert client_for_admin().open(path, method=method, json=PAYMENT).status_code == 403


def test_proxy_view_cannot_save(database):
    database.permissions = ["station-permissions.view"]
    client = client_for_admin()
    assert client.get(BASE).status_code == 200
    assert client.post(BASE + "/save", json=PAYMENT).status_code == 403


@pytest.mark.parametrize("changes", [
    {"station_id": 999}, {"station_id": True}, {"version": 1},
    {"proxies": "staff"}, {"proxies": [GRANT] * 101}, {"proxies": [GRANT, GRANT]},
    {"proxies": [{**GRANT, "staff_id": "missing"}]},
    {"proxies": [{**GRANT, "ends_at": "invalid"}]},
    {"proxies": [{**GRANT, "ends_at": "2026-10-13T04:00:00Z"}]},
    {"proxies": [{**GRANT, "starts_at": "2026-10-13T14:00:00+08:00"}]},
    {"proxies": [{**GRANT, "ends_at": "2026-10-13T13:00:00"}]},
    {"leader_staff_id": "scanner-2"},
])
def test_invalid_proxy_grants_never_write(database, changes):
    response = client_for_admin().post(BASE + "/save", json={**PAYMENT, **changes})
    assert response.status_code == 400, response.json
    assert not database.proxies
    assert not any(query.startswith(("DELETE FROM mo_station_staff_proxy_yx", "INSERT INTO mo_station_staff_proxy_yx")) for query, _ in database.calls)


def test_inactive_staff_cannot_be_granted_proxy(database):
    database.people["scanner-1"]["status"] = "0"
    assert client_for_admin().post(BASE + "/save", json=PAYMENT).status_code == 400


def test_stale_editor_and_expired_grant_cannot_resurrect_proxy(database):
    client = client_for_admin()
    assert client.post(BASE + "/save", json=PAYMENT).status_code == 200
    version = current(client)["version"]
    assert client.post(BASE + "/save", json=PAYMENT).status_code == 400
    database.now += timedelta(hours=1)
    assert client.get(BASE).json["data"] == []
    assert client.post(BASE + "/save", json={**PAYMENT, "version": version,
        "proxies": [{**GRANT, "ends_at": "2026-10-14T12:00:00+08:00"}]}).status_code == 400


def test_expiry_cleanup_is_atomic_audited_idempotent_and_preserves_leader(database):
    client = client_for_admin()
    assert client.post(STAFF_BASE + "/save", json=PAYLOAD).status_code == 200
    permanent = deepcopy(database.configs)
    assert client.post(BASE + "/save", json=PAYMENT).status_code == 200
    database.now += timedelta(hours=1)
    assert cleanup_expired(database) == 1
    assert cleanup_expired(database) == 0
    assert not database.proxies and database.configs == permanent
    audits = [params for query, params in database.calls if "station-proxy-expiry" in query and "INSERT" in query]
    assert len(audits) == 1 and audits[0][1] == "工站代理到期自动移除"


def test_audit_failure_rolls_back_save_and_expiry_removal(database):
    client = client_for_admin()
    assert client.post(BASE + "/save", json=PAYMENT).status_code == 200
    before = deepcopy(database.proxies)
    database.fail_audit = True
    assert client.post(BASE + "/save", json={**PAYMENT, "version": current(client)["version"], "proxies": []}).status_code == 503
    assert database.proxies == before
    database.now += timedelta(hours=1)
    with pytest.raises(RuntimeError):
        cleanup_expired(database)
    assert database.proxies == before


def test_beijing_timestamp_is_stored_in_utc():
    assert parse_time("2026-10-13T12:00:00+08:00") == datetime(2026, 10, 13, 4)


def test_cleanup_removes_only_expired_grant_and_preserves_future_grants(database):
    client = client_for_admin()
    assert client.post(BASE + "/save", json=PAYMENT).status_code == 200
    assert client.post(BASE + "/save", json={**PAYMENT, "station_id": 37,
        "proxies": [{**GRANT, "starts_at": "2026-10-14T12:00:00+08:00",
            "ends_at": "2026-10-15T12:00:00+08:00"}]}).status_code == 200
    database.now += timedelta(hours=1)
    assert cleanup_expired(database) == 1
    assert len(database.proxies) == 1 and database.proxies[0]["station_id"] == 37


def test_cleanup_command_runs_without_web_requests_and_closes_connection(monkeypatch):
    import sys
    from unittest.mock import Mock
    import cleanup_station_proxies as job
    connection = Mock()
    monkeypatch.setattr(sys, "argv", ["cleanup_station_proxies.py"])
    monkeypatch.setattr(webapp, "db", Mock(return_value=connection))
    cleanup = Mock(return_value=0)
    monkeypatch.setattr(job, "cleanup_expired", cleanup)
    job.main()
    cleanup.assert_called_once_with(connection)
    connection.close.assert_called_once()


def test_cleanup_loop_retries_failure_and_never_logs_database_secrets(monkeypatch, caplog):
    import sys
    from unittest.mock import Mock
    import cleanup_station_proxies as job
    connection = Mock()
    monkeypatch.setattr(sys, "argv", ["cleanup_station_proxies.py", "--loop"])
    monkeypatch.setattr(webapp, "db", Mock(return_value=connection))
    cleanup = Mock(side_effect=[RuntimeError("password=private"), 0])
    monkeypatch.setattr(job, "cleanup_expired", cleanup)
    monkeypatch.setattr(job.time, "sleep", Mock(side_effect=[None, RuntimeError("stop-test")]))
    with pytest.raises(RuntimeError, match="stop-test"):
        job.main()
    assert cleanup.call_count == 2 and connection.close.call_count == 2
    assert "retry in one minute" in caplog.text and "private" not in caplog.text
