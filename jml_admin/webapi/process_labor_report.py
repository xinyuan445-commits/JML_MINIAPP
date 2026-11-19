"""Read-only report rows for process elapsed time and assigned workers."""
from collections import defaultdict
from datetime import date, datetime


def _stamp(value):
    if isinstance(value, (date, datetime)):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    return str(value) if value else None


def _moment(value):
    if isinstance(value, datetime):
        return value
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def _status(step):
    if (step.get("rework_remaining_qty") or 0) > 0:
        return "返工中"
    return {
        "pending": "未开始",
        "received": "待开工",
        "processing": "进行中",
        "partial": "进行中",
        "received_done": "已完成",
    }.get(step.get("status"), step.get("status") or "未开始")


def _staffing(count, standard):
    if count == 0:
        return "未分配"
    if standard in (None, ""):
        return "未设标准"
    standard = int(standard)
    if count < standard:
        return "人数不足"
    if count > standard:
        return "人数超配"
    return "配置正常"


def build_process_labor_report(snapshot, batch_rows, now):
    details = defaultdict(list)
    for item in batch_rows:
        key = (
            str(item["mo_code"]),
            int(item["sort_seq"]),
            int(item["route_id"]),
            int(item["process_seq"]),
        )
        details[key].append({
            "kind": item.get("kind") or "正常",
            "record_id": item.get("record_id"),
            "start_time": _stamp(item.get("start_time")),
            "complete_time": _stamp(item.get("complete_time")),
            "qty_done": float(item.get("qty_done") or 0),
            "qty_a": float(item.get("qty_a") or 0),
            "qty_a1": float(item.get("qty_a1") or 0),
            "qty_a2": float(item.get("qty_a2") or 0),
            "qty_c": float(item.get("qty_c") or 0),
            "assigned_workers": item.get("assigned_workers") or "",
            "operator_name": item.get("operator_name") or "",
        })

    rows = []
    earliest = None
    for order in snapshot.get("orders", []):
        for step in sorted(order.get("steps") or [], key=lambda item: item["seq"]):
            start = _moment(step.get("first_start_time"))
            end = _moment(step.get("last_end_time"))
            status = _status(step)
            duration_end = end if status == "已完成" and end else now
            elapsed_minutes = None
            if start:
                elapsed_minutes = max(0, round((duration_end - start).total_seconds() / 60, 2))
                earliest = min(earliest, start.date()) if earliest else start.date()
            standard_minutes = step.get("standard_task_minutes")
            time_ratio = (
                round(elapsed_minutes / float(standard_minutes), 4)
                if elapsed_minutes is not None and standard_minutes not in (None, 0)
                else None
            )
            key = (order["mo_code"], order["sort_seq"], order["route_id"], step["seq"])
            step_details = details.get(key, [])
            workers = sorted({
                name
                for item in step_details
                if item["kind"] == "正常"
                for name in item["assigned_workers"].split("、")
                if name
            })
            rework_workers = sorted({
                name
                for item in step_details
                if item["kind"] == "返工"
                for name in item["assigned_workers"].split("、")
                if name
            })
            standard_staffing = step.get("standard_staffing")
            staffing_status = _staffing(len(workers), standard_staffing)
            issues = []
            if staffing_status == "未分配" and status not in ("未开始", "待开工"):
                issues.append("未分配人员")
            if status not in ("未开始", "待开工") and not start:
                issues.append("缺少开工时间")
            if status == "已完成" and not end:
                issues.append("缺少完工时间")
            if step.get("capacity_state") in ("unconfigured", "incomplete"):
                issues.append("未配置标准产能")
            if time_ratio is not None and time_ratio > 1:
                issues.append("超过标准时间")
            rows.append({
                "mo_code": order["mo_code"],
                "sort_seq": order["sort_seq"],
                "route_id": order["route_id"],
                "customer_name": order.get("customer_name") or "",
                "inv_code": order.get("inv_code") or "",
                "inv_name": order.get("inv_name") or "",
                "inv_std": order.get("inv_std") or "",
                "plan_qty": order.get("plan_qty"),
                "plan_start_date": order.get("plan_start_date"),
                "plan_due_date": order.get("plan_due_date"),
                "route_name": order.get("route_name") or "",
                "process_seq": step["seq"],
                "process_name": step.get("process_name") or "",
                "station_name": step.get("station_name") or "",
                "process_status": status,
                "normal_received_qty": step.get("normal_received_qty"),
                "normal_done_qty": step.get("normal_done_qty") or 0,
                "qty_a": step.get("qty_a") or 0,
                "qty_a1": step.get("qty_a1") or 0,
                "qty_a2": step.get("qty_a2") or 0,
                "qty_c": step.get("qty_c") or 0,
                "normal_remaining_qty": step.get("normal_remaining_qty"),
                "first_start_time": _stamp(step.get("first_start_time")),
                "last_report_time": _stamp(step.get("last_end_time")),
                "process_end_time": _stamp(step.get("last_end_time")) if status == "已完成" else None,
                "elapsed_minutes": elapsed_minutes,
                "capacity_state": step.get("capacity_state"),
                "standard_task_minutes": standard_minutes,
                "time_ratio": time_ratio,
                "worker_names": "、".join(workers),
                "worker_count": len(workers),
                "rework_worker_names": "、".join(rework_workers),
                "rework_worker_count": len(rework_workers),
                "standard_staffing": standard_staffing,
                "staffing_status": staffing_status,
                "issues": issues,
                "details": step_details,
            })
    return {
        "rows": rows,
        "range": {
            "start": earliest.isoformat() if earliest else None,
            "end": now.date().isoformat(),
        },
        "warnings": snapshot.get("warnings") or [],
    }
