from datetime import datetime

import pytest

import app as webapp
from admin_permissions import READ_RULES, WRITE_RULES
from completion_flow_report import build_flow_rows


pytestmark = pytest.mark.usefixtures("legacy_admin_access")


def test_flow_rows_compare_previous_current_and_next_without_rework_duplication():
    rows = build_flow_rows(
        [
            {
                "seq": 1,
                "process_name": "压贴",
                "station_name": "压贴",
                "execution_id": 10,
                "execution_status": "done",
                "qty_done": 95,
                "qty_a": 90,
                "qty_a1": 3,
                "qty_a2": 1,
                "qty_c": 1,
                "end_time": datetime(2026, 10, 27, 8, 0),
            },
            {
                "seq": 2,
                "process_name": "倒角",
                "station_name": "倒角",
                "execution_id": 11,
                "execution_status": "done",
                "qty_done": 90,
                "qty_a": 90,
                "qty_a1": 0,
                "qty_a2": 0,
                "qty_c": 0,
            },
        ],
        [
            {"id": 1, "to_seq": 1, "status": "confirmed", "qty_in": 100},
            {"id": 2, "to_seq": 2, "status": "confirmed", "qty_in": 92},
        ],
        [],
        [{
            "id": 3,
            "seq": 1,
            "status": "processing",
            "qty_input": 3,
            "qty_a": 1,
            "qty_a1": 0,
            "qty_a2": 0,
            "qty_c": 0,
        }],
    )

    first, second = rows
    assert first["done_qty"] == 95
    assert first["transferable_qty"] == 94
    assert first["received_qty"] == 100
    assert first["completion_difference"] == 5
    assert first["next_received_qty"] == 92
    assert first["downstream_difference"] == 3
    assert first["rework_remaining_qty"] == 2
    assert first["end_time"] == "2026-10-27 08:00:00"
    assert second["previous_done_qty"] == 95
    assert second["previous_transferable_qty"] == 94
    assert second["receive_difference"] == 3


def test_flow_rows_do_not_assume_missing_handover_is_zero():
    rows = build_flow_rows(
        [{
            "seq": 1,
            "process_name": "压贴",
            "execution_id": 10,
            "execution_status": "done",
            "qty_done": 5,
            "qty_a": 5,
            "qty_a1": 0,
            "qty_a2": 0,
            "qty_c": 0,
        }],
        [],
        [],
        [],
    )
    assert rows[0]["received_qty"] is None
    assert rows[0]["completion_difference"] is None


def test_completion_flow_report_rejects_invalid_line_number():
    with webapp.app.test_request_context(
        "/api/mo/completion-flow-report?mo_code=SCDD1&sort_seq=bad"
    ):
        response, status = webapp.completion_flow_report()
    assert status == 400
    assert response.get_json()["msg"] == "生产订单行号格式错误"


def test_completion_flow_report_returns_all_completed_lines(monkeypatch):
    connection = type("Connection", (), {"close": lambda self: None})()
    monkeypatch.setattr(webapp, "db", lambda: connection)
    monkeypatch.setattr(
        webapp,
        "completed_order_lines",
        lambda conn, mo_code: [{"sort_seq": 1}, {"sort_seq": 3}],
    )
    monkeypatch.setattr(
        webapp,
        "read_completion_flow_report",
        lambda conn, mo_code, sort_seq: {
            "header": {"mo_code": mo_code, "sort_seq": sort_seq},
            "rows": [],
        },
    )

    with webapp.app.test_request_context(
        "/api/mo/completion-flow-report?mo_code=SCDD1"
    ):
        response = webapp.completion_flow_report()
    payload = response.get_json()

    assert payload["code"] == 0
    assert [row["header"]["sort_seq"] for row in payload["data"]] == [1, 3]


def test_completion_flow_report_returns_normal_empty_result(monkeypatch):
    connection = type("Connection", (), {"close": lambda self: None})()
    monkeypatch.setattr(webapp, "db", lambda: connection)
    monkeypatch.setattr(webapp, "completed_order_lines", lambda conn, mo_code: [])

    with webapp.app.test_request_context(
        "/api/mo/completion-flow-report?mo_code=SCDD1"
    ):
        response = webapp.completion_flow_report()
    payload = response.get_json()

    assert response.status_code == 200
    assert payload == {
        "code": 0,
        "msg": "该生产订单暂无末工序已完成的工单行",
        "data": [],
    }


def test_completion_flow_report_has_independent_permissions():
    for path in (
        "/api/mo/completion-flow-report/options",
        "/api/mo/completion-flow-report/lines",
        "/api/mo/completion-flow-report",
    ):
        assert READ_RULES[path] == {"completion-flow-report.view"}
    assert WRITE_RULES["/api/mo/completion-flow-report/print-authorize"] == {
        "completion-flow-report.print"
    }
