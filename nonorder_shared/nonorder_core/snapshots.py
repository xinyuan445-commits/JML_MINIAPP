"""Cutoff reconstruction; worker wiring and mixed daily plans belong to stage 5."""
from datetime import datetime, time, timedelta
from .service import moment, require
from .storage import plain


def calculate(store, work_date):
    start = datetime.combine(work_date, time.min)
    cutoff = start + timedelta(days=1)
    as_of = min(cutoff, store.now())
    states, activity = {}, {}
    for e in store.rows("event"):
        if e["occurred_at"] < as_of:
            states[e["task_id"]] = e["data"]["snapshot"]
        if start <= e["occurred_at"] < as_of and e["event_type"] in {"submit", "review", "correct_time"}:
            record = e["data"].get("record") or {}
            work_submitted_at = record.get("payload", {}).get("work_submitted_at")
            work_submission = e["event_type"] == "submit" and (
                not work_submitted_at or start <= moment(work_submitted_at) < as_of)
            activity.setdefault(e["task_id"], []).append({**{k: plain(e[k]) for k in ("id", "event_type", "occurred_at", "staff_id")},
                "assignment_id": e["data"].get("assignment_id"), "record_id": record.get("id"), "work_submission": work_submission})
    rows = []
    for task_id, state in states.items():
        # A snapshot stores raw and corrected intervals as they were at this cutoff.
        for a in state["assignment"]:
            seconds, segments = 0, []
            for segment in state["time_segment"]:
                if segment["assignment_id"] != a["id"] or segment["superseded_by_correction_id"]:
                    continue
                left = max(start, moment(segment["started_at"]))
                right = min(as_of, moment(segment["ended_at"]) if segment["ended_at"] else as_of)
                if left < right:
                    seconds += (right - left).total_seconds()
                    segments.append({**segment, "day_started_at": left.isoformat(), "day_ended_at": right.isoformat()})
            personal_events = [e for e in activity.get(task_id, []) if e["assignment_id"] == a["id"]]
            all_plans = [r for r in state.get("daily_item", []) if r["assignment_id"] == a["id"]]
            plans = [r for r in all_plans if r["work_date"] == work_date.isoformat()]
            effective = [r for r in all_plans if r["status"] == "published" and r["published_at"] and not r["cancelled_at"]]
            published = [r for r in effective if r["work_date"] == work_date.isoformat()]
            cancelled = [r for r in plans if r["cancelled_at"]]
            has_execution = bool(seconds or any(e["work_submission"] for e in personal_events))
            require(len(published) <= 1, "同日安排归属不唯一")
            if seconds or personal_events or published:
                division = next(d for d in state["division"] if d["id"] == a["division_id"])
                rows.append({"task": state["task"], "division": division, "assignment": a,
                             "seconds": seconds, "segments": segments, "events": personal_events,
                             "records": [r for r in state["work_record"] if r["assignment_id"] == a["id"]],
                             "arrangement": "planned" if published else "cancelled_with_work" if cancelled and has_execution else "unplanned",
                             "activity_only": not published and not has_execution,
                             "daily_item": published[0] if published else None, "cancelled_items": cancelled,
                             "has_draft": any(r["status"] == "draft" and not r["cancelled_at"] for r in plans),
                             "other_dates": sorted({r["work_date"] for r in effective} - {work_date.isoformat()})})
    return {"work_date": work_date.isoformat(), "cutoff_at": cutoff.isoformat(), "items": rows}


def freeze(store, work_date):
    """Caller must hold the nonorder write transaction lock; never called by a GET."""
    existing = store.rows("daily_result", work_date=work_date)
    if existing:
        return existing[0]["result_data"]
    cutoff = datetime.combine(work_date + timedelta(days=1), time.min)
    require(store.now() >= cutoff, "当日结果尚未锁定")
    data = calculate(store, work_date)
    if data["items"]:
        store.insert("daily_result", work_date=work_date, cutoff_at=cutoff, frozen_at=store.now(), schema_version=1, result_data=data)
    return data


def may_view_person(service, task, staff_id):
    return service.visible(task) and (
        service.managing(task) or service.admin and "nonorder.view-all" in service.actor["permissions"]
        or staff_id == service.staff or service.reviewing(task) and staff_id in service.protected_staff(task)
    )


def visible_result(service, data):
    # Current access decides visibility, while all display values remain historical.
    result = {**data, "items": []}
    for row in data["items"]:
        task = service.db.get("task", row["task"]["id"])
        if may_view_person(service, task, row["assignment"]["staff_id"]):
            result["items"].append({**row, "records": [service.public_record(r) for r in row["records"]]})
    return result


def later_changes(service, work_date):
    """Post-cutoff decisions are annotations, never mutations of the frozen baseline."""
    start = datetime.combine(work_date, time.min)
    cutoff = start + timedelta(days=1)
    result, seen = [], set()
    for event in service.db.rows("event"):
        if event["occurred_at"] < cutoff or event["event_type"] != "review":
            continue
        record = event["data"].get("record")
        if not record or (record["id"], event["occurred_at"]) in seen:
            continue
        task = service.db.get("task", event["task_id"])
        if not may_view_person(service, task, record["staff_id"]):
            continue
        if record["record_type"] == "time_correction":
            segments = record["payload"]["before_segments"] + record["payload"]["proposed_segments"]
            relevant = any(moment(s["started_at"]) < cutoff and moment(s["ended_at"]) > start for s in segments)
        else:
            submitted = moment(record["payload"].get("work_submitted_at", record["submitted_at"]))
            relevant = start <= submitted < cutoff
        if relevant:
            seen.add((record["id"], event["occurred_at"]))
            snapshot = event["data"]["snapshot"]
            assignment = next((a for a in snapshot["assignment"] if a["id"] == record["assignment_id"]), None)
            division = next((d for d in snapshot["division"] if assignment and d["id"] == assignment["division_id"]), None)
            result.append({"event_id": event["id"], "effective_at": event["occurred_at"],
                           "staff_name": assignment["staff_name"] if assignment else None,
                           "work": division["content"] if division else snapshot["task"]["content"],
                           "record": service.public_record(record)})
    return plain(result)
