"""Read-only work-order completion flow report calculations."""
from decimal import Decimal


EPSILON = Decimal("0.0001")


def _qty(value):
    return Decimal(str(value or 0))


def _number(value):
    return None if value is None else float(value)


def _timestamp(value):
    return value.strftime("%Y-%m-%d %H:%M:%S") if hasattr(value, "strftime") else value


def build_flow_rows(step_rows, handover_rows, receive_rows, rework_rows):
    """Build adjacent-step comparisons without counting rework as new output."""
    latest_handovers = {}
    for row in handover_rows:
        seq = int(row["to_seq"])
        if seq not in latest_handovers or int(row["id"]) > int(latest_handovers[seq]["id"]):
            latest_handovers[seq] = row

    active_receives = {}
    for row in receive_rows:
        if row.get("status") == "processing":
            seq = int(row["seq"])
            active_receives[seq] = active_receives.get(seq, Decimal(0)) + _qty(row["qty_input"])

    rework_remaining = {}
    for row in rework_rows:
        if row.get("status") != "processing":
            continue
        seq = int(row["seq"])
        completed = sum((_qty(row.get(field)) for field in ("qty_a", "qty_a1", "qty_a2", "qty_c")), Decimal(0))
        remaining = max(Decimal(0), _qty(row["qty_input"]) - completed)
        rework_remaining[seq] = rework_remaining.get(seq, Decimal(0)) + remaining

    rows = []
    for source in sorted(step_rows, key=lambda item: int(item["seq"])):
        seq = int(source["seq"])
        incoming = latest_handovers.get(seq)
        receiving = active_receives.get(seq, Decimal(0))
        if incoming is not None:
            received = _qty(incoming.get("qty_in")) + receiving
        elif source.get("execution_id") is None:
            received = receiving
        else:
            received = None

        done = _qty(source.get("qty_done"))
        qty_a = _qty(source.get("qty_a"))
        qty_a1 = _qty(source.get("qty_a1"))
        qty_a2 = _qty(source.get("qty_a2"))
        qty_c = _qty(source.get("qty_c"))
        transferable = qty_a + qty_a1 + qty_a2
        status = source.get("execution_status")
        rows.append({
            "seq": seq,
            "process_name": source.get("process_name") or f"第{seq}工序",
            "station_name": source.get("station_name") or "",
            "process_status": {
                "done": "已完成",
                "processing": "进行中",
                "interrupted": "已中断",
            }.get(status, "未开始"),
            "received_qty": _number(received),
            "done_qty": _number(done),
            "transferable_qty": _number(transferable),
            "qty_a": _number(qty_a),
            "qty_a1": _number(qty_a1),
            "qty_a2": _number(qty_a2),
            "qty_c": _number(qty_c),
            "completion_difference": _number(received - done) if received is not None else None,
            "rework_remaining_qty": _number(rework_remaining.get(seq, Decimal(0))),
            "start_time": _timestamp(source.get("start_time")),
            "end_time": _timestamp(source.get("end_time")),
        })

    for index, row in enumerate(rows):
        previous = rows[index - 1] if index > 0 else None
        following = rows[index + 1] if index + 1 < len(rows) else None
        row["previous_done_qty"] = previous["done_qty"] if previous else None
        row["previous_transferable_qty"] = previous["transferable_qty"] if previous else None
        row["receive_difference"] = (
            previous["done_qty"] - row["received_qty"]
            if previous and previous["done_qty"] is not None and row["received_qty"] is not None
            else None
        )
        row["next_received_qty"] = following["received_qty"] if following else None
        row["downstream_difference"] = (
            row["done_qty"] - following["received_qty"]
            if following and row["done_qty"] is not None and following["received_qty"] is not None
            else None
        )
    return rows


def completed_order_options(conn, keyword):
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT DISTINCT ws.mo_code
            FROM mo_wo_state_yx ws
            JOIN (
                SELECT route_id, MAX(seq) AS last_seq
                FROM mo_route_step_yx GROUP BY route_id
            ) last_step ON last_step.route_id=ws.route_id
            JOIN mo_execution_yx final_execution
              ON final_execution.mo_code=ws.mo_code
             AND final_execution.sort_seq=ws.sort_seq
             AND final_execution.route_id=ws.route_id
             AND final_execution.seq=last_step.last_seq
             AND final_execution.status='done'
            WHERE ws.mo_code LIKE %s
            ORDER BY ws.mo_code DESC
            LIMIT 20
        """, (f"%{keyword}%",))
        return [str(row["mo_code"]) for row in cur.fetchall()]
    finally:
        cur.close()


def completed_order_lines(conn, mo_code):
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT ws.sort_seq,ctx.inv_code,ctx.inv_name,ctx.inv_std,
                   final_execution.end_time AS final_end_time
            FROM mo_wo_state_yx ws
            JOIN (
                SELECT route_id, MAX(seq) AS last_seq
                FROM mo_route_step_yx GROUP BY route_id
            ) last_step ON last_step.route_id=ws.route_id
            JOIN mo_execution_yx final_execution
              ON final_execution.mo_code=ws.mo_code
             AND final_execution.sort_seq=ws.sort_seq
             AND final_execution.route_id=ws.route_id
             AND final_execution.seq=last_step.last_seq
             AND final_execution.status='done'
            LEFT JOIN mo_workorder_context_yx ctx
              ON ctx.mo_code=ws.mo_code AND ctx.sort_seq=ws.sort_seq
            WHERE ws.mo_code=%s
            ORDER BY ws.sort_seq
        """, (mo_code,))
        return [{
            "sort_seq": int(row["sort_seq"]),
            "inv_code": row.get("inv_code") or "",
            "inv_name": row.get("inv_name") or "",
            "inv_std": row.get("inv_std") or "",
            "final_end_time": _timestamp(row.get("final_end_time")),
        } for row in cur.fetchall()]
    finally:
        cur.close()


def completion_flow_report(conn, mo_code, sort_seq):
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT ws.mo_code,ws.sort_seq,ws.route_id,route.route_name,
                   ctx.customer_name,ctx.inv_code,ctx.inv_name,ctx.inv_std,ctx.plan_qty,
                   final_execution.end_time AS final_end_time
            FROM mo_wo_state_yx ws
            JOIN mo_route_yx route ON route.id=ws.route_id
            JOIN (
                SELECT route_id, MAX(seq) AS last_seq
                FROM mo_route_step_yx GROUP BY route_id
            ) last_step ON last_step.route_id=ws.route_id
            JOIN mo_execution_yx final_execution
              ON final_execution.mo_code=ws.mo_code
             AND final_execution.sort_seq=ws.sort_seq
             AND final_execution.route_id=ws.route_id
             AND final_execution.seq=last_step.last_seq
             AND final_execution.status='done'
            LEFT JOIN mo_workorder_context_yx ctx
              ON ctx.mo_code=ws.mo_code AND ctx.sort_seq=ws.sort_seq
            WHERE ws.mo_code=%s AND ws.sort_seq=%s
            LIMIT 1
        """, (mo_code, sort_seq))
        header = cur.fetchone()
        if not header:
            return None
        route_id = int(header["route_id"])

        cur.execute("""
            SELECT step.seq,process.process_name,execution.id AS execution_id,
                   execution.station_name,execution.status AS execution_status,
                   execution.qty_done,execution.qty_a,execution.qty_a1,
                   execution.qty_a2,execution.qty_c,execution.start_time,execution.end_time
            FROM mo_route_step_yx step
            JOIN mo_process_yx process ON process.id=step.process_id
            LEFT JOIN mo_execution_yx execution
              ON execution.mo_code=%s AND execution.sort_seq=%s
             AND execution.route_id=step.route_id AND execution.seq=step.seq
            WHERE step.route_id=%s
            ORDER BY step.seq
        """, (mo_code, sort_seq, route_id))
        steps = cur.fetchall()
        cur.execute("""
            SELECT id,to_seq,status,qty_in
            FROM mo_handover_yx
            WHERE mo_code=%s AND sort_seq=%s AND route_id=%s
            ORDER BY id
        """, (mo_code, sort_seq, route_id))
        handovers = cur.fetchall()
        cur.execute("""
            SELECT id,seq,status,qty_input
            FROM mo_receive_work_yx
            WHERE mo_code=%s AND sort_seq=%s AND route_id=%s
            ORDER BY id
        """, (mo_code, sort_seq, route_id))
        receives = cur.fetchall()
        cur.execute("""
            SELECT id,seq,status,qty_input,qty_a,qty_a1,qty_a2,qty_c
            FROM mo_rework_yx
            WHERE mo_code=%s AND sort_seq=%s AND route_id=%s
            ORDER BY id
        """, (mo_code, sort_seq, route_id))
        reworks = cur.fetchall()

        return {
            "header": {
                "mo_code": str(header["mo_code"]),
                "sort_seq": int(header["sort_seq"]),
                "route_name": header.get("route_name") or "",
                "customer_name": header.get("customer_name") or "",
                "inv_code": header.get("inv_code") or "",
                "inv_name": header.get("inv_name") or "",
                "inv_std": header.get("inv_std") or "",
                "plan_qty": _number(_qty(header["plan_qty"])) if header.get("plan_qty") is not None else None,
                "final_end_time": _timestamp(header.get("final_end_time")),
            },
            "rows": build_flow_rows(steps, handovers, receives, reworks),
        }
    finally:
        cur.close()
