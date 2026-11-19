from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

import app as webapp
from admin_permissions import READ_RULES


pytestmark = pytest.mark.usefixtures("legacy_admin_access")


def _mysql_connection(rows):
    connection = MagicMock()
    cursor = connection.cursor.return_value
    cursor.fetchall.return_value = rows
    return connection


def _u8_connection(rows):
    connection = MagicMock()
    cursor = connection.cursor.return_value
    cursor.description = [
        ("mo_code",),
        ("sort_seq",),
        ("erp_in_qty",),
        ("workorder_close_reason",),
    ]
    cursor.fetchall.return_value = rows
    return connection


def test_receipt_comparison_matches_by_workorder_and_line(monkeypatch):
    mysql = _mysql_connection([
        {
            "mo_code": "SCDD26103080",
            "sort_seq": 2,
            "workorder_status": "done",
            "inv_code": "TEST-001",
            "inv_name": "测试产品",
            "inv_std": "1000*500",
            "plan_qty": Decimal("9.0000"),
            "last_process_name": "倒角",
            "final_process_end_time": datetime(2026, 10, 25, 16, 30),
            "final_process_qty": Decimal("0.5000"),
            "has_final_execution": 1,
        },
        {
            "mo_code": "SCDD26103082",
            "sort_seq": 2,
            "workorder_status": "done",
            "inv_code": "TEST-002",
            "inv_name": "测试产品2",
            "inv_std": "1200*600",
            "plan_qty": Decimal("20.0000"),
            "last_process_name": "包装",
            "final_process_end_time": datetime(2026, 10, 25, 17, 30),
            "final_process_qty": Decimal("20.0000"),
            "has_final_execution": 1,
        },
    ])
    u8 = _u8_connection([
        ("SCDD26103082", 2, Decimal("20.0000000000"), "完工关闭"),
    ])
    monkeypatch.setattr(webapp, "db", lambda: mysql)
    monkeypatch.setattr(webapp, "u8_db", lambda: u8)

    with webapp.app.test_request_context("/api/mo/receipt-comparison"):
        response = webapp.receipt_comparison()
    payload = response.get_json()

    assert payload["summary"] == {
        "total": 1,
        "consistent": 1,
        "inconsistent": 0,
    }
    assert payload["data"][0]["inv_code"] == "TEST-002"
    assert payload["data"][0]["workorder_close_reason"] == "完工关闭"
    assert payload["data"][0]["compare_result"] == "一致"
    erp_sql = u8.cursor.return_value.execute.call_args.args[0]
    assert "a.CloseDate_b IS NOT NULL" in erp_sql
    assert "FROM dbo.momlist_yx a" in erp_sql
    assert "a.Define23_b" in erp_sql
    assert "GROUP BY LTRIM(RTRIM(a.MoCode_a)), CAST(a.SortSeq_b AS INT)" in erp_sql
    assert "class='10'" in erp_sql
    assert "bRdFlag=1" in erp_sql
    assert "dVeriDate IS NOT NULL" in erp_sql
    process_sql = mysql.cursor.return_value.execute.call_args.args[0]
    assert "e.id IS NOT NULL" in process_sql
    assert "LEFT JOIN mo_workorder_context_yx ctx" in process_sql
    assert "ORDER BY e.end_time DESC, ws.mo_code DESC, ws.sort_seq DESC" in process_sql
    mysql.commit.assert_not_called()
    u8.commit.assert_not_called()


def test_receipt_comparison_filters_workorder_and_line(monkeypatch):
    mysql = _mysql_connection([{
        "mo_code": "SCDD26103082",
        "sort_seq": 2,
        "workorder_status": "done",
        "inv_code": "TEST-002",
        "inv_name": "测试产品2",
        "inv_std": "1200*600",
        "plan_qty": Decimal("20"),
        "last_process_name": "包装",
        "final_process_end_time": datetime(2026, 10, 25, 17, 30),
        "final_process_qty": Decimal("20"),
        "has_final_execution": 1,
    }])
    u8 = _u8_connection([("SCDD26103082", 2, Decimal("20"), None)])
    monkeypatch.setattr(webapp, "db", lambda: mysql)
    monkeypatch.setattr(webapp, "u8_db", lambda: u8)

    with webapp.app.test_request_context(
        "/api/mo/receipt-comparison",
        query_string={"mo_code": "SCDD26103082", "sort_seq": "2"},
    ):
        response = webapp.receipt_comparison()

    assert response.get_json()["data"][0]["is_consistent"] is True
    mysql_args = mysql.cursor.return_value.execute.call_args.args
    assert "ws.mo_code=%s" in mysql_args[0]
    assert mysql_args[1] == ("SCDD26103082", 2)
    erp_args = u8.cursor.return_value.execute.call_args.args
    assert "a.MoCode_a=? AND a.SortSeq_b=?" in erp_args[0]
    assert erp_args[1] == ("SCDD26103082", 2)


def test_receipt_comparison_keeps_closed_workorder_without_receipt(monkeypatch):
    mysql = _mysql_connection([{
        "mo_code": "SCDD26103080",
        "sort_seq": 2,
        "workorder_status": "done",
        "inv_code": "TEST-001",
        "inv_name": "测试产品",
        "inv_std": "1000*500",
        "plan_qty": Decimal("9"),
        "last_process_name": "倒角",
        "final_process_end_time": datetime(2026, 10, 25, 16, 30),
        "final_process_qty": Decimal("0.5"),
        "has_final_execution": 1,
    }])
    u8 = _u8_connection([("SCDD26103080", 2, Decimal("0"), None)])
    monkeypatch.setattr(webapp, "db", lambda: mysql)
    monkeypatch.setattr(webapp, "u8_db", lambda: u8)

    with webapp.app.test_request_context("/api/mo/receipt-comparison"):
        response = webapp.receipt_comparison()

    row = response.get_json()["data"][0]
    assert row["workorder_close_reason"] == ""
    assert row["erp_in_qty"] == 0
    assert row["difference"] == 0.5
    assert row["compare_result"] == "不一致"


def test_receipt_comparison_rejects_invalid_line_without_database_read(monkeypatch):
    mysql = MagicMock()
    erp = MagicMock()
    monkeypatch.setattr(webapp, "db", mysql)
    monkeypatch.setattr(webapp, "u8_db", erp)

    with webapp.app.test_request_context(
        "/api/mo/receipt-comparison",
        query_string={"sort_seq": "abc"},
    ):
        response, status = webapp.receipt_comparison()

    assert status == 400
    assert response.get_json()["msg"] == "工单行号格式错误"
    mysql.assert_not_called()
    erp.assert_not_called()


def test_receipt_comparison_returns_no_rows_before_final_process_completion(
    monkeypatch,
):
    mysql = _mysql_connection([])
    erp = MagicMock()
    monkeypatch.setattr(webapp, "db", lambda: mysql)
    monkeypatch.setattr(webapp, "u8_db", erp)

    with webapp.app.test_request_context("/api/mo/receipt-comparison"):
        response = webapp.receipt_comparison()

    assert response.get_json()["data"] == []
    assert "e.id IS NOT NULL" in mysql.cursor.return_value.execute.call_args.args[0]
    erp.assert_not_called()


def test_receipt_comparison_uses_report_permission():
    assert READ_RULES["/api/mo/receipt-comparison"] == {
        "receipt-comparison.view"
    }
