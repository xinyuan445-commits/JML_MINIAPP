from datetime import datetime

from process_labor_report import build_process_labor_report


def test_report_calculates_elapsed_time_staffing_and_batch_details():
    snapshot = {
        "orders": [{
            "mo_code": "SCDD-TEST",
            "sort_seq": 1,
            "route_id": 8,
            "route_name": "测试路线",
            "customer_name": "客户",
            "inv_code": "P-1",
            "inv_name": "产品",
            "inv_std": "规格",
            "plan_qty": 20,
            "steps": [{
                "seq": 1,
                "process_name": "压贴",
                "station_name": "压贴一站",
                "status": "partial",
                "normal_received_qty": 20,
                "normal_done_qty": 10,
                "qty_a": 8,
                "qty_a1": 1,
                "qty_a2": 1,
                "qty_c": 0,
                "normal_remaining_qty": 10,
                "rework_remaining_qty": 0,
                "workers": ["甲"],
                "rework_workers": [],
                "first_start_time": "2026-10-28 08:00:00",
                "last_end_time": "2026-10-28 09:00:00",
                "capacity_state": "finite",
                "standard_task_minutes": 120,
                "standard_staffing": 2,
            }],
        }],
        "warnings": [],
    }
    batches = [{
        "kind": "正常",
        "record_id": 3,
        "mo_code": "SCDD-TEST",
        "sort_seq": 1,
        "route_id": 8,
        "process_seq": 1,
        "start_time": datetime(2026, 10, 28, 8),
        "complete_time": datetime(2026, 10, 28, 9),
        "qty_done": 10,
        "qty_a": 8,
        "qty_a1": 1,
        "qty_a2": 1,
        "qty_c": 0,
        "assigned_workers": "甲",
        "operator_name": "甲",
    }]

    result = build_process_labor_report(
        snapshot,
        batches,
        datetime(2026, 10, 28, 12),
    )

    row = result["rows"][0]
    assert row["process_status"] == "进行中"
    assert row["elapsed_minutes"] == 240
    assert row["time_ratio"] == 2
    assert row["staffing_status"] == "人数不足"
    assert row["issues"] == ["超过标准时间"]
    assert row["details"][0]["qty_a1"] == 1
    assert result["range"] == {"start": "2026-10-28", "end": "2026-10-28"}


def test_report_keeps_unstarted_process_without_fabricating_time_or_people():
    snapshot = {
        "orders": [{
            "mo_code": "SCDD-NEW",
            "sort_seq": 1,
            "route_id": 9,
            "route_name": "新路线",
            "steps": [{
                "seq": 1,
                "process_name": "首工序",
                "status": "pending",
                "normal_done_qty": 0,
                "rework_remaining_qty": 0,
                "workers": [],
                "rework_workers": [],
            }],
        }],
        "warnings": [],
    }

    row = build_process_labor_report(
        snapshot,
        [],
        datetime(2026, 10, 28, 12),
    )["rows"][0]
    assert row["process_status"] == "未开始"
    assert row["elapsed_minutes"] is None
    assert row["staffing_status"] == "未分配"
    assert row["issues"] == []
