from datetime import datetime
from unittest.mock import MagicMock

import production_scheduling as scheduling
from production_scheduling import _allocate, _calendar_slots


def _calendar():
    weeks = [
        {"weekday": day, "intervals": [["08:00", "12:00"], ["13:00", "17:00"]] if day <= 5 else []}
        for day in range(1, 8)
    ]
    return {
        "periods": [
            {
                "start_month_day": "01-01",
                "end_month_day": "12-31",
                "weeks": weeks,
            }
        ],
        "exceptions": [],
    }


def test_calendar_uses_exception_before_week_template():
    calendar = _calendar()
    calendar["exceptions"] = [
        {
            "work_date": "2026-10-30",
            "exception_type": "rest",
            "intervals": [],
        }
    ]
    assert _calendar_slots(calendar, datetime(2026, 10, 30).date()) == []


def test_allocate_skips_lunch_and_existing_booking():
    calendar = _calendar()
    bookings = [(datetime(2026, 10, 30, 8), datetime(2026, 10, 30, 9))]
    segments = _allocate(_calendar_slots(calendar, datetime(2026, 10, 30).date()),
                         datetime(2026, 10, 30, 8), datetime(2026, 10, 30, 17), 240, bookings)
    assert segments == [
        (datetime(2026, 10, 30, 9), datetime(2026, 10, 30, 12)),
        (datetime(2026, 10, 30, 13), datetime(2026, 10, 30, 14)),
    ]


def test_allocate_does_not_resume_after_another_job():
    day = datetime(2026, 10, 30)
    slots = _calendar_slots(_calendar(), day.date())
    booking = [(day.replace(hour=9), day.replace(hour=10))]
    result = _allocate(slots, day.replace(hour=8), day.replace(hour=17), 120, booking)
    assert result == [(day.replace(hour=10), day.replace(hour=12))]


def _order(code, due, steps, **kwargs):
    return {"mo_code": code, "sort_seq": 1, "route_id": 1, "plan_qty": 10,
            "plan_due_date": due, "steps": steps, **kwargs}


def _step(seq, station, unit_minutes, **kwargs):
    return {"seq": seq, "station_id": station, "process_name": f"工序{seq}",
            "capacity_state": "finite", "standard_unit_minutes": unit_minutes, **kwargs}


def _preview(monkeypatch, orders, direction="forward", policy="due-date", handovers=()):
    now = datetime(2026, 10, 30, 9)
    monkeypatch.setattr(scheduling, "_load_calendars", lambda *_a, **_k: [
        {**_calendar(), "id": 1, "calendar_name": "日历", "is_default": True}
    ])
    monkeypatch.setattr(scheduling, "_schedule_policies", lambda *_a, **_k: [
        {"id": 1, "policy_code": policy, "policy_name": policy, "description": "",
         "is_default": True, "rules": []}
    ])
    monkeypatch.setattr(scheduling, "_load_handover_settings", lambda _cur: handovers)
    conn = MagicMock()
    conn.cursor.return_value.fetchall.side_effect = [[
        {"route_id": 1, "seq": 1, "process_id": 5}, {"route_id": 1, "seq": 2, "process_id": 6},
    ], []]
    return scheduling.build_schedule_preview(conn, {"orders": orders}, now, direction=direction)


def test_reverse_uses_route_override_and_late_orders_fall_back(monkeypatch):
    route_rule = {"route_id": 1, "from_process_id": 5, "to_process_id": 6, "minutes": 20, "is_active": True}
    global_rule = {**route_rule, "route_id": 0, "minutes": 90}
    preview = _preview(monkeypatch, [
        _order("NORMAL", "2026-10-30 00:00:00", [_step(1, 1, 6), _step(2, 2, 3)]),
        _order("LATE", "2026-10-30 09:20:00", [_step(1, 1, 6), _step(2, 2, 3)]),
    ], "backward", handovers=[global_rule, route_rule])
    rows = {task["key"]: task for task in preview["tasks"]}
    assert rows["NORMAL:1:1"]["schedule_start"] == "2026-10-30 15:10:00"
    assert rows["NORMAL:1:2"]["schedule_start"] == "2026-10-30 16:30:00"
    assert rows["NORMAL:1:2"]["handover_minutes"] == 20
    assert rows["LATE:1:1"]["schedule_start"] == "2026-10-30 09:00:00"
    assert rows["LATE:1:2"]["schedule_end"] == "2026-10-30 10:50:00"
    assert rows["LATE:1:2"]["schedule_direction"] == "forward-fallback"
    assert rows["LATE:1:2"]["is_late"]


def test_efficiency_protects_an_order_that_would_miss_its_deadline(monkeypatch):
    urgent = _order("URGENT", "2026-10-30 10:00:00", [_step(1, 1, 6)])
    short = _order("SHORT", "2026-11-02", [_step(1, 1, 1)])
    preview = _preview(monkeypatch, [short, urgent], policy="efficiency")
    assert [task["mo_code"] for task in preview["tasks"]] == ["URGENT", "SHORT"]
    relaxed = {**urgent, "plan_due_date": "2026-10-30 12:00:00"}
    preview = _preview(monkeypatch, [short, relaxed], policy="efficiency")
    assert [task["mo_code"] for task in preview["tasks"]] == ["SHORT", "URGENT"]


def test_started_work_reserves_device_and_handover_skips_lunch(monkeypatch):
    active = _order("ACTIVE", "2026-10-30", [
        _step(1, 1, 17, has_active_execution=True, first_start_time="2026-10-30 08:45:00"),
        _step(2, 2, 3),
    ])
    other = _order("EARLY", "2026-10-30 10:00:00", [_step(1, 1, 3)])
    preview = _preview(monkeypatch, [other, active], handovers=[
        {"route_id": 0, "from_process_id": 5, "to_process_id": 6, "minutes": 20, "is_active": True}
    ])
    rows = {task["key"]: task for task in preview["tasks"]}
    assert rows["EARLY:1:1"]["schedule_start"] == "2026-10-30 11:50:00"
    assert rows["ACTIVE:1:2"]["schedule_start"] == "2026-10-30 13:10:00"


def test_unlimited_step_still_observes_the_handover(monkeypatch):
    second = {**_step(2, 2, None), "capacity_state": "unlimited"}
    order = _order("PANEL", "2026-10-30", [_step(1, 1, 6), second])
    rule = {"route_id": 0, "from_process_id": 5, "to_process_id": 6, "minutes": 20, "is_active": True}
    preview = _preview(monkeypatch, [order], handovers=[rule])
    milestone = preview["tasks"][1]
    assert milestone["type"] == "milestone"
    assert milestone["schedule_start"] == milestone["schedule_end"] == "2026-10-30 10:20:00"
    assert milestone["segments"] == []
    assert milestone["handover_missing"] is False


def test_new_handover_rule_does_not_reject_two_already_completed_steps(monkeypatch):
    order = _order("HISTORY", "2026-10-30", [
        _step(1, 1, 6, normal_done_qty=10, first_start_time="2026-10-30 07:45:00",
              last_end_time="2026-10-30 08:00:00"),
        _step(2, 2, 3, normal_done_qty=10, first_start_time="2026-10-30 08:00:00",
              last_end_time="2026-10-30 08:30:00"),
        _step(3, 3, 3),
    ])
    rule = {"route_id": 0, "from_process_id": 5, "to_process_id": 6, "minutes": 20, "is_active": True}
    preview = _preview(monkeypatch, [order], handovers=[rule])
    assert not preview["unscheduled"]
    assert preview["tasks"][2]["schedule_start"] == "2026-10-30 09:00:00"
