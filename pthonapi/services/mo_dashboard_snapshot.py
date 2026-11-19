"""Production operations snapshot; calculations deliberately do not mutate report data."""
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal


EPSILON = Decimal("0.0001")
GRADES = ("qty_a", "qty_a1", "qty_a2", "qty_c")


def _qty(value):
    return Decimal(str(value or 0))


def _number(value):
    return None if value is None else float(value)


def _key(row):
    return str(row["mo_code"]), int(row["sort_seq"]), int(row["route_id"])


def _stamp(value):
    if isinstance(value, (date, datetime)):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    return str(value) if value else None


def _latest(rows):
    return max((
        _stamp(row.get(field)) for row in rows
        for field in ("start_time", "end_time", "update_time", "create_time", "confirm_time")
        if row.get(field)
    ), default=None)


def load_operation_rows(conn, now):
    """Read all tracked lines in one MySQL transaction, with no per-order queries."""
    cur = conn.cursor(dictionary=True)
    since = datetime.combine(now.date() - timedelta(days=6), time.min)
    until = datetime.combine(now.date() + timedelta(days=1), time.min)
    queries = {
        "states": "SELECT mo_code,sort_seq,route_id,status,update_time FROM mo_wo_state_yx",
        "bindings": "SELECT mo_code,sort_seq,route_id FROM mo_wo_route_yx",
        "category_routes": """
            SELECT pc.name AS category_name,pr.route_id
            FROM bj_product_cost_yx pc
            JOIN mo_product_route_yx pr ON pr.product_code=pc.code
            JOIN mo_route_yx r ON r.id=pr.route_id
            WHERE pc.is_enabled=1 AND r.is_active=1
            ORDER BY r.id
        """,
        "step_stations": """
            SELECT s.route_id,s.seq,ss.station_id
            FROM mo_route_step_yx s
            JOIN mo_step_station_yx ss ON ss.step_id=s.id
        """,
        "routes": "SELECT id,route_name,dept_name FROM mo_route_yx",
        "steps": """
            SELECT s.route_id,s.seq,p.id AS process_id,p.process_name
            FROM mo_route_step_yx s JOIN mo_process_yx p ON p.id=s.process_id
            ORDER BY s.route_id,s.seq
        """,
        "executions": """
            SELECT id,mo_code,sort_seq,route_id,seq,process_name,station_id,station_name,
                   status,qty_done,qty_a,qty_a1,qty_a2,qty_c,start_time,end_time,update_time
            FROM mo_execution_yx ORDER BY id
        """,
        "handovers": """
            SELECT id,mo_code,sort_seq,route_id,from_seq,to_seq,status,
                   qty_out,qty_out_a,qty_out_a1,qty_out_a2,qty_in,
                   create_time,confirm_time,to_station_id
            FROM mo_handover_yx ORDER BY id
        """,
        "receives": """
            SELECT id,execution_id,mo_code,sort_seq,route_id,seq,status,qty_input,
                   start_time,end_time,update_time
            FROM mo_receive_work_yx ORDER BY id
        """,
        "reworks": """
            SELECT id,source_execution_id,mo_code,sort_seq,route_id,seq,status,
                   qty_input,qty_a,qty_a1,qty_a2,qty_c,start_time,end_time,update_time
            FROM mo_rework_yx ORDER BY id
        """,
        "workers": """
            SELECT 'execution' AS source,execution_id AS source_id,
                   ding_user_id AS user_id,user_name_snapshot AS user_name
            FROM mo_execution_worker_yx
            UNION ALL
            SELECT 'receive',receive_id,ding_user_id,user_name_snapshot
            FROM mo_receive_worker_yx
            UNION ALL
            SELECT 'rework',rework_id,ding_user_id,user_name_snapshot
            FROM mo_rework_worker_yx
        """,
        "normal_coverage": """
            SELECT execution_id,SUM(qty_done) AS qty,
                   MIN(complete_time) AS first_complete_time,
                   MAX(complete_time) AS last_complete_time
            FROM mo_execution_completion_yx
            GROUP BY execution_id
        """,
        "rework_coverage": """
            SELECT rework_id,SUM(qty_done) AS qty,
                   MIN(complete_time) AS first_complete_time,
                   MAX(complete_time) AS last_complete_time
            FROM mo_rework_completion_yx
            GROUP BY rework_id
        """,
    }
    try:
        result = {}
        for name, sql in queries.items():
            cur.execute(sql)
            result[name] = cur.fetchall()
        cur.execute("""
            SELECT DATE(c.complete_time) AS date,'normal' AS kind,c.execution_id,
                   SUM(c.qty_done) AS qty,SUM(c.qty_a) AS qty_a,SUM(c.qty_a1) AS qty_a1,
                   SUM(c.qty_a2) AS qty_a2,SUM(c.qty_c) AS qty_c,COUNT(*) AS batch_count
            FROM mo_execution_completion_yx c
            WHERE c.complete_time >= %s AND c.complete_time < %s
            GROUP BY DATE(c.complete_time),c.execution_id
            UNION ALL
            SELECT DATE(c.complete_time),'rework',r.source_execution_id,
                   SUM(c.qty_done),SUM(c.qty_a),SUM(c.qty_a1),SUM(c.qty_a2),SUM(c.qty_c),COUNT(*)
            FROM mo_rework_completion_yx c JOIN mo_rework_yx r ON r.id=c.rework_id
            WHERE c.complete_time >= %s AND c.complete_time < %s
            GROUP BY DATE(c.complete_time),r.source_execution_id
        """, (since, until, since, until))
        result["daily"] = cur.fetchall()
        return result
    finally:
        cur.close()


def tracked_order_rows(data):
    """Include a first-station receipt even before start creates its state row."""
    rows = {}
    for source in ("handovers", "executions", "states"):
        for row in data.get(source, []):
            rows[(str(row["mo_code"]), int(row["sort_seq"]))] = row
    return list(rows.values())


def include_unreported_orders(data, products):
    """Add read-only synthetic states for ERP-open lines with no shop-floor rows."""
    tracked_keys = {
        (str(row["mo_code"]), int(row["sort_seq"]))
        for row in tracked_order_rows(data)
    }
    bindings = {
        (str(row["mo_code"]), int(row["sort_seq"])): int(row["route_id"])
        for row in data.get("bindings", [])
    }
    category_routes = {}
    for row in data.get("category_routes", []):
        category = (row.get("category_name") or "").strip()
        if category:
            category_routes.setdefault(category, int(row["route_id"]))
    states = list(data.get("states", []))
    for key, product in sorted(products.items()):
        if not product.get("erp_open") or key in tracked_keys:
            continue
        category = (product.get("product_category") or "").strip()
        route_id = bindings.get(key) or category_routes.get(category) or 0
        states.append({
            "mo_code": key[0],
            "sort_seq": key[1],
            "route_id": route_id,
            "status": "pending",
            "update_time": None,
            "synthetic": True,
        })
    data["states"] = states
    return data


def build_operations_snapshot(data, products, now, warnings=None):
    """Derive workload from quantities, never from the old done state alone.

    products is keyed by (order code, line). first_issued_qty must come from a
    current ERP query; a missing value means unknown, not zero.
    """
    notices = list(warnings or [])
    route_map = {int(row["id"]): row for row in data.get("routes", [])}
    state_map = {_key(row): row for row in data.get("states", [])}
    route_steps = defaultdict(dict)
    for row in data.get("steps", []):
        route_steps[int(row["route_id"])][int(row["seq"])] = row
    executions = defaultdict(list)
    execution_map = {}
    handovers = {}
    receives = defaultdict(list)
    reworks = defaultdict(list)
    for row in data.get("executions", []):
        executions[(*_key(row), int(row["seq"]))].append(row)
        execution_map[row["id"]] = row
    for row in data.get("handovers", []):
        key = (*_key(row), int(row["to_seq"]))
        if key not in handovers or row["id"] > handovers[key]["id"]:
            handovers[key] = row
    for row in data.get("receives", []):
        receives[(*_key(row), int(row["seq"]))].append(row)
    for row in data.get("reworks", []):
        reworks[(*_key(row), int(row["seq"]))].append(row)
    worker_map = defaultdict(list)
    for worker in data.get("workers", []):
        name = (worker.get("user_name") or "").strip()
        if name:
            worker_map[(worker["source"], worker["source_id"])].append(name)

    def names(source, rows):
        return [name for row in rows for name in worker_map[(source, row["id"])]]

    normal_coverage_rows = {
        row["execution_id"]: row for row in data.get("normal_coverage", [])
    }
    rework_coverage_rows = {
        row["rework_id"]: row for row in data.get("rework_coverage", [])
    }

    missing_receipt = missing_first = missing_product = duplicate_execution = 0
    orders = []
    for tracked in tracked_order_rows(data):
        key = _key(tracked)
        route = route_map.get(key[2], {})
        state = state_map.get(key, {})
        product = products.get(key[:2], {})
        if not product:
            missing_product += 1
        configured_steps = route_steps.get(key[2], {})
        seqs = set(configured_steps)
        seqs.update(k[3] for k in executions if k[:3] == key)
        seqs.update(k[3] for k in handovers if k[:3] == key)
        first_seq = min(seqs, default=1)
        result_steps = []
        for seq in sorted(seqs):
            step_key = (*key, seq)
            records = executions.get(step_key, [])
            execution = records[-1] if records else {}
            incoming = handovers.get(step_key)
            receive_rows = receives.get(step_key, [])
            active_receives = [row for row in receive_rows if row["status"] == "processing"]
            rework_rows = reworks.get(step_key, [])
            active_reworks = [row for row in rework_rows if row["status"] == "processing"
                              and _qty(row["qty_input"]) - sum((_qty(row.get(field)) for field in GRADES), Decimal(0)) > EPSILON]
            receiving = sum((_qty(row["qty_input"]) for row in active_receives), Decimal(0))
            normal_done = sum((_qty(row["qty_done"]) for row in records), Decimal(0))
            grade_totals = {
                field: sum((_qty(row.get(field)) for row in records), Decimal(0))
                for field in GRADES
            }
            transferable = sum((_qty(row.get(field)) for row in records
                                for field in GRADES[:3]), Decimal(0))
            if incoming:
                received = _qty(incoming["qty_in"]) + receiving
            elif not records:
                received = receiving
            else:
                received = None
                missing_receipt += 1
            # An execution's cumulative counter is normal output only. Rework
            # changes its grade distribution, not qty_done.
            remaining = max(Decimal(0), received - normal_done) if received is not None else None
            rework_remaining = sum((max(Decimal(0), _qty(row["qty_input"]) - sum(
                (_qty(row.get(field)) for field in GRADES), Decimal(0)
            )) for row in active_reworks), Decimal(0))
            if seq == first_seq:
                issued = product.get("first_issued_qty")
                available = max(Decimal(0), _qty(issued) - received) if issued is not None and received is not None else None
                if available is None:
                    missing_first += 1
            elif incoming:
                good = sum((_qty(incoming.get(field)) for field in (
                    "qty_out_a", "qty_out_a1", "qty_out_a2"
                )), Decimal(0))
                if good <= 0 and _qty(incoming.get("qty_out")) > 0:
                    upstream = executions.get((*key, int(incoming["from_seq"])), [])
                    # Old handovers can contain the total including C; use the
                    # upstream grade balance rather than passing those C on.
                    good = sum((_qty(row.get(field)) for row in upstream
                                for field in GRADES[:3]), Decimal(0)) if upstream else None
                available = max(Decimal(0), good - received) if good is not None and received is not None else None
            else:
                available = Decimal(0)
            if len(records) > 1:
                duplicate_execution += 1
                received = remaining = available = None
            if remaining is not None and remaining > EPSILON:
                status = "partial" if normal_done > 0 else ("processing" if records else "received")
            elif remaining is None and any(row["status"] == "processing" for row in records):
                status = "processing"
            elif normal_done > 0:
                status = "received_done"
            else:
                status = "pending"
            start_times = [
                _stamp(row.get("start_time"))
                for row in records + rework_rows
                if row.get("start_time")
            ]
            end_times = [
                _stamp(row.get("end_time"))
                for row in records + rework_rows
                if row.get("end_time")
            ]
            end_times.extend(
                _stamp(normal_coverage_rows[row["id"]].get("last_complete_time"))
                for row in records
                if row["id"] in normal_coverage_rows
                and normal_coverage_rows[row["id"]].get("last_complete_time")
            )
            end_times.extend(
                _stamp(rework_coverage_rows[row["id"]].get("last_complete_time"))
                for row in rework_rows
                if row["id"] in rework_coverage_rows
                and rework_coverage_rows[row["id"]].get("last_complete_time")
            )
            result_steps.append({
                "seq": seq,
                "is_first_step": seq == first_seq,
                "first_issued_qty": _number(_qty(product['first_issued_qty']))
                    if seq == first_seq and product.get('first_issued_qty') is not None else None,
                "first_issue_calculation": product.get('first_issue_calculation')
                    if seq == first_seq else None,
                "process_name": execution.get("process_name") or configured_steps.get(seq, {}).get("process_name") or f"第{seq}工序",
                "station_id": execution.get("station_id"),
                "station_name": execution.get("station_name"),
                "status": status,
                "normal_received_qty": _number(received),
                "normal_done_qty": _number(normal_done),
                "qty_a": _number(grade_totals["qty_a"]),
                "qty_a1": _number(grade_totals["qty_a1"]),
                "qty_a2": _number(grade_totals["qty_a2"]),
                "qty_c": _number(grade_totals["qty_c"]),
                "transferable_qty": _number(transferable),
                "normal_remaining_qty": _number(remaining),
                "receive_available_qty": _number(available),
                "receiving_qty": _number(receiving),
                "rework_remaining_qty": _number(rework_remaining),
                "workers": sorted(set(names("execution", records) + names("receive", active_receives))),
                "rework_workers": sorted(set(names("rework", active_reworks))),
                "first_start_time": min(start_times, default=None),
                "last_end_time": max(end_times, default=None),
                "last_activity": _latest(records + receive_rows + rework_rows + ([incoming] if incoming else [])),
            })
        plan_qty = _qty(product["plan_qty"]) if product.get("plan_qty") is not None else None
        final_seq = max(configured_steps, default=None)
        final_done = next((_qty(step["normal_done_qty"]) for step in result_steps if step["seq"] == final_seq), None)
        shortfall = max(Decimal(0), plan_qty - final_done) if plan_qty is not None and final_done is not None else None
        has_work = any((step["normal_remaining_qty"] or 0) > float(EPSILON)
                       or (step["normal_remaining_qty"] is None and step["status"] == "processing")
                       for step in result_steps)
        has_receivable = any((step["receive_available_qty"] or 0) > float(EPSILON) for step in result_steps)
        has_rework = any(step["rework_remaining_qty"] > float(EPSILON) for step in result_steps)
        has_reporting = not bool(state.get("synthetic"))
        has_unknown = shortfall is None or any(step["normal_remaining_qty"] is None
                                             or step["receive_available_qty"] is None for step in result_steps)
        active = (not has_reporting or has_work or has_receivable or has_rework
                  or has_unknown or (shortfall is not None and shortfall > EPSILON)
                  or state.get("status") != "done")
        start = _stamp(product.get("plan_start_date"))
        due = _stamp(product.get("plan_due_date"))
        original_start = _stamp(product.get("original_start_date"))
        original_due = _stamp(product.get("original_due_date"))
        if original_start and start and original_start[:10] == start[:10]:
            original_start = None
        if original_due and due and original_due[:10] == due[:10]:
            original_due = None
        orders.append({
            "mo_code": key[0], "sort_seq": key[1], "route_id": key[2],
            "route_name": route.get("route_name") or "未找到路线",
            "inv_code": product.get("inv_code") or "",
            "inv_name": product.get("inv_name") or "",
            "inv_std": product.get("inv_std") or "",
            "so_code_008": product.get("so_code_008") or "",
            "source_account": product.get("source_account") or "",
            "source_so_code": product.get("source_so_code") or "",
            "customer_code": product.get("customer_code") or "",
            "customer_name": product.get("customer_name") or "",
            "erp_deleted": bool(product.get("erp_deleted")),
            "is_closed": bool(product.get("is_closed")),
            "unit_name": product.get("unit_name") or "未标单位",
            "dept_name": product.get("production_department") or route.get("dept_name") or "未标部门",
            "plan_qty": _number(plan_qty), "plan_start_date": start, "plan_due_date": due,
            "original_start_date": original_start, "original_due_date": original_due,
            "plan_shortfall_qty": _number(shortfall),
            "last_activity": max((step["last_activity"] for step in result_steps if step["last_activity"]), default=_latest([state])),
            "is_active": bool(active), "has_work": has_work,
            "has_receivable": has_receivable, "has_rework": has_rework,
            "has_reporting": has_reporting,
            "is_overdue": bool(active and due and due[:10] < now.date().isoformat()),
            "steps": result_steps,
        })

    daily = {}
    for row in data.get("daily", []):
        execution = execution_map.get(row["execution_id"])
        if not execution:
            continue
        product = products.get(_key(execution)[:2], {})
        configured = route_steps.get(int(execution["route_id"]), {})
        is_final = bool(configured and int(execution["seq"]) == max(configured))
        group = (_stamp(row["date"])[:10], row["kind"], execution["process_name"],
                 execution.get("station_name") or "未标工站", product.get("unit_name") or "未标单位", is_final)
        if group not in daily:
            daily[group] = {"date": group[0], "kind": group[1], "process_name": group[2],
                            "station_name": group[3], "unit_name": group[4], "is_final": group[5],
                            "qty": Decimal(0), **{field: Decimal(0) for field in GRADES}, "batch_count": 0}
        for field in ("qty", *GRADES):
            daily[group][field] += _qty(row[field])
        daily[group]["batch_count"] += int(row["batch_count"])
    daily_rows = [{key: _number(value) if isinstance(value, Decimal) else value for key, value in row.items()}
                  for _, row in sorted(daily.items())]

    normal_coverage = {key: _qty(row["qty"]) for key, row in normal_coverage_rows.items()}
    rework_coverage = {key: _qty(row["qty"]) for key, row in rework_coverage_rows.items()}
    missing_normal = sum(_qty(row["qty_done"]) > normal_coverage.get(row["id"], Decimal(0)) + EPSILON
                         for row in data.get("executions", []))
    missing_rework = sum(sum((_qty(row.get(field)) for field in GRADES), Decimal(0)) >
                         rework_coverage.get(row["id"], Decimal(0)) + EPSILON for row in data.get("reworks", []))
    if missing_normal or missing_rework:
        notices.append(f"有{missing_normal}条历史正常工序、{missing_rework}条历史返工缺少完整分批明细；近7日报工仅统计现存批次，不用累计数量倒推。")
    if missing_receipt:
        notices.append(f"有{missing_receipt}道历史工序缺少接收记录，应完数量和正常待完暂不推算。")
    if missing_first:
        notices.append(f"有{missing_first}条工单首站领料或接收数量未能核对，可接收量显示为待核对。")
    if duplicate_execution:
        notices.append(f"有{duplicate_execution}道工序存在多条执行记录，接收分摊不明确，待完和可接收量显示为待核对。")
    if missing_product:
        notices.append(f"有{missing_product}条工单未获取到ERP产品资料，仍显示报工记录。")
    orders.sort(key=lambda row: row["last_activity"] or "", reverse=True)
    orders.sort(key=lambda row: (not row["is_active"], not row["has_rework"], not row["is_overdue"]))
    return {"generated_at": _stamp(now), "today": now.date().isoformat(),
            "orders": orders, "daily": daily_rows, "warnings": list(dict.fromkeys(notices))}
