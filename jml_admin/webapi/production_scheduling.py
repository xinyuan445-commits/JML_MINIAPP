"""Maintain production calendars/policies and calculate non-persistent schedule previews."""
from bisect import bisect_left, bisect_right
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal, InvalidOperation
import json

from flask import Blueprint, current_app, g, jsonify, request
from mysql.connector import IntegrityError


MAX_SCHEDULE_DAYS = 366
RULE_CATALOG = (
    ("overdue_first", "逾期优先"),
    ("earliest_due_date", "计划完工最早"),
    ("earliest_plan_start", "计划开工最早"),
    ("started_first", "已开工优先"),
    ("wip_first", "在制优先"),
    ("material_available_first", "可接收优先"),
    ("shortest_processing_time", "加工时间最短"),
    ("longest_processing_time", "加工时间最长"),
    ("order_number", "工单号顺序"),
)
RULE_CODES = {code for code, _ in RULE_CATALOG}


def _decimal(value):
    try:
        return Decimal(str(value or 0))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")


def _json(value, default):
    if value is None:
        return default
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def _body():
    value = request.get_json(silent=True)
    if not isinstance(value, dict):
        raise ValueError("请求内容无效")
    return value


def _positive_int(value, label):
    if isinstance(value, bool):
        raise ValueError(f"{label}无效")
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{label}无效") from None
    if number <= 0:
        raise ValueError(f"{label}无效")
    return number


def _boolean(value, label):
    if value not in (True, False, 0, 1):
        raise ValueError(f"{label}无效")
    return int(bool(value))


def _month_day(value, label):
    text = str(value or "").strip()
    try:
        datetime.strptime(f"2000-{text}", "%Y-%m-%d")
    except ValueError:
        raise ValueError(f"{label}无效") from None
    return text


def _intervals(value):
    if not isinstance(value, list) or len(value) > 4:
        raise ValueError("工作时段无效")
    result = []
    previous_end = None
    for pair in value:
        if not isinstance(pair, list) or len(pair) != 2:
            raise ValueError("工作时段无效")
        try:
            start = datetime.strptime(str(pair[0]), "%H:%M").time()
            end = datetime.strptime(str(pair[1]), "%H:%M").time()
        except ValueError:
            raise ValueError("工作时段无效") from None
        if end <= start or (previous_end and start < previous_end):
            raise ValueError("工作时段不能重叠或倒置")
        result.append([start.strftime("%H:%M"), end.strftime("%H:%M")])
        previous_end = end
    return result


def _audit(cursor, action, target, payload):
    cursor.execute("""
        INSERT INTO mo_admin_audit_log_yx
          (username,action_name,request_method,request_path,target_id,
           request_data,result_code,result_message,ip_address)
        VALUES (%s,%s,%s,%s,%s,%s,0,'',%s)
    """, (
        g.audit_username,
        action,
        request.method,
        request.path,
        str(target),
        json.dumps(payload, ensure_ascii=False),
        request.remote_addr or "",
    ))


def _load_calendars(cursor, active_only=False):
    cursor.execute(f"""
        SELECT id,calendar_code,calendar_name,timezone,is_default,is_active,revision,update_time
        FROM mo_work_calendar_yx
        {'WHERE is_active=1' if active_only else ''}
        ORDER BY is_default DESC,calendar_name,id
    """)
    calendars = cursor.fetchall()
    if not calendars:
        return []
    ids = [row["id"] for row in calendars]
    placeholders = ",".join(["%s"] * len(ids))
    cursor.execute(f"""
        SELECT id,calendar_id,period_name,start_month_day,end_month_day,sort_order
        FROM mo_work_calendar_period_yx WHERE calendar_id IN ({placeholders})
        ORDER BY calendar_id,sort_order,id
    """, tuple(ids))
    periods = cursor.fetchall()
    period_ids = [row["id"] for row in periods]
    weeks = defaultdict(list)
    if period_ids:
        week_placeholders = ",".join(["%s"] * len(period_ids))
        cursor.execute(f"""
            SELECT period_id,weekday,intervals_json
            FROM mo_work_calendar_week_yx WHERE period_id IN ({week_placeholders})
            ORDER BY period_id,weekday
        """, tuple(period_ids))
        for row in cursor.fetchall():
            weeks[row["period_id"]].append({
                "weekday": int(row["weekday"]),
                "intervals": _json(row["intervals_json"], []),
            })
    period_map = defaultdict(list)
    for row in periods:
        period_map[row["calendar_id"]].append({
            **row,
            "weeks": weeks[row["id"]],
        })
    cursor.execute(f"""
        SELECT id,calendar_id,work_date,exception_type,intervals_json,reason,source,revision,update_time
        FROM mo_work_calendar_exception_yx WHERE calendar_id IN ({placeholders})
        ORDER BY calendar_id,work_date
    """, tuple(ids))
    exception_map = defaultdict(list)
    for row in cursor.fetchall():
        row["work_date"] = row["work_date"].isoformat()
        row["intervals"] = _json(row.pop("intervals_json"), [])
        exception_map[row["calendar_id"]].append(row)
    for row in calendars:
        row["is_default"] = bool(row["is_default"])
        row["is_active"] = bool(row["is_active"])
        row["periods"] = period_map[row["id"]]
        row["exceptions"] = exception_map[row["id"]]
        if row.get("update_time"):
            row["update_time"] = row["update_time"].isoformat(sep=" ", timespec="seconds")
    return calendars


def _load_policies(cursor, active_only=False):
    cursor.execute(f"""
        SELECT id,policy_code,policy_name,description,is_default,is_active,revision,update_time
        FROM mo_schedule_policy_yx
        {'WHERE is_active=1' if active_only else ''}
        ORDER BY is_default DESC,policy_name,id
    """)
    policies = cursor.fetchall()
    if not policies:
        return []
    ids = [row["id"] for row in policies]
    placeholders = ",".join(["%s"] * len(ids))
    cursor.execute(f"""
        SELECT id,policy_id,priority,rule_code,is_enabled
        FROM mo_schedule_policy_rule_yx WHERE policy_id IN ({placeholders})
        ORDER BY policy_id,priority,id
    """, tuple(ids))
    rule_map = defaultdict(list)
    for row in cursor.fetchall():
        row["is_enabled"] = bool(row["is_enabled"])
        rule_map[row["policy_id"]].append(row)
    for row in policies:
        row["is_default"] = bool(row["is_default"])
        row["is_active"] = bool(row["is_active"])
        row["rules"] = rule_map[row["id"]]
        if row.get("update_time"):
            row["update_time"] = row["update_time"].isoformat(sep=" ", timespec="seconds")
    return policies


def _select(items, requested_id):
    if requested_id:
        selected = next((item for item in items if item["id"] == requested_id), None)
        if selected:
            return selected
    return next((item for item in items if item["is_default"]), items[0] if items else None)


def _date_in_period(day, start_text, end_text):
    value = day.strftime("%m-%d")
    if start_text <= end_text:
        return start_text <= value <= end_text
    return value >= start_text or value <= end_text


def _calendar_slots(calendar, day):
    exception = next((item for item in calendar["exceptions"] if item["work_date"] == day.isoformat()), None)
    if exception:
        intervals = exception["intervals"] if exception["exception_type"] == "work" else []
    else:
        period = next((item for item in calendar["periods"] if _date_in_period(
            day, item["start_month_day"], item["end_month_day"]
        )), None)
        week = next((item for item in (period or {}).get("weeks", []) if item["weekday"] == day.isoweekday()), None)
        intervals = week["intervals"] if week else []
    return [
        (
            datetime.combine(day, datetime.strptime(pair[0], "%H:%M").time()),
            datetime.combine(day, datetime.strptime(pair[1], "%H:%M").time()),
        )
        for pair in intervals
    ]



def _free_segments(start, end, bookings):
    cursor = start
    for booked_start, booked_end in sorted(bookings):
        if booked_end <= cursor:
            continue
        if booked_start >= end:
            break
        if booked_start > cursor:
            yield cursor, booked_start
        cursor = booked_end
    if cursor < end:
        yield cursor, end


def _allocate(slots, earliest, latest, minutes, bookings=(), backward=False):
    if earliest > latest:
        return []
    if minutes == 0:
        point = latest if backward else earliest
        return [(point, point)]
    windows = list(_free_segments(earliest, latest, bookings))
    for left, right in reversed(windows) if backward else windows:
        remaining = timedelta(minutes=minutes)
        allocated = []
        first = max(0, bisect_right(slots, (left, datetime.max)) - 1)
        last = bisect_left(slots, (right, datetime.min))
        indices = range(last - 1, first - 1, -1) if backward else range(first, last)
        for index in indices:
            slot_start, slot_end = slots[index]
            start, end = max(slot_start, left), min(slot_end, right)
            if start >= end:
                continue
            duration = min(remaining, end - start)
            allocated.append((end - duration, end) if backward else (start, start + duration))
            remaining -= duration
            if not remaining:
                return allocated[::-1] if backward else allocated
    return []


def _timestamp(value):
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(value) if value else None
    except (TypeError, ValueError):
        return None


def _deadline(calendar, value):
    due = _timestamp(value)
    if not due or due.time() != time.min:
        return due
    day = due.date()
    for _ in range(MAX_SCHEDULE_DAYS):
        slots = _calendar_slots(calendar, day)
        if slots:
            return slots[-1][1]
        day -= timedelta(days=1)
    return due


def _handover_minutes(settings, route_id, before, after):
    return settings.get((route_id, before, after), settings.get((0, before, after)))


def _working_minutes(segments, left, right):
    return sum(max(0, (min(end, right) - max(start, left)).total_seconds()) / 60
               for start, end in segments)


def _try_order(order, slots, bookings, horizon, backward=False):
    if backward and not order["due"]:
        return None
    bound = min(order["due"], horizon) if backward else None
    placements = {}
    additions = defaultdict(list)
    gap_minutes = 0
    tasks = order["tasks"]
    for index in reversed(range(len(tasks))) if backward else range(len(tasks)):
        task = tasks[index]
        adjacent = index + 1 if backward else index - 1
        if bound is not None and 0 <= adjacent < len(tasks):
            if task.get("fixed") and tasks[adjacent].get("fixed"):
                # Historical work is authoritative even when it predates today's handover rule.
                bound = None
            minutes = (tasks[adjacent] if backward else task)["handover_minutes"] or 0
            if bound is not None and minutes:
                transition = _allocate(
                    slots, order["calendar_floor"] if backward else bound,
                    bound if backward else horizon, minutes, backward=backward,
                )
                if not transition:
                    return None
                bound = transition[0][0] if backward else transition[-1][1]
        if task.get("fixed"):
            start, end = task["fixed"]
            if bound is not None and (end > bound if backward else start < bound):
                return None
        else:
            if task.get("reason"):
                return None
            station = task["station_id"]
            duration = task["duration_minutes"]
            existing = bookings.get(station, ())
            segments = _allocate(
                slots, order["earliest"] if backward else max(order["earliest"], bound or order["earliest"]),
                bound if backward else horizon, duration, [*existing, *additions[station]],
                backward=backward,
            )
            if not segments:
                return None
            start, end = segments[0][0], segments[-1][1]
            placements[task["key"]] = segments
            if duration:
                additions[station].append((start, end))
                if existing:
                    gap_minutes += _working_minutes(segments, min(left for left, _ in existing),
                                                    max(right for _, right in existing))
        bound = start if backward else end
    finish = tasks[-1]["fixed"][1] if tasks[-1].get("fixed") else placements[tasks[-1]["key"]][-1][1]
    return {"placements": placements, "bookings": additions, "finish": finish, "gap_minutes": gap_minutes}


def _commit_bookings(bookings, plan):
    for station, spans in plan["bookings"].items():
        bookings[station].extend(spans)


def _dispatch_orders(orders, slots, bookings, horizon, efficiency, backward):
    scheduled, deferred = [], []
    pending = list(orders)
    while pending:
        def due_key(order):
            return order["due"] or datetime.max, order["key"]

        if efficiency:
            candidates = [(order, _try_order(order, slots, bookings, horizon, backward)) for order in pending]
            deferred.extend(order for order, plan in candidates if plan is None)
            candidates = [(order, plan) for order, plan in candidates if plan is not None]
            pending = [order for order, _ in candidates]
            if not candidates:
                break
            selected, plan = min(candidates, key=lambda item: (
                -item[1]["gap_minutes"] / (item[0]["work_minutes"] or 1),
                item[0]["work_minutes"], due_key(item[0]),
            ))
            touched = {station for station, spans in plan["bookings"].items() if spans}
            trial_bookings = {**bookings, **{
                station: [*bookings[station], *plan["bookings"][station]] for station in touched
            }}
            for other, other_plan in sorted(candidates, key=lambda item: due_key(item[0])):
                if (other is selected or not other["due"] or other_plan["finish"] > other["due"]
                        or not touched.intersection(other["stations"])):
                    continue
                after = _try_order(other, slots, trial_bookings, horizon, backward)
                if after is None or after["finish"] > other["due"]:
                    selected, plan = other, other_plan
                    break
        else:
            first_due = min(pending, key=due_key)["due"]
            same_due = [order for order in pending if order["due"] == first_due]
            # With the same due date, a later earliest finish leaves less slack.
            probes = [(order, _try_order(order, slots, bookings, horizon)) for order in same_due]
            selected, _ = min(probes, key=lambda item: (
                item[1] is None,
                datetime.max - item[1]["finish"] if item[1] and first_due else timedelta(0),
                item[0]["key"],
            ))
            plan = _try_order(selected, slots, bookings, horizon, True) if backward else next(
                probe for order, probe in probes if order is selected
            )
        pending.remove(selected)
        if plan is None:
            deferred.append(selected)
            continue
        _commit_bookings(bookings, plan)
        scheduled.append((selected, plan))
    return scheduled, deferred


def _task_reason(task):
    state = task["capacity_state"]
    if not task["station_id"]:
        return "工序没有工站"
    if state == "unlimited":
        return None
    if state != "finite":
        return {
            "inactive": "设备已停用",
            "incomplete": "标准产能资料不完整",
            "unconfigured": "未配置标准产能",
        }.get(state, "无法换算标准时间")
    if not task["duration_minutes"] or task["duration_minutes"] <= 0:
        return "标准时间无效"
    return None


def _emit_task(task, segments, order, direction, slots, previous_end=None):
    start, end = segments[0][0], segments[-1][1]
    handover_end = None
    if previous_end is not None:
        transition = _allocate(slots, previous_end, start, task["handover_minutes"] or 0)
        if transition:
            handover_end = transition[-1][1]
    stamp = lambda value: value.isoformat(sep=" ", timespec="seconds") if value is not None else None
    duration = task["duration_minutes"]
    return {
        **{key: value for key, value in task.items() if key not in {"fixed", "started", "reason"}},
        "schedule_start": stamp(start), "schedule_end": stamp(end),
        "segments": [[stamp(left), stamp(right)] for left, right in segments if left < right],
        "type": "milestone" if duration == 0 else "planned",
        "is_late": bool(order["due"] and end > order["due"]),
        "schedule_direction": direction,
        "handover_end": stamp(handover_end),
        "waiting_minutes": round(_working_minutes(slots, handover_end, start), 2) if handover_end else None,
        "formula": (f"{task['quantity']:g}{task['unit_name']} × {duration / task['quantity']:.4g}分钟/{task['unit_name']} = {duration:.1f}分钟"
                    if duration else "无限产能，不占设备时间"),
    }


def _load_handover_settings(cursor):
    cursor.execute("""
        SELECT id,route_id,from_process_id,to_process_id,minutes,is_active,revision
        FROM mo_schedule_handover_yx ORDER BY route_id,from_process_id,to_process_id
    """)
    return [{**row, "is_active": bool(row["is_active"])} for row in cursor.fetchall()]


def _schedule_policies(cursor, active_only=False):
    rows = [row for row in _load_policies(cursor, active_only)
            if row["policy_code"] in {"due-date", "efficiency"}]
    return sorted(rows, key=lambda row: (not row["is_default"], row["policy_code"] != "due-date"))


def build_schedule_preview(connection, snapshot, now, calendar_id=None, policy_id=None, direction="forward"):
    if direction not in {"forward", "backward"}:
        raise ValueError("排程方向无效")
    cursor = connection.cursor(dictionary=True)
    try:
        calendars = _load_calendars(cursor, active_only=True)
        policies = _schedule_policies(cursor, active_only=True)
        calendar = _select(calendars, calendar_id)
        policy = _select(policies, policy_id)
        if not calendar or not policy:
            raise ValueError("请先初始化生产日历和排程策略")
        handovers = {
            (row["route_id"], row["from_process_id"], row["to_process_id"]): row["minutes"]
            for row in _load_handover_settings(cursor) if row["is_active"]
        }
        cursor.execute("SELECT route_id,seq,process_id FROM mo_route_step_yx")
        process_ids = {(row["route_id"], row["seq"]): row["process_id"] for row in cursor.fetchall()}
        cursor.execute("""
            SELECT e.station_id,d.device_name
            FROM mo_equipment_yx e JOIN mo_equipment_device_yx d ON d.device_id=e.device_id
        """)
        device_names = {row["station_id"]: row["device_name"] for row in cursor.fetchall()}
    finally:
        cursor.close()

    snapshot_orders = [order for order in snapshot.get("orders", [])
                       if not order.get("is_closed") and not order.get("erp_deleted")]
    calendar_floor = datetime.combine(now.date() - timedelta(days=MAX_SCHEDULE_DAYS), time.min)
    horizon = datetime.combine(now.date() + timedelta(days=MAX_SCHEDULE_DAYS), time.min)
    slots = [slot for offset in range(MAX_SCHEDULE_DAYS * 2)
             for slot in _calendar_slots(calendar, calendar_floor.date() + timedelta(days=offset))]
    planned, actual, unscheduled, orders, active = [], [], [], [], []
    bookings = defaultdict(list)
    for item in snapshot_orders:
        plan_qty = _decimal(item.get("plan_qty"))
        route_id = item.get("route_id")
        order = {
            "key": (item["mo_code"], int(item["sort_seq"])),
            "due": _deadline(calendar, item.get("plan_due_date")),
            "earliest": max(now, _timestamp(item.get("plan_start_date")) or now),
            "calendar_floor": calendar_floor,
            "tasks": [],
        }
        previous_process = None
        for index, step in enumerate(sorted(item.get("steps", []), key=lambda step: step["seq"])):
            done = _decimal(step.get("normal_done_qty"))
            remaining = max(Decimal(0), plan_qty - done)
            actual_start, actual_end = _timestamp(step.get("first_start_time")), _timestamp(step.get("last_end_time"))
            process_id = process_ids.get((route_id, step["seq"]))
            transition = _handover_minutes(handovers, route_id, previous_process, process_id) if index else 0
            previous_process = process_id
            capacity = step.get("capacity_state") or "unconfigured"
            unit_minutes = step.get("standard_unit_minutes")
            duration = 0 if capacity == "unlimited" else (
                float(remaining * _decimal(unit_minutes)) if unit_minutes is not None else None
            )
            task = {
                "key": f"{item['mo_code']}:{item['sort_seq']}:{step['seq']}",
                "mo_code": item["mo_code"], "sort_seq": item["sort_seq"],
                "seq": step["seq"], "process_name": step["process_name"],
                "station_id": step.get("station_id"),
                "station_name": step.get("station_name") or "未标工站",
                "device_name": device_names.get(step.get("station_id")) or "未建设备",
                "quantity": float(remaining), "unit_name": item.get("unit_name") or "",
                "capacity_state": capacity, "duration_minutes": duration,
                "due_date": item.get("plan_due_date"), "plan_start_date": item.get("plan_start_date"),
                "due_at": order["due"].isoformat(sep=" ") if order["due"] else None,
                "staffing": step.get("standard_staffing"),
                "standard_quantity": step.get("capacity_quantity"), "standard_unit": step.get("capacity_unit"),
                "standard_period": step.get("capacity_period"), "effective_hours": step.get("capacity_effective_hours"),
                "handover_minutes": transition, "handover_missing": transition is None,
            }
            order["tasks"].append(task)
            if plan_qty > 0 and remaining <= Decimal("0.0001") and done > 0:
                start = actual_start or actual_end or now
                finish = actual_end or start
                actual.append({
                    **task, "key": task["key"] + ":actual", "quantity": float(done), "duration_minutes": None,
                    "schedule_start": step.get("first_start_time") or step.get("last_end_time"),
                    "schedule_end": step.get("last_end_time") or step.get("first_start_time"),
                    "segments": [], "type": "actual", "is_late": False, "formula": "实际开工至完工",
                    "handover_missing": False,
                })
                task["fixed"] = (start, finish)
                continue
            task["reason"] = "未取得计划数量" if plan_qty <= 0 else _task_reason(task)
            if step.get("has_active_execution") and actual_start and not task["reason"]:
                active.append((actual_start, order, task))
        orders.append(order)

    for start, order, task in sorted(active, key=lambda row: (row[0], row[1]["key"], row[2]["seq"])):
        station = task["station_id"]
        segments = _allocate(slots, now, horizon, task["duration_minutes"], bookings[station])
        if not segments:
            task["reason"] = "一年内没有足够的日历工时"
            continue
        finish = segments[-1][1]
        if task["duration_minutes"]:
            bookings[station].append((segments[0][0], finish))
        task["fixed"] = (start, finish)
        planned.append(_emit_task(task, segments, order, "forward", slots))

    pending = []
    for order in orders:
        tasks = [task for task in order["tasks"] if not task.get("fixed")]
        if not tasks:
            continue
        if any(task.get("reason") for task in tasks):
            unscheduled.extend({**task, "reason": task["reason"] or "同工单存在未排定工序"} for task in tasks)
            continue
        order["work_minutes"] = sum(task["duration_minutes"] for task in tasks)
        order["stations"] = {task["station_id"] for task in tasks if task["duration_minutes"]}
        pending.append(order)
    efficiency = policy["policy_code"] == "efficiency"
    scheduled, deferred = _dispatch_orders(pending, slots, bookings, horizon, efficiency, direction == "backward")
    if direction == "backward":
        fallback, deferred = _dispatch_orders(deferred, slots, bookings, horizon, efficiency, False)
    else:
        fallback = []
    for mode, results in ((direction, scheduled), ("forward-fallback", fallback)):
        for order, plan in results:
            previous_end = None
            for task in order["tasks"]:
                if task.get("fixed"):
                    previous_end = task["fixed"][1]
                else:
                    segments = plan["placements"][task["key"]]
                    planned.append(_emit_task(task, segments, order, mode, slots, previous_end))
                    previous_end = segments[-1][1]
    for order in deferred:
        unscheduled.extend({**task, "reason": "工序顺序或设备时段无法满足"}
                           for task in order["tasks"] if not task.get("fixed"))

    tasks = sorted(actual + planned, key=lambda item: (
        item.get("schedule_start") or "9999", item["station_name"], item["mo_code"], item["sort_seq"], item["seq"],
    ))
    starts = [item["schedule_start"] for item in tasks if item.get("schedule_start")]
    ends = [item["schedule_end"] for item in tasks if item.get("schedule_end")]
    return {
        "generated_at": now.isoformat(sep=" ", timespec="seconds"),
        "persisted": False,
        "direction": direction,
        "calendar": {"id": calendar["id"], "name": calendar["calendar_name"]},
        "policy": {"id": policy["id"], "name": policy["policy_name"],
                   "rules": [row["rule_code"] for row in policy["rules"] if row["is_enabled"]]},
        "calendars": [{"id": row["id"], "name": row["calendar_name"], "is_default": row["is_default"]}
                      for row in calendars],
        "policies": [{"id": row["id"], "name": row["policy_name"], "description": row["description"],
                      "is_default": row["is_default"]} for row in policies],
        "tasks": tasks, "unscheduled": unscheduled,
        "window_start": min(starts) if starts else None, "window_end": max(ends) if ends else None,
        "summary": {"tasks": len(tasks), "planned": len(planned),
                    "late": sum(1 for item in planned if item["is_late"]), "unscheduled": len(unscheduled)},
    }




def production_scheduling_blueprint(database):
    blueprint = Blueprint("production_scheduling", __name__)

    def run(work, write=False):
        connection = cursor = None
        try:
            connection = database()
            cursor = connection.cursor(dictionary=True)
            result = work(cursor, connection)
            if write:
                connection.commit()
            return jsonify({"code": 0, "data": result})
        except ValueError as error:
            if connection:
                connection.rollback()
            return jsonify({"code": 400, "msg": str(error)}), 400
        except Exception:
            if connection:
                connection.rollback()
            current_app.logger.exception("production scheduling configuration failed")
            return jsonify({"code": 503, "msg": "生产排程配置暂不可用"}), 503
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()

    @blueprint.get("/api/admin/production-scheduling")
    def configuration():
        def work(cursor, _connection):
            calendars = _load_calendars(cursor)
            policies = _schedule_policies(cursor)
            handovers = _load_handover_settings(cursor)
            cursor.execute("SELECT id,process_name FROM mo_process_yx ORDER BY process_name,id")
            processes = cursor.fetchall()
            cursor.execute("SELECT id,route_code,route_name FROM mo_route_yx ORDER BY route_code,id")
            return {
                "calendars": calendars,
                "policies": policies,
                "rule_catalog": [{"code": code, "name": name} for code, name in RULE_CATALOG],
                "handovers": handovers,
                "processes": processes,
                "routes": cursor.fetchall(),
            }
        return run(work)

    @blueprint.post("/api/admin/production-scheduling/handover/save")
    def save_handover():
        def work(cursor, _connection):
            body = _body()
            route_id = _positive_int(body["route_id"], "工艺路线") if body.get("route_id") else 0
            before = _positive_int(body.get("from_process_id"), "上道工序")
            after = _positive_int(body.get("to_process_id"), "下道工序")
            minutes = body.get("minutes")
            if type(minutes) is not int or not 0 <= minutes <= 525600:
                raise ValueError("交割时间须为0至525600的整数分钟")
            active = _boolean(body.get("is_active"), "启用状态")
            cursor.execute("SELECT id FROM mo_process_yx WHERE id IN (%s,%s)", (before, after))
            if {row["id"] for row in cursor.fetchall()} != {before, after}:
                raise ValueError("请选择有效的上道和下道工序")
            if route_id:
                cursor.execute("SELECT process_id FROM mo_route_step_yx WHERE route_id=%s ORDER BY seq", (route_id,))
                steps = [row["process_id"] for row in cursor.fetchall()]
                if (before, after) not in zip(steps, steps[1:]):
                    raise ValueError("两道工序必须在所选路线中相邻")
            values = (route_id, before, after, minutes, active, g.audit_username)
            try:
                if body.get("id"):
                    rule_id = _positive_int(body["id"], "交割规则")
                    revision = _positive_int(body.get("revision"), "配置版本")
                    cursor.execute("""
                        UPDATE mo_schedule_handover_yx
                        SET route_id=%s,from_process_id=%s,to_process_id=%s,minutes=%s,
                            is_active=%s,updated_by=%s,revision=revision+1
                        WHERE id=%s AND revision=%s
                    """, (*values, rule_id, revision))
                    if cursor.rowcount != 1:
                        raise ValueError("交割规则已变化，请刷新后重试")
                else:
                    cursor.execute("""
                        INSERT INTO mo_schedule_handover_yx
                            (route_id,from_process_id,to_process_id,minutes,is_active,updated_by)
                        VALUES (%s,%s,%s,%s,%s,%s)
                    """, values)
                    rule_id = cursor.lastrowid
                    revision = 0
            except IntegrityError as exc:
                if exc.errno != 1062:
                    raise
                raise ValueError("此路线和工序组合已有交割规则") from None
            _audit(cursor, "保存工序交割", rule_id, {
                "route_id": route_id, "from_process_id": before, "to_process_id": after,
                "minutes": minutes, "is_active": active,
            })
            return {"id": rule_id, "revision": revision + 1}
        return run(work, True)

    @blueprint.post("/api/admin/production-scheduling/calendar/save")
    def save_calendar():
        def work(cursor, _connection):
            body = _body()
            calendar_id = _positive_int(body.get("id"), "日历")
            revision = _positive_int(body.get("revision"), "配置版本")
            name = str(body.get("calendar_name") or "").strip()[:100]
            if not name:
                raise ValueError("请输入日历名称")
            periods = body.get("periods")
            exceptions = body.get("exceptions")
            if not isinstance(periods, list) or not periods:
                raise ValueError("至少保留一个作息时间")
            if not isinstance(exceptions, list):
                raise ValueError("特殊日期无效")
            cursor.execute("SELECT revision FROM mo_work_calendar_yx WHERE id=%s FOR UPDATE", (calendar_id,))
            current = cursor.fetchone()
            if not current or int(current["revision"]) != revision:
                raise ValueError("日历已变化，请刷新后重试")
            is_default = _boolean(body.get("is_default"), "默认日历")
            is_active = _boolean(body.get("is_active"), "日历状态")
            if is_default and not is_active:
                raise ValueError("默认日历必须启用")
            if is_default:
                cursor.execute("UPDATE mo_work_calendar_yx SET is_default=0 WHERE id<>%s", (calendar_id,))
            cursor.execute("""
                UPDATE mo_work_calendar_yx SET calendar_name=%s,is_default=%s,is_active=%s,
                    revision=revision+1,updated_by=%s WHERE id=%s AND revision=%s
            """, (name, is_default, is_active, g.audit_username, calendar_id, revision))
            cursor.execute("SELECT id FROM mo_work_calendar_period_yx WHERE calendar_id=%s", (calendar_id,))
            old_period_ids = [row["id"] for row in cursor.fetchall()]
            if old_period_ids:
                placeholders = ",".join(["%s"] * len(old_period_ids))
                cursor.execute(f"DELETE FROM mo_work_calendar_week_yx WHERE period_id IN ({placeholders})", tuple(old_period_ids))
            cursor.execute("DELETE FROM mo_work_calendar_period_yx WHERE calendar_id=%s", (calendar_id,))
            for index, period in enumerate(periods, 1):
                period_name = str(period.get("period_name") or "").strip()[:100]
                if not period_name:
                    raise ValueError("作息名称不能为空")
                start = _month_day(period.get("start_month_day"), "开始日期")
                end = _month_day(period.get("end_month_day"), "结束日期")
                cursor.execute("""
                    INSERT INTO mo_work_calendar_period_yx
                      (calendar_id,period_name,start_month_day,end_month_day,sort_order)
                    VALUES (%s,%s,%s,%s,%s)
                """, (calendar_id, period_name, start, end, index))
                period_id = cursor.lastrowid
                weeks = period.get("weeks")
                if not isinstance(weeks, list) or {row.get("weekday") for row in weeks} != set(range(1, 8)):
                    raise ValueError("每个作息必须包含周一至周日")
                for week in weeks:
                    intervals = _intervals(week.get("intervals"))
                    cursor.execute("""
                        INSERT INTO mo_work_calendar_week_yx (period_id,weekday,intervals_json)
                        VALUES (%s,%s,%s)
                    """, (period_id, week["weekday"], json.dumps(intervals, ensure_ascii=False)))
            cursor.execute("DELETE FROM mo_work_calendar_exception_yx WHERE calendar_id=%s AND source='manual'", (calendar_id,))
            for item in exceptions:
                if item.get("source", "manual") != "manual":
                    continue
                try:
                    work_date = date.fromisoformat(str(item.get("work_date")))
                except ValueError:
                    raise ValueError("特殊日期无效") from None
                kind = item.get("exception_type")
                if kind not in {"work", "rest"}:
                    raise ValueError("特殊日期类型无效")
                intervals = _intervals(item.get("intervals") or []) if kind == "work" else []
                cursor.execute("""
                    INSERT INTO mo_work_calendar_exception_yx
                      (calendar_id,work_date,exception_type,intervals_json,reason,source,updated_by)
                    VALUES (%s,%s,%s,%s,%s,'manual',%s)
                    ON DUPLICATE KEY UPDATE
                      exception_type=VALUES(exception_type),intervals_json=VALUES(intervals_json),
                      reason=VALUES(reason),source='manual',revision=revision+1,
                      updated_by=VALUES(updated_by)
                """, (calendar_id, work_date, kind, json.dumps(intervals, ensure_ascii=False), str(item.get("reason") or "")[:255], g.audit_username))
            _audit(cursor, "修改生产日历", calendar_id, {"calendar_name": name, "periods": len(periods), "manual_exceptions": sum(1 for item in exceptions if item.get("source", "manual") == "manual")})
            return {"revision": revision + 1}
        return run(work, True)

    @blueprint.post("/api/admin/production-scheduling/calendar/import-holidays")
    def import_holidays():
        def work(cursor, connection):
            body = _body()
            calendar_id = _positive_int(body.get("calendar_id"), "日历")
            year = _positive_int(body.get("year"), "年份")
            if year < 2004 or year > 2100:
                raise ValueError("年份无效")
            from init_production_scheduling import import_china_holidays
            imported, skipped = import_china_holidays(
                connection, calendar_id, year, g.audit_username, commit=False
            )
            replacement = connection.cursor(dictionary=True)
            _audit(replacement, "导入生产日历节假日", calendar_id, {"year": year, "imported": imported, "skipped": skipped})
            replacement.close()
            return {"imported": imported, "skipped": skipped}
        return run(work, True)

    @blueprint.post("/api/admin/production-scheduling/policy/save")
    def save_policy():
        def work(cursor, _connection):
            body = _body()
            policy_id = _positive_int(body.get("id"), "排程策略")
            revision = _positive_int(body.get("revision"), "配置版本")
            name = str(body.get("policy_name") or "").strip()[:100]
            if not name:
                raise ValueError("请输入策略名称")
            rules = body.get("rules")
            if not isinstance(rules, list) or not rules:
                raise ValueError("至少保留一条排程规则")
            rule_codes = [row.get("rule_code") for row in rules]
            if any(code not in RULE_CODES for code in rule_codes) or len(rule_codes) != len(set(rule_codes)):
                raise ValueError("排程规则无效或重复")
            cursor.execute("SELECT revision FROM mo_schedule_policy_yx WHERE id=%s FOR UPDATE", (policy_id,))
            current = cursor.fetchone()
            if not current or int(current["revision"]) != revision:
                raise ValueError("策略已变化，请刷新后重试")
            is_default = _boolean(body.get("is_default"), "默认策略")
            is_active = _boolean(body.get("is_active"), "策略状态")
            if is_default and not is_active:
                raise ValueError("默认策略必须启用")
            if is_default:
                cursor.execute("UPDATE mo_schedule_policy_yx SET is_default=0 WHERE id<>%s", (policy_id,))
            cursor.execute("""
                UPDATE mo_schedule_policy_yx
                SET policy_name=%s,description=%s,is_default=%s,is_active=%s,
                    revision=revision+1,updated_by=%s WHERE id=%s AND revision=%s
            """, (name, str(body.get("description") or "")[:500], is_default, is_active, g.audit_username, policy_id, revision))
            cursor.execute("DELETE FROM mo_schedule_policy_rule_yx WHERE policy_id=%s", (policy_id,))
            for priority, rule in enumerate(rules, 1):
                cursor.execute("""
                    INSERT INTO mo_schedule_policy_rule_yx
                      (policy_id,priority,rule_code,is_enabled) VALUES (%s,%s,%s,%s)
                """, (policy_id, priority, rule["rule_code"], _boolean(rule.get("is_enabled"), "规则状态")))
            _audit(cursor, "修改排程策略", policy_id, {"policy_name": name, "rules": rule_codes})
            return {"revision": revision + 1}
        return run(work, True)

    return blueprint
