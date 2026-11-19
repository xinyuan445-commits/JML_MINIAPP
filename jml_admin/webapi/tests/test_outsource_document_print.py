import os
from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest


os.environ["FLASK_SECRET_KEY"] = "test-only-flask-secret"
with patch("dotenv.load_dotenv", return_value=False), patch(
    "mysql.connector.pooling.MySQLConnectionPool", return_value=MagicMock()
):
    import app as webapp

from oidc_auth import OidcAuthenticator, OidcSettings


BASE_URL = "/api/outsource/document-print"
pytestmark = pytest.mark.usefixtures("legacy_admin_access")


@pytest.fixture(autouse=True)
def isolated_dependencies(monkeypatch):
    webapp.app.config.update(TESTING=True, SECRET_KEY="test-only-flask-secret")
    monkeypatch.setattr(
        webapp, "_oidc_authenticator",
        OidcAuthenticator(OidcSettings.from_env({"OIDC_ENABLED": "0"})),
    )
    monkeypatch.setattr(webapp, "db", MagicMock(return_value=MagicMock()))
    monkeypatch.setattr(
        webapp, "u8_db", MagicMock(side_effect=AssertionError("Unexpected U8 connection"))
    )


@pytest.fixture
def client():
    return webapp.app.test_client()


def login(client, role="admin"):
    with client.session_transaction() as session:
        session["admin_username"] = "test-operator"
        session["admin_role"] = role


def mock_u8(monkeypatch, *result_sets):
    cursor = MagicMock()
    pending = iter(result_sets)

    def execute(_query, _params):
        rows = next(pending)
        if isinstance(rows, Exception):
            raise rows
        fields = list(rows[0]) if rows else []
        cursor.description = [(field,) for field in fields]
        cursor.fetchall.return_value = [tuple(row[field] for field in fields) for row in rows]

    cursor.execute.side_effect = execute
    connection = MagicMock()
    connection.cursor.return_value = cursor
    monkeypatch.setattr(webapp, "u8_db", MagicMock(return_value=connection))
    return connection, cursor


@pytest.mark.parametrize("path", [BASE_URL, f"{BASE_URL}/options"])
def test_read_endpoints_require_session(client, path):
    response = client.get(path, query_string={"mo_code": "WWDD-TEST", "keyword": "WWDD"})
    assert response.status_code == 401
    webapp.u8_db.assert_not_called()


def test_print_log_requires_session_and_write_permission(client):
    assert client.post(f"{BASE_URL}/print-log", json={"mo_code": "WWDD-TEST"}).status_code == 401
    login(client, "viewer")
    assert client.post(f"{BASE_URL}/print-log", json={"mo_code": "WWDD-TEST"}).status_code == 403
    webapp.u8_db.assert_not_called()


def test_print_log_audits_session_operator_without_writing_u8(client):
    login(client)
    response = client.post(
        f"{BASE_URL}/print-log",
        json={"mo_code": "WWDD-TEST", "line_count": 2, "material_count": 3, "page_count": 2},
    )
    assert response.get_json()["code"] == 0
    query, params = webapp.db.return_value.cursor.return_value.execute.call_args.args
    assert "INSERT INTO mo_admin_audit_log_yx" in query
    assert params[0:2] == ("test-operator", "打印委外单据")
    assert params[4] == "WWDD-TEST"
    webapp.u8_db.assert_not_called()


@pytest.mark.parametrize("approved", [True, False])
def test_query_returns_separate_lines_materials_and_date_range(client, monkeypatch, approved):
    login(client, "viewer")
    rows = [
        {
            "mo_code": "WWDD-TEST", "detail_id": 1001, "line_no": 1,
            "vendor_name": "测试供应商", "dept_name": "委外部门",
            "order_date": datetime(2026, 8, 1), "inv_code": "1001",
            "inv_name": "测试产品一", "inv_std": "1200*2400", "unit_name": "张",
            "qty": Decimal("10.5"), "start_date": datetime(2026, 8, 3),
            "due_date": datetime(2026, 8, 6), "product_category": "成品",
            "remark": "第一行", "create_user": "制单人", "audit_user": "审核人" if approved else None,
            "audit_time": datetime(2026, 8, 2) if approved else None,
        },
        {
            "mo_code": "WWDD-TEST", "detail_id": 1002, "line_no": 2,
            "vendor_name": "测试供应商", "dept_name": "委外部门",
            "order_date": datetime(2026, 8, 1), "inv_code": "2001",
            "inv_name": "测试产品二", "inv_std": None, "unit_name": "张",
            "qty": Decimal("20"), "start_date": datetime(2026, 8, 2),
            "due_date": datetime(2026, 8, 9), "product_category": "半成品",
            "remark": None, "create_user": "制单人", "audit_user": "审核人" if approved else None,
            "audit_time": datetime(2026, 8, 2) if approved else None,
        },
    ]
    materials = [
        {
            "detail_id": detail_id, "order_line_no": line_no,
            "material_id": 2000 + line_no, "material_line_no": 1,
            "material_code": "M001", "material_name": "相同材料",
            "material_std": None, "unit_name": "张", "warehouse_name": "原料仓",
            "lot_no": "LOT-1", "qty_required": Decimal("12"),
        }
        for detail_id, line_no in [(1001, 1), (1002, 2)]
    ]
    connection, cursor = mock_u8(monkeypatch, rows, materials)
    response = client.get(BASE_URL, query_string={"mo_code": "WWDD-TEST"})
    assert response.status_code == 200
    body = response.get_json()
    assert body["code"] == 0
    data = body["data"]
    assert data["header"]["vendor_name"] == "测试供应商"
    assert data["header"]["start_date"] == "2026-08-02 00:00:00"
    assert data["header"]["due_date"] == "2026-08-09 00:00:00"
    assert data["header"]["total_qty"] == 30.5
    assert data["header"]["approved"] is approved
    assert data["header"]["audit_user"] == ("审核人" if approved else None)
    assert data["header"]["audit_time"] == ("2026-08-02 00:00:00" if approved else None)
    assert data["header"]["product_category"] == "成品、半成品"
    assert data["lines"][0]["start_date"] == "2026-08-03 00:00:00"
    assert data["lines"][1]["detail_id"] == 1002
    assert "qr_value" not in data["lines"][0]
    assert "lot_code" not in data["lines"][0]
    assert len(data["materials"]) == 2
    assert [row["order_line_no"] for row in data["materials"]] == [1, 2]
    assert cursor.execute.call_args_list[0].args == (webapp.OUTSOURCE_ORDER_SQL, ("WWDD-TEST",))
    assert cursor.execute.call_args_list[1].args == (webapp.OUTSOURCE_MATERIAL_SQL, ("WWDD-TEST",))
    cursor.close.assert_called_once()
    connection.close.assert_called_once()


def test_empty_order_does_not_query_materials_and_closes_connection(client, monkeypatch):
    login(client)
    connection, cursor = mock_u8(monkeypatch, [])
    response = client.get(BASE_URL, query_string={"mo_code": "NO-SUCH-ORDER"})
    assert response.get_json() == {"code": 1, "msg": "未找到委外订单", "data": None}
    assert cursor.execute.call_count == 1
    cursor.close.assert_called_once()
    connection.close.assert_called_once()


def test_order_with_no_dates_or_materials_remains_printable(client, monkeypatch):
    login(client)
    mock_u8(monkeypatch, [{
        "mo_code": "WWDD-TEST", "line_no": 1, "detail_id": 1, "qty": Decimal("1"),
        "start_date": None, "due_date": None, "audit_time": datetime(2026, 8, 1),
    }], [])
    data = client.get(BASE_URL, query_string={"mo_code": "WWDD-TEST"}).get_json()["data"]
    assert data["header"]["start_date"] is None
    assert data["header"]["due_date"] is None
    assert data["materials"] == []


def test_options_are_parameterized_and_allow_unapproved_and_closed_orders(client, monkeypatch):
    login(client)
    connection, cursor = mock_u8(monkeypatch, [{"mo_code": "WWDD-TEST"}])
    keyword = "WWDD' OR 1=1 --"
    response = client.get(f"{BASE_URL}/options", query_string={"keyword": keyword})
    assert response.get_json() == {"code": 0, "data": ["WWDD-TEST"]}
    query, params = cursor.execute.call_args.args
    assert keyword not in query
    assert "LIKE ?" in query
    assert params == (f"%{keyword}%",)
    for sql in (query, webapp.OUTSOURCE_ORDER_SQL, webapp.OUTSOURCE_MATERIAL_SQL):
        conditions = sql.partition("WHERE")[2].lower()
        assert "dverifydate" not in conditions
        assert "cverifier" not in conditions
        assert "closedate" not in sql.lower()
    assert "ma.MoDetailsID = h.MODetailsID AND ma.MOID = h.MOID" in webapp.OUTSOURCE_MATERIAL_SQL
    cursor.close.assert_called_once()
    connection.close.assert_called_once()


def test_empty_inputs_do_not_connect_to_u8(client):
    login(client)
    assert client.get(f"{BASE_URL}/options").get_json() == {"code": 0, "data": []}
    assert client.get(BASE_URL).get_json()["code"] == 1
    assert client.post(f"{BASE_URL}/print-log", json={}).status_code == 400
    webapp.u8_db.assert_not_called()


def test_query_error_uses_outsource_message_and_closes_resources(client, monkeypatch):
    login(client)
    connection, cursor = mock_u8(monkeypatch, RuntimeError("HYT00 timeout"))
    response = client.get(BASE_URL, query_string={"mo_code": "WWDD-TEST"})
    assert response.get_json() == {
        "code": 1, "msg": "已连接U8，但委外单据SQL查询超时", "data": None,
    }
    cursor.close.assert_called_once()
    connection.close.assert_called_once()
