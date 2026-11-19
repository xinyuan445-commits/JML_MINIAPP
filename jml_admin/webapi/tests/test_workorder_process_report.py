from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

import app as webapp
from admin_permissions import READ_RULES


pytestmark = pytest.mark.usefixtures("legacy_admin_access")


def test_workorder_process_report_returns_all_rows_without_date_limit(monkeypatch):
    connection = MagicMock()
    cursor = connection.cursor.return_value
    cursor.fetchall.return_value = [{
        "mo_code": "SCDD26103080",
        "sort_seq": 2,
        "customer_name": "测试客户",
        "inv_code": "TEST-001",
        "inv_name": "测试产品",
        "inv_std": "1000*500",
        "route_name": "测试路线",
        "process_seq": 1,
        "process_name": "倒角",
        "station_name": "倒角",
        "process_status": "已完成",
        "worker_names": "张三",
        "start_time": datetime(2026, 10, 20, 8, 0),
        "end_time": datetime(2026, 10, 20, 9, 30),
        "duration_text": "1小时30分钟",
        "plan_qty": Decimal("9.0000"),
        "qty_done": Decimal("0.5000"),
        "qty_a": Decimal("0.5000"),
        "qty_a1": Decimal("0"),
        "qty_a2": Decimal("0"),
        "qty_c": Decimal("0"),
        "label_printed": 1,
        "print_count": 1,
        "remaining_processes": "无",
    }]
    monkeypatch.setattr(webapp, "db", lambda: connection)

    with webapp.app.test_request_context("/api/mo/workorder-process-report"):
        response = webapp.workorder_process_report()
    payload = response.get_json()

    assert payload["code"] == 0
    assert payload["total"] == 1
    assert payload["data"][0]["plan_qty"] == 9.0
    assert payload["data"][0]["start_time"] == "2026-10-20 08:00:00"
    sql = cursor.execute.call_args.args[0]
    assert "SELECT DISTINCT mo_code, sort_seq, route_id" in sql
    assert "DATE_SUB" not in sql
    assert "BETWEEN" not in sql
    connection.commit.assert_not_called()


def test_workorder_process_report_has_independent_permission():
    assert READ_RULES["/api/mo/workorder-process-report"] == {
        "workorder-process-report.view"
    }
