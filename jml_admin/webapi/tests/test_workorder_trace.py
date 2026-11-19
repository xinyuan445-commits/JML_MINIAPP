import app as webapp


def _workorder(sort_seq=1, category="成品"):
    return {
        "MoCode_a": "SCDD26103059",
        "SortSeq_b": sort_seq,
        "DeptCode": "01",
        "cDepName": "生产部",
        "InvCode_b": "3402-01",
        "cInvName": "测试产品",
        "CategoryName": category,
        "Qty_b": 20,
        "StartDate_c": "2026-10-01",
        "DueDate_c": "2026-10-10",
    }


def test_trace_prefers_actual_route_and_marks_current_step():
    rows = webapp._build_workorder_trace_rows(
        [_workorder()],
        [{"sort_seq": 1, "route_id": 10}],
        [{"sort_seq": 1, "route_id": 20, "current_seq": 2, "status": "pending"}],
        [
            {"id": 1, "sort_seq": 1, "route_id": 20, "seq": 1, "status": "done"},
            {"id": 2, "sort_seq": 1, "route_id": 20, "seq": 2, "status": "processing"},
        ],
        {"成品": 30},
        {
            10: {"route_name": "手工路线"},
            20: {"route_name": "实际路线"},
            30: {"route_name": "类别路线"},
        },
        {
            20: [
                {"seq": 1, "process_name": "开料"},
                {"seq": 2, "process_name": "修边"},
                {"seq": 3, "process_name": "包装"},
            ]
        },
    )

    row = rows[0]
    assert row["route_id"] == 20
    assert row["route_source"] == "actual"
    assert row["status"] == "processing"
    assert row["done_process_count"] == 1
    assert row["current_process"] == "修边"
    assert row["next_process"] == "包装"
    assert [step["state"] for step in row["steps"]] == ["done", "current", "pending"]


def test_trace_shows_unstarted_category_route_and_unassigned_line():
    rows = webapp._build_workorder_trace_rows(
        [_workorder(1, "成品"), _workorder(2, "")],
        [],
        [],
        [],
        {"成品": 30},
        {30: {"route_name": "类别路线"}},
        {30: [{"seq": 1, "process_name": "开料"}]},
    )

    assert rows[0]["status"] == "not_started"
    assert rows[0]["route_source"] == "category"
    assert rows[0]["current_process"] == "开料"
    assert rows[1]["status"] == "unassigned"
    assert rows[1]["steps"] == []
