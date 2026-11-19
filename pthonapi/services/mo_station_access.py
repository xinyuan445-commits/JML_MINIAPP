"""Station permissions for the employee ID from the existing login cache."""
import json
import os
import re

import requests
from flask import g, has_request_context
from models.db2 import get_db2 as database

class AccessError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def setting(cur):
    # Shared lock makes an admin toggle wait for in-flight reporting transactions.
    cur.execute("""SELECT enabled,report_access_mode,revision
        FROM mo_station_access_setting_yx WHERE id=1 FOR SHARE""")
    row = cur.fetchone()
    if (not row or row["enabled"] not in (0, 1)
            or row.get("report_access_mode") not in ("exempt", "station", "all")):
        raise AccessError(503, "工站权限配置不可用")
    return {"enabled": bool(row["enabled"]), "report_access_mode": row["report_access_mode"],
            "revision": row["revision"]}


def staff_from_cache(cur, staff_id):
    # Legacy login identifies the operator by jml_staff.id, not selected workers.
    # This is a business permission check, not proof of the caller's identity.
    if not isinstance(staff_id, str) or not staff_id.strip() or len(staff_id) > 64:
        raise AccessError(401, "请先登录")
    cur.execute("SELECT id,name,status FROM jml_staff WHERE BINARY id=%s FOR SHARE", (staff_id,))
    person = cur.fetchone()
    if not person or str(person["status"]) != "1":
        raise AccessError(403, "员工账号不可用")
    return person


def positive_id(value):
    if isinstance(value, bool) or not re.fullmatch(r"[1-9][0-9]{0,18}", str(value)):
        raise AccessError(400, "记录编号无效")
    return int(value)


def policy(cur, staff_id):
    current = setting(cur)
    active = current["enabled"]
    cur.execute("SELECT id,station_name FROM mo_workstation_yx WHERE is_active=1 ORDER BY id FOR SHARE")
    stations = {row["id"]: row["station_name"] for row in cur.fetchall()}
    # With enforcement off, no dependency on admin permission tables.
    if not active:
        return {"stations": stations, "allowed": set(stations), "scope": set(), "exempt": False,
                "enabled": False, "leader": False,
                "report_access_mode": current["report_access_mode"]}
    cur.execute("SELECT staff_ids FROM mo_station_staff_exemption_yx WHERE id=1 FOR SHARE")
    exempt_row = cur.fetchone()
    exempt = staff_id in (json.loads(exempt_row["staff_ids"]) if exempt_row else [])
    cur.execute("SELECT station_id,leader_staff_id,scanner_staff_ids FROM mo_station_staff_config_yx ORDER BY station_id FOR SHARE")
    configs = {row["station_id"]: row for row in cur.fetchall()}
    scope = set(stations)
    allowed = set(stations) if exempt else set()
    for station in scope & set(configs):
        row = configs[station]
        if row["leader_staff_id"] == staff_id or staff_id in json.loads(row["scanner_staff_ids"]):
            allowed.add(station)
    cur.execute("""SELECT station_id FROM mo_station_staff_proxy_yx
        WHERE staff_id=%s AND starts_at<=UTC_TIMESTAMP() AND ends_at>UTC_TIMESTAMP() FOR SHARE""", (staff_id,))
    allowed.update(row["station_id"] for row in cur.fetchall() if row["station_id"] in stations)
    return {"stations": stations, "allowed": allowed, "scope": scope, "exempt": exempt,
            "enabled": True, "leader": any(row['leader_staff_id'] == staff_id for row in configs.values()),
            "report_access_mode": current["report_access_mode"]}


def execution(cur, identifier):
    cur.execute("SELECT id,mo_code,sort_seq,route_id,seq,station_id,status FROM mo_execution_yx WHERE id=%s FOR UPDATE",
        (positive_id(identifier),))
    row = cur.fetchone()
    if not row:
        raise AccessError(404, "工序记录不存在")
    return row


def task_execution(cur, table, foreign_key, identifier):
    # Table/column names are internal constants, never request values.
    cur.execute(f"SELECT {foreign_key} FROM {table} WHERE id=%s FOR UPDATE", (positive_id(identifier),))
    row = cur.fetchone()
    if not row:
        raise AccessError(404, "作业记录不存在")
    return execution(cur, row[foreign_key])


def order_key(body):
    code = body.get("mo_code")
    if not isinstance(code, str) or not code.strip() or len(code) > 100:
        raise AccessError(400, "工单号无效")
    return code.strip(), positive_id(body.get("sort_seq"))


def route_target(cur, body, find_route):
    code, line = order_key(body)
    cur.execute("SELECT route_id FROM mo_wo_route_yx WHERE mo_code=%s AND sort_seq=%s FOR SHARE", (code, line))
    bound = cur.fetchone()
    cur.execute("SELECT route_id,current_seq,status FROM mo_wo_state_yx WHERE mo_code=%s AND sort_seq=%s FOR UPDATE", (code, line))
    state = cur.fetchone()
    route = bound["route_id"] if bound else state["route_id"] if state else None
    if not route:
        # Do not let a caller choose another product category to authorize a different route.
        try:
            response = requests.get(os.getenv("MO_WORKORDER_DETAIL_URL", "https://api.jinmilong.cn/api/mo/workorder/detail"),
                params={"mo_code": code, "sort_seq": line}, timeout=8, allow_redirects=False)
            response.raise_for_status()
            detail = response.json()
            if detail.get("code") != 0:
                raise ValueError("unavailable")
            category = detail["data"]["header"]["CategoryName"]
            if not isinstance(category, str) or not category.strip():
                raise ValueError("unavailable")
        except (requests.RequestException, ValueError, KeyError, TypeError, AttributeError):
            raise AccessError(503, "工单资料暂不可用") from None
        body["category_name"] = category
        route = find_route(cur, code, line, category)
    if not route:
        raise AccessError(409, "未找到工艺路线")
    seq = state["current_seq"] if state else 1
    cur.execute("SELECT id,station_id FROM mo_execution_yx WHERE mo_code=%s AND sort_seq=%s AND status='processing' ORDER BY id FOR UPDATE", (code, line))
    active = cur.fetchall()
    if len(active) > 1:
        raise AccessError(409, "工序记录不唯一，请联系管理员")
    if active:
        return {**execution(cur, active[0]["id"]), "fixed": True}
    cur.execute("""SELECT id FROM mo_handover_yx WHERE mo_code=%s AND sort_seq=%s AND to_seq=%s
        ORDER BY id DESC LIMIT 1 FOR UPDATE""", (code, line, seq))
    handover = cur.fetchone()
    station = None
    if handover:
        cur.execute("SELECT station_id FROM mo_station_receive_binding_yx WHERE handover_id=%s FOR UPDATE", (handover["id"],))
        binding = cur.fetchone()
        station = binding["station_id"] if binding else None
    return {"route_id": route, "seq": seq, "station_id": station,
        "handover_id": handover["id"] if handover else None, "fixed": bool(station)}


def targets(cur, action, body, find_route):
    if action in ("start", "receive-first") or (action == "context" and not body.get("exec_id")):
        return [route_target(cur, body, find_route)]
    if action == "receive":
        code, line = order_key(body)
        cur.execute("SELECT id,route_id,to_seq FROM mo_handover_yx WHERE id=%s AND mo_code=%s AND sort_seq=%s FOR UPDATE",
            (positive_id(body.get("handover_id")), code, line))
        row = cur.fetchone()
        if not row:
            raise AccessError(404, "交接记录不存在")
        cur.execute("SELECT station_id FROM mo_station_receive_binding_yx WHERE handover_id=%s FOR UPDATE", (row["id"],))
        binding = cur.fetchone()
        return [{"route_id": row["route_id"], "seq": row["to_seq"], "station_id": binding["station_id"] if binding else None,
            "fixed": bool(binding), "handover_id": row["id"]}]
    if action == "complete" and not body.get("exec_id"):
        code, line = order_key(body)
        cur.execute("SELECT id FROM mo_execution_yx WHERE mo_code=%s AND sort_seq=%s AND status='processing' ORDER BY id FOR UPDATE", (code, line))
        rows = cur.fetchall()
        if len(rows) != 1:
            raise AccessError(409, "进行中的工序记录不唯一")
        return [{**execution(cur, rows[0]["id"]), "fixed": True}]
    if action == "receive-work/complete":
        return [{**task_execution(cur, "mo_receive_work_yx", "execution_id", body.get("receive_id")), "fixed": True}]
    if action == "rework/complete":
        return [{**task_execution(cur, "mo_rework_yx", "source_execution_id", body.get("rework_id")), "fixed": True}]
    main = execution(cur, body.get("exec_id"))
    result = [{**main, "fixed": True}]
    if action == "complete-combined":
        rework_body, normal_body = body.get("rework"), body.get("normal")
        if not isinstance(rework_body, dict) or not isinstance(normal_body, dict):
            raise AccessError(400, "完工参数无效")
        rework = task_execution(cur, "mo_rework_yx", "source_execution_id", rework_body.get("rework_id"))
        if rework["id"] != main["id"]:
            raise AccessError(409, "返工任务与工序不一致")
        result.append({**rework, "fixed": True})
        if body.get("normal_type") == "receive":
            received = task_execution(cur, "mo_receive_work_yx", "execution_id", normal_body.get("receive_id"))
            if received["id"] != main["id"]:
                raise AccessError(409, "接收任务与工序不一致")
            result.append({**received, "fixed": True})
    return result


def choices(cur, target, access):
    if target.get("fixed"):
        station = target.get("station_id")
        if not station:
            raise AccessError(409, "历史记录未指定工站，请联系管理员")
        if target.get("handover_id"):
            cur.execute("""SELECT ss.station_id FROM mo_route_step_yx rs
                JOIN mo_step_station_yx ss ON ss.step_id=rs.id
                WHERE rs.route_id=%s AND rs.seq=%s ORDER BY ss.station_id FOR SHARE""", (target["route_id"], target["seq"]))
            if station not in {row["station_id"] for row in cur.fetchall()}:
                raise AccessError(409, "接收工站与当前路线不一致，请联系管理员")
        return [station] if station in access["allowed"] else []
    cur.execute("""SELECT ss.station_id FROM mo_route_step_yx rs
        JOIN mo_step_station_yx ss ON ss.step_id=rs.id
        WHERE rs.route_id=%s AND rs.seq=%s ORDER BY ss.station_id FOR SHARE""", (target["route_id"], target["seq"]))
    return sorted({row["station_id"] for row in cur.fetchall()} & access["allowed"])


def authorize(cur, resolved, body, access):
    selected = None
    for target in resolved:
        available = choices(cur, target, access)
        if not available:
            raise AccessError(403, "无该工站操作权限")
        requested = body.get("station_id")
        station = target.get("station_id") if target.get("fixed") else (
            positive_id(requested) if requested not in (None, "") else available[0] if len(available) == 1 else None)
        if station is None:
            raise AccessError(400, "请选择工站")
        if station not in available or (target.get("fixed") and requested not in (None, "") and positive_id(requested) != station):
            raise AccessError(403, "无该工站操作权限")
        if selected is not None and selected != station:
            raise AccessError(409, "作业工站不一致")
        selected = station
    return selected


class DeferredConnection:
    """Keep original reporting functions inside the permission-check transaction."""
    def __init__(self, connection):
        self.connection = connection
        self.committed = False
        self.rolled_back = False

    def cursor(self, *args, **kwargs):
        return self.connection.cursor(*args, **kwargs)

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True
        self.connection.rollback()

    def close(self):
        pass


def business_db():
    if has_request_context() and hasattr(g, "mo_station_connection"):
        return g.mo_station_connection
    return database()
