from flask import Flask

import routes.mo as mo


class FakeCursor:
    def __init__(self, executed):
        self.executed = executed
        self.current = None
        self.lastrowid = 71

    def execute(self, query, params=None):
        self.executed.append((query, params))
        if "FROM mo_wo_route_yx" in query:
            self.current = {"route_id": 9}
        elif "SELECT current_seq,status FROM mo_wo_state_yx" in query:
            self.current = None
        elif "FROM mo_handover_yx" in query:
            self.current = None
        elif "FROM jml_staff" in query:
            self.current = {"name": "测试人员"}
        elif "SELECT p.process_name" in query:
            self.current = {"process_name": "首工序"}
        else:
            self.current = None

    def fetchone(self):
        return self.current

    def close(self):
        pass


class FakeConnection:
    def __init__(self):
        self.executed = []

    def cursor(self, **_kwargs):
        return FakeCursor(self.executed)

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        pass


def test_first_receipt_persists_a1_and_a2(monkeypatch):
    connection = FakeConnection()
    monkeypatch.setattr(mo, "get_db2", lambda: connection)
    monkeypatch.setattr(
        mo,
        "_first_step_material_receipt",
        lambda *_args: ([{"sub_code": "1001"}], 10),
    )
    monkeypatch.setattr(mo, "write_operation_log", lambda *_args, **_kwargs: None)

    app = Flask(__name__)
    app.register_blueprint(mo.mo_bp)
    response = app.test_client().post(
        "/receive-first",
        json={
            "mo_code": "SCDD-TEST",
            "sort_seq": 1,
            "qty_a": 6,
            "qty_a1": 3,
            "qty_a2": 1,
            "photo_url": "receive.jpg",
            "user_id": "user-1",
        },
    )

    assert response.get_json()["code"] == 0
    insert = next(
        params
        for query, params in connection.executed
        if "INSERT INTO mo_handover_yx" in query
    )
    assert insert[5:9] == (10, 6, 3, 1)


def test_first_receipt_uses_panel_area_limit_from_erp(monkeypatch):
    connection = FakeConnection()
    monkeypatch.setattr(mo, "get_db2", lambda: connection)
    monkeypatch.setattr(mo, "write_operation_log", lambda *_args, **_kwargs: None)
    materials = [dict(sub_code="4402-TEST", qty_plan=600, qty_issued=872.99)]
    detail = dict(header=dict(DeptCode="04125", Qty_b=150), components=materials,
                  panel_first_issue=dict(issued_qty=218.2475, calculation=dict(mode="panel_area", materials=materials)))
    monkeypatch.setattr(mo, "_fetch_workorder_detail", lambda *_args: detail)
    app = Flask(__name__)
    app.register_blueprint(mo.mo_bp)
    client = app.test_client()
    receipt = dict(mo_code="SCDD-TEST", sort_seq=1, photo_url="receive.jpg", user_id="user-1")

    assert client.post("/receive-first", json={**receipt, "qty_a": 218.25}).get_json()["code"] == 1
    assert not connection.executed
    assert client.post("/receive-first", json={**receipt, "qty_a": 218.2475}).get_json()["code"] == 0
    detail.pop("panel_first_issue")
    assert "待核对" in client.post("/receive-first", json={**receipt, "qty_a": 1}).get_json()["msg"]
