from copy import deepcopy
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch
import os

import pytest
pytestmark = pytest.mark.usefixtures("legacy_admin_access")

from dashboard_operations import (
    build_operations_snapshot,
    include_unreported_orders,
    load_operation_rows,
)


NOW = datetime(2026, 9, 7, 11, 30)
KEY = {"mo_code": "SCDD-TEST", "sort_seq": 1, "route_id": 10}


def execution(seq=1, **values):
    return {**KEY, "id": seq, "seq": seq, "process_name": f"工序{seq}",
            "station_id": seq, "station_name": f"工站{seq}", "status": "done",
            "qty_done": 0, "qty_a": 0, "qty_a1": 0, "qty_a2": 0, "qty_c": 0,
            "end_time": NOW, **values}


def handover(to_seq=1, **values):
    return {**KEY, "id": to_seq, "from_seq": to_seq - 1, "to_seq": to_seq,
            "status": "confirmed", "qty_out": 10, "qty_in": 10,
            "qty_out_a": 10, "qty_out_a1": 0, "qty_out_a2": 0, **values}


def report(execution_id=1, kind="normal", qty=7, **values):
    return {"date": date(2026, 9, 7), "kind": kind, "execution_id": execution_id,
            "qty": qty, "qty_a": qty, "qty_a1": 0, "qty_a2": 0, "qty_c": 0,
            "batch_count": 1, **values}


def snapshot(**data):
    rows = {"states": [{**KEY, "status": "done"}],
            "routes": [{"id": 10, "route_name": "测试路线", "dept_name": "生产部"}],
            "steps": [{"route_id": 10, "seq": 1, "process_id": 1, "process_name": "工序1"},
                      {"route_id": 10, "seq": 2, "process_id": 2, "process_name": "工序2"}],
            "executions": [execution(qty_done=7, qty_a=7)],
            "handovers": [handover()], **data}
    products = rows.pop("products", {("SCDD-TEST", 1): {
        "inv_name": "测试产品", "plan_qty": 20, "plan_due_date": "2026-09-06",
        "unit_name": "张", "first_issued_qty": 25,
        "first_issue_calculation": {
            "mode": "bom_ratio",
            "material_count": 2,
            "bottleneck_inv_code": "4402-TEST",
            "bottleneck_required_qty": Decimal("40"),
            "bottleneck_issued_qty": Decimal("20"),
            "bottleneck_ratio": Decimal("0.5"),
        },
    }})
    return build_operations_snapshot(rows, products, NOW)


def test_partial_done_plus_new_receive_retains_old_unfinished_quantity():
    receives = [{**KEY, "id": 7, "seq": 1, "status": "processing", "qty_input": 12}]
    result = snapshot(receives=receives)
    row = result["orders"][0]
    step = row["steps"][0]
    assert step["normal_received_qty"] == 22
    assert step["normal_done_qty"] == 7
    assert step["normal_remaining_qty"] == 15
    assert step["receiving_qty"] == 12
    assert step["receive_available_qty"] == 3
    assert step["qty_a"] == 7
    assert step["qty_a1"] == 0
    assert step["qty_a2"] == 0
    assert step["qty_c"] == 0
    assert step["status"] == "partial"
    assert step["is_first_step"] is True
    assert step["first_issued_qty"] == 25
    assert step["first_issue_calculation"]["bottleneck_inv_code"] == "4402-TEST"
    assert row["has_work"] and row["is_active"] and row["is_overdue"]


def test_customer_and_source_order_are_kept_in_report_rows():
    result = snapshot(products={("SCDD-TEST", 1): {
        "inv_name": "测试产品",
        "plan_qty": 20,
        "plan_start_date": "2026-09-01",
        "plan_due_date": "2026-09-07",
        "original_start_date": "2026-08-30",
        "original_due_date": "2026-09-07",
        "first_issued_qty": 20,
        "so_code_008": "XSDD008",
        "so_row_008": 8,
        "source_account": "001",
        "source_so_code": "XSDD261094843",
        "customer_code": "0728",
        "customer_name": "测试客户",
        "is_closed": True,
    }})

    row = result["orders"][0]
    assert (row["so_code_008"], row["so_row_008"]) == ("XSDD008", 8)
    assert row["source_account"] == "001"
    assert row["source_so_code"] == "XSDD261094843"
    assert row["customer_code"] == "0728"
    assert row["customer_name"] == "测试客户"
    assert row["plan_start_date"] == "2026-09-01"
    assert row["original_start_date"] == "2026-08-30"
    assert row["original_due_date"] is None
    assert row["is_closed"] is True


def test_snapshot_marks_workorder_deleted_from_erp():
    result = snapshot(products={('SCDD-TEST', 1): {
        "erp_deleted": True,
        "first_issued_qty": None,
    }})
    assert result["orders"][0]["erp_deleted"] is True


@pytest.mark.parametrize("reserved,available", [(0, 10), (4, 6)])
def test_next_station_receives_only_good_output_after_reservations(reserved, available):
    result = snapshot(
        executions=[execution(qty_done=20, qty_a=19, qty_c=1), execution(2, qty_done=0)],
        handovers=[handover(qty_in=20), handover(2, qty_out=19, qty_out_a=19, qty_in=9)],
        receives=[{**KEY, "id": 9, "seq": 2, "status": "processing", "qty_input": reserved}],
    )
    step = result["orders"][0]["steps"][1]
    assert step["receive_available_qty"] == available


def test_step_exposes_only_good_output_as_transferable_quantity():
    result = snapshot(
        executions=[execution(qty_done=20, qty_a=16, qty_a1=2, qty_a2=1, qty_c=1)],
    )
    assert result["orders"][0]["steps"][0]["transferable_qty"] == 19


def test_step_uses_first_start_and_last_batch_completion_time():
    result = snapshot(
        executions=[execution(
            start_time=datetime(2026, 9, 6, 8, 15),
            end_time=datetime(2026, 9, 6, 12, 0),
            qty_done=20,
            qty_a=20,
        )],
        normal_coverage=[{
            "execution_id": 1,
            "qty": 20,
            "first_complete_time": datetime(2026, 9, 6, 10, 0),
            "last_complete_time": datetime(2026, 9, 6, 14, 30),
        }],
    )
    step_row = result["orders"][0]["steps"][0]
    assert step_row["first_start_time"] == "2026-09-06 08:15:00"
    assert step_row["last_end_time"] == "2026-09-06 14:30:00"


def test_step_converts_received_quantity_to_standard_task_minutes():
    result = snapshot(
        capacities=[{
            "station_id": 1, "station_name": "工站1", "device_enabled": 1,
            "id": 8, "process_id": 1, "category_code": "", "capacity_mode": "finite",
            "quantity": 400, "unit": "张", "period": "day", "effective_hours": 8,
            "is_active": 1,
        }],
        product_categories=[],
    )
    step_row = result["orders"][0]["steps"][0]
    assert step_row["capacity_state"] == "finite"
    assert step_row["capacity_unit"] == "张"
    assert step_row["standard_unit_minutes"] == 1.2
    assert step_row["standard_task_minutes"] == 12


def test_step_keeps_unlimited_capacity_without_standard_time():
    result = snapshot(capacities=[{
        "station_id": 1, "station_name": "工站1", "device_enabled": 1,
        "id": 9, "process_id": 1, "category_code": "", "capacity_mode": "unlimited",
        "quantity": None, "unit": "", "period": None, "effective_hours": None,
        "is_active": 1,
    }])
    step_row = result["orders"][0]["steps"][0]
    assert step_row["capacity_state"] == "unlimited"
    assert step_row["standard_task_minutes"] is None


def test_step_uses_process_capacity_unit_without_cross_unit_factor():
    result = snapshot(capacities=[{
        "station_id": 1, "station_name": "工站1", "device_enabled": 1,
        "id": 10, "process_id": 1, "category_code": "", "capacity_mode": "finite",
        "quantity": 400, "unit": "面", "period": "day", "effective_hours": 8,
        "is_active": 1,
    }])
    step_row = result["orders"][0]["steps"][0]
    assert step_row["capacity_state"] == "finite"
    assert step_row["capacity_unit"] == "面"
    assert step_row["standard_task_minutes"] == 12


def test_legacy_handover_total_never_carries_c_to_next_step():
    result = snapshot(
        executions=[execution(qty_done=20, qty_a=0, qty_c=20)],
        handovers=[handover(), handover(2, qty_out=20, qty_out_a=0, qty_in=0)],
    )
    assert result["orders"][0]["steps"][1]["receive_available_qty"] == 0


def test_completed_receives_are_already_in_handover_and_not_added_again():
    result = snapshot(
        executions=[execution(qty_done=20, qty_a=19, qty_c=1)],
        handovers=[handover(qty_in=20)],
        receives=[{**KEY, "id": 7, "seq": 1, "status": "done", "qty_input": 10}],
    )
    step = result["orders"][0]["steps"][0]
    assert step["normal_received_qty"] == 20
    assert step["normal_remaining_qty"] == 0


@pytest.mark.parametrize("rework_input,remaining", [(5, 2), (7, 4)])
def test_partial_rework_and_append_do_not_increase_normal_output(rework_input, remaining):
    result = snapshot(
        executions=[execution(qty_done=20, qty_a=17, qty_c=3)],
        handovers=[handover(qty_in=20)],
        reworks=[{**KEY, "id": 5, "seq": 1, "status": "processing", "qty_input": rework_input,
                  "qty_a": 2, "qty_a1": 0, "qty_a2": 0, "qty_c": 1}],
        daily=[report(qty=20), report(kind="rework", qty=3, qty_a=2, qty_c=1)],
    )
    step = result["orders"][0]["steps"][0]
    assert step["normal_done_qty"] == 20
    assert step["rework_remaining_qty"] == remaining
    assert result["orders"][0]["has_rework"]
    assert {row["kind"]: row["qty"] for row in result["daily"]} == {"normal": 20, "rework": 3}


def test_daily_uses_batch_dates_not_mirrored_receive_or_execution_total():
    result = snapshot(
        executions=[execution(qty_done=12, qty_a=12)],
        daily=[report(qty=5, date=date(2026, 9, 6)), report(qty=7), report(kind="rework", qty=2)],
        receives=[{**KEY, "id": 7, "seq": 1, "status": "done", "qty_input": 7, "end_time": NOW}],
        normal_coverage=[{"execution_id": 1, "qty": 12}],
    )
    today = {row["kind"]: row for row in result["daily"] if row["date"] == "2026-09-07"}
    assert today["normal"]["qty"] == 7
    assert today["normal"]["batch_count"] == 1
    assert today["rework"]["qty"] == 2


def test_historical_cumulative_gap_is_warning_not_fabricated_daily_output():
    result = snapshot(executions=[execution(qty_done=30, qty_a=30)],
                      normal_coverage=[{"execution_id": 1, "qty": 8}], daily=[report(qty=8)])
    assert result["orders"][0]["steps"][0]["normal_done_qty"] == 30
    assert result["daily"][0]["qty"] == 8
    assert any("缺少完整分批明细" in text for text in result["warnings"])


def test_workers_are_selected_workers_not_operator_and_exclude_old_receives():
    result = snapshot(
        executions=[execution(qty_done=7, operator_name="操作账号")],
        receives=[{**KEY, "id": 3, "seq": 1, "status": "done", "qty_input": 1},
                  {**KEY, "id": 4, "seq": 1, "status": "processing", "qty_input": 2}],
        workers=[{"source": "execution", "source_id": 1, "user_name": "开工甲"},
                 {"source": "receive", "source_id": 3, "user_name": "历史乙"},
                 {"source": "receive", "source_id": 4, "user_name": "开工丙"}],
    )
    assert set(result["orders"][0]["steps"][0]["workers"]) == {"开工甲", "开工丙"}


def test_first_receipt_without_state_or_execution_remains_visible():
    result = snapshot(states=[], executions=[])
    assert len(result["orders"]) == 1
    step = result["orders"][0]["steps"][0]
    assert step["status"] == "received"
    assert step["normal_remaining_qty"] == 10
    assert step["station_id"] is None


def test_open_unreported_order_is_added_read_only_and_marked():
    data = {
        "states": [],
        "bindings": [{"mo_code": "SCDD-NEW", "sort_seq": 2, "route_id": 10}],
        "routes": [{"id": 10, "route_name": "测试路线", "dept_name": "生产部"}],
        "steps": [{"route_id": 10, "seq": 1, "process_id": 1, "process_name": "工序1"}],
    }
    products = {("SCDD-NEW", 2): {
        "erp_open": True,
        "inv_name": "待生产产品",
        "plan_qty": 20,
        "plan_due_date": "2026-09-08",
    }}

    include_unreported_orders(data, products)
    result = build_operations_snapshot(data, products, NOW)

    assert data["states"] == [{
        "mo_code": "SCDD-NEW",
        "sort_seq": 2,
        "route_id": 10,
        "status": "pending",
        "update_time": None,
        "synthetic": True,
    }]
    assert result["orders"][0]["has_reporting"] is False
    assert result["orders"][0]["is_active"] is True
    assert result["orders"][0]["steps"][0]["status"] == "pending"


def test_unavailable_erp_does_not_make_first_station_available_zero():
    result = snapshot(products={})
    row = result["orders"][0]
    assert row["steps"][0]["receive_available_qty"] is None
    assert row["steps"][0]["normal_remaining_qty"] == 3
    assert row["plan_qty"] is None
    assert row["unit_name"] == "未标单位"
    assert result["warnings"]


def test_latest_handover_wins_without_summing_previous_confirmations():
    result = snapshot(handovers=[handover(id=8, qty_in=99), handover(id=9, qty_in=10)])
    assert result["orders"][0]["steps"][0]["normal_received_qty"] == 10


def test_final_partial_work_stays_active_even_when_old_state_is_done():
    result = snapshot(
        executions=[execution(qty_done=20), execution(2, qty_done=7)],
        handovers=[handover(qty_in=20), handover(2, qty_in=10)],
    )
    row = result["orders"][0]
    assert row["plan_shortfall_qty"] == 13
    assert row["is_active"] and row["has_work"]
    assert row["steps"][1]["normal_remaining_qty"] == 3


def test_final_flag_means_route_last_step_not_final_batch():
    result = snapshot(executions=[execution(), execution(2)],
                      daily=[report(execution_id=1), report(execution_id=2)])
    flags = {row["process_name"]: row["is_final"] for row in result["daily"]}
    assert flags == {"工序1": False, "工序2": True}


def test_unknown_receipts_do_not_hide_old_done_workorder_from_attention():
    result = snapshot(executions=[execution(qty_done=20), execution(2, qty_done=20)], handovers=[])
    row = result["orders"][0]
    assert row["plan_shortfall_qty"] == 0
    assert row["steps"][0]["normal_remaining_qty"] is None
    assert row["is_active"]


@pytest.mark.parametrize("receipt_known,has_work,status", [
    (True, False, "received_done"),
    (False, True, "processing"),
])
def test_processing_state_only_falls_back_when_remaining_is_unknown(receipt_known, has_work, status):
    result = snapshot(
        executions=[execution(qty_done=10, qty_a=10, status="processing")],
        handovers=[handover(qty_in=10)] if receipt_known else [],
    )
    row = result["orders"][0]
    assert row["has_work"] is has_work
    assert row["steps"][0]["status"] == status
    assert row["steps"][0]["normal_remaining_qty"] == (0 if receipt_known else None)


def test_quantity_precision_and_input_immutability():
    source = {"executions": [execution(qty_done=Decimal("7.0001"))],
              "handovers": [handover(qty_in=Decimal("10.0002"))]}
    original = deepcopy(source)
    result = snapshot(**source)
    assert result["orders"][0]["steps"][0]["normal_remaining_qty"] == 3.0001
    assert source == original


def test_loader_is_read_only_batched_and_uses_completion_timestamps():
    connection = MagicMock()
    cursor = connection.cursor.return_value
    cursor.fetchall.return_value = []
    load_operation_rows(connection, NOW)
    queries = [call.args[0] for call in cursor.execute.call_args_list]
    assert len(queries) == 16
    assert all(query.strip().startswith("SELECT") for query in queries)
    assert "mo_execution_completion_yx" in queries[-1]
    assert "mo_rework_completion_yx" in queries[-1]
    assert "complete_time" in queries[-1]
    assert "end_time" not in queries[-1]
    connection.commit.assert_not_called()


os.environ.setdefault("FLASK_SECRET_KEY", "test-only-flask-secret")
with patch("dotenv.load_dotenv", return_value=False), patch(
    "mysql.connector.pooling.MySQLConnectionPool", return_value=MagicMock()
):
    import app as webapp


def test_product_info_accepts_synchronized_customer_context():
    result = webapp._product_info({
        "inv_code": "PRODUCT-1",
        "inv_name": "测试产品",
        "inv_std": "1220*2745",
        "plan_qty": Decimal("20"),
        "so_code_008": "XSDD008",
        "so_row_008": 8,
        "source_account": "001",
        "source_so_code": "XSDD261094843",
        "customer_code": "0728",
        "customer_name": "测试客户",
        "CloseDate_b": datetime(2026, 10, 20),
    })

    assert result["inv_code"] == "PRODUCT-1"
    assert result["source_account"] == "001"
    assert result["source_so_code"] == "XSDD261094843"
    assert result["customer_name"] == "测试客户"
    assert result["is_closed"] is True


def test_dashboard_marks_missing_key_deleted_only_after_successful_erp_lookup(monkeypatch):
    connection = MagicMock()
    cursor = connection.cursor.return_value
    cursor.description = [("MoCode_a",), ("SortSeq_b",)]
    cursor.fetchall.return_value = []
    monkeypatch.setattr(webapp, "u8_db", lambda: connection)
    monkeypatch.setattr(webapp, "_report_workorder_context", lambda _rows: {})

    products, warnings = webapp._dashboard_product_context([
        {"mo_code": "SCDD-DELETED", "sort_seq": 3},
    ])

    assert warnings == []
    assert products[("SCDD-DELETED", 3)]["erp_deleted"] is True


def test_dashboard_does_not_claim_deletion_when_erp_lookup_fails(monkeypatch):
    monkeypatch.setattr(webapp, "u8_db", MagicMock(side_effect=RuntimeError("offline")))
    monkeypatch.setattr(webapp, "_workorder_info_map", lambda: ({}, False))
    monkeypatch.setattr(webapp, "_report_workorder_context", lambda _rows: {})

    products, warnings = webapp._dashboard_product_context([
        {"mo_code": "SCDD-UNKNOWN", "sort_seq": 1},
    ])

    assert products == {}
    assert warnings


def test_dashboard_email_keeps_unreported_open_orders():
    orders = [{
        "mo_code": "SCDD-NEW",
        "is_closed": False,
        "has_reporting": False,
        "steps": [],
    }]
    assert webapp._dashboard_email_orders(orders) == orders


def test_photo_urls_support_quality_report_json_and_legacy_values():
    assert webapp._photo_urls('["one.jpg", "two.jpg"]') == [
        "one.jpg",
        "two.jpg",
    ]
    assert webapp._photo_urls("one.jpg,two.jpg") == ["one.jpg", "two.jpg"]
    assert webapp._photo_urls(None) == []


def test_dashboard_is_public_without_login(monkeypatch):
    from oidc_auth import OidcAuthenticator, OidcSettings
    monkeypatch.setattr(webapp, "_oidc_authenticator", OidcAuthenticator(OidcSettings.from_env({"OIDC_ENABLED": "0"})))
    database = MagicMock()
    monkeypatch.setattr(webapp, "db", database)
    monkeypatch.setattr(webapp, "load_operation_rows", lambda *_args: {})
    monkeypatch.setattr(webapp, "_workorder_info_map", lambda: ({}, True))
    monkeypatch.setattr(webapp, "_dashboard_product_context", lambda _rows: ({}, []))
    response = webapp.app.test_client().get("/api/mo/dashboard/operations")
    assert response.status_code == 200
    assert response.get_json()["data"]["orders"] == []
    database.assert_called_once()


def test_dashboard_uses_beijing_date_after_midnight(monkeypatch):
    class FixedDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            instant = cls(2026, 11, 14, 16, 30, tzinfo=timezone.utc)
            return instant.astimezone(tz) if tz else instant.replace(tzinfo=None)

    monkeypatch.setattr(webapp, "datetime", FixedDatetime)
    snapshot = MagicMock(side_effect=lambda now: {"today": now.date().isoformat()})
    monkeypatch.setattr(webapp, "_current_operations_snapshot", snapshot)

    response = webapp.app.test_client().get("/api/mo/dashboard/operations")
    assert response.get_json()["data"]["today"] == "2026-11-15"
    snapshot.assert_called_once_with(datetime(2026, 11, 15, 0, 30))


def test_schedule_preview_requires_exact_admin_user(monkeypatch):
    from oidc_auth import OidcAuthenticator, OidcSettings
    monkeypatch.setattr(webapp, "_oidc_authenticator", OidcAuthenticator(OidcSettings.from_env({"OIDC_ENABLED": "0"})))

    anonymous = webapp.app.test_client().get("/api/mo/dashboard/schedule-preview")
    assert anonymous.status_code == 401

    viewer = webapp.app.test_client()
    with viewer.session_transaction() as values:
        values["admin_username"] = "viewer"
        values["admin_role"] = "admin"
    forbidden = viewer.get("/api/mo/dashboard/schedule-preview")
    assert forbidden.status_code == 403
    assert forbidden.get_json()["msg"] == "工序进度暂仅限admin用户查看"

    connection = MagicMock()
    monkeypatch.setattr(webapp, "db", lambda: connection)
    monkeypatch.setattr(webapp, "_current_operations_snapshot", lambda _now: {"orders": []})
    monkeypatch.setattr(webapp, "build_schedule_preview", lambda *_args: {"tasks": []})
    admin = webapp.app.test_client()
    with admin.session_transaction() as values:
        values["admin_username"] = "admin"
        values["admin_role"] = "admin"
    allowed = admin.get("/api/mo/dashboard/schedule-preview")
    assert allowed.status_code == 200
    assert allowed.get_json()["data"] == {"tasks": []}


def test_dashboard_fills_unreported_order_customer_from_open_order_list(monkeypatch):
    from oidc_auth import OidcAuthenticator, OidcSettings
    monkeypatch.setattr(webapp, "_oidc_authenticator", OidcAuthenticator(OidcSettings.from_env({"OIDC_ENABLED": "0"})))
    key = ("SCDD26103081", 1)
    database = MagicMock()
    monkeypatch.setattr(webapp, "db", database)
    monkeypatch.setattr(webapp, "load_operation_rows", lambda *_args: {})
    monkeypatch.setattr(webapp, "_workorder_info_map", lambda: ({key: {
        "MoCode_a": key[0],
        "SortSeq_b": key[1],
        "SOCode008": "XSDD261012784",
        "SORow008": 1,
        "SourceAccount": "001",
        "SourceSOCode": "XSDD261014846",
        "CustomerCode": "0753",
        "CustomerName": "上海威禄文信智能科技有限公司",
    }}, True))
    monkeypatch.setattr(webapp, "_dashboard_product_context", lambda _rows: ({key: {
        "customer_code": "",
        "customer_name": "",
        "so_code_008": "",
        "so_row_008": None,
        "source_account": "",
        "source_so_code": "",
    }}, []))
    monkeypatch.setattr(webapp, "include_unreported_orders", lambda *_args: None)
    monkeypatch.setattr(
        webapp,
        "build_operations_snapshot",
        lambda _data, products, _now, _warnings: {"order": products[key]},
    )

    response = webapp.app.test_client().get("/api/mo/dashboard/operations")

    assert response.status_code == 200
    order = response.get_json()["data"]["order"]
    assert order["so_code_008"] == "XSDD261012784"
    assert order["so_row_008"] == 1
    assert order["source_account"] == "001"
    assert order["source_so_code"] == "XSDD261014846"
    assert order["customer_code"] == "0753"
    assert order["customer_name"] == "上海威禄文信智能科技有限公司"


def test_dashboard_read_session_returns_snapshot_and_does_not_commit(monkeypatch):
    from oidc_auth import OidcAuthenticator, OidcSettings
    monkeypatch.setattr(webapp, "_oidc_authenticator", OidcAuthenticator(OidcSettings.from_env({"OIDC_ENABLED": "0"})))
    database = MagicMock()
    monkeypatch.setattr(webapp, "db", database)
    monkeypatch.setattr(webapp, "load_operation_rows", lambda *_args: {})
    monkeypatch.setattr(webapp, "_workorder_info_map", lambda: ({}, True))
    monkeypatch.setattr(webapp, "_dashboard_product_context", lambda _rows: ({}, []))
    client = webapp.app.test_client()
    with client.session_transaction() as session:
        session["admin_username"] = "viewer"
        session["admin_role"] = "viewer"
    response = client.get("/api/mo/dashboard/operations")
    assert response.status_code == 200
    assert response.get_json()["data"]["orders"] == []
    database.return_value.start_transaction.assert_called_once_with(
        isolation_level="REPEATABLE READ", consistent_snapshot=True, readonly=True)
    database.return_value.commit.assert_not_called()


def test_active_detail_allows_receipt_before_execution_or_state_exists(monkeypatch):
    connection = MagicMock()
    cursor = connection.cursor.return_value
    cursor.fetchone.side_effect = [None, {"route_id": 10, "status": "pending"}, {
        **KEY, "route_name": "测试路线", "dept_name": "生产部", "workorder_status": "pending",
        "start_time": None, "end_time": None, "duration_seconds": None,
        "process_count": 2, "done_process_count": 0, "operator_names": "",
        "reason_count": 0, "max_qty_c": 0, "print_count": 0,
        "final_execution_id": None, "final_process_name": None,
    }]
    cursor.fetchall.return_value = []
    monkeypatch.setattr(webapp, "db", lambda: connection)
    monkeypatch.setattr(webapp, "_workorder_info_map", lambda: ({}, False))
    monkeypatch.setattr(webapp, "_supplement_historical_workorder_info", lambda *_args: False)
    with webapp.app.test_request_context("/api/mo/completed-workorder/detail", query_string={
        "mo_code": "SCDD-TEST", "sort_seq": 1, "include_active": 1,
    }):
        result = webapp.completed_workorder_detail().get_json()
    assert result["code"] == 0
    assert result["data"]["processes"] == []
    assert result["data"]["workorder_status"] == "pending"
    query = cursor.execute.call_args_list[-1].args[0]
    assert "execution.status='done'" not in query
    connection.commit.assert_not_called()


def test_default_completed_detail_keeps_original_completion_filter(monkeypatch):
    connection = MagicMock()
    cursor = connection.cursor.return_value
    cursor.fetchone.return_value = None
    monkeypatch.setattr(webapp, "db", lambda: connection)
    with webapp.app.test_request_context("/api/mo/completed-workorder/detail", query_string={
        "mo_code": "SCDD-TEST", "sort_seq": 1,
    }):
        result = webapp.completed_workorder_detail().get_json()
    assert result["code"] == 1
    assert "final_exec.status='done'" in cursor.execute.call_args.args[0]
    connection.commit.assert_not_called()
