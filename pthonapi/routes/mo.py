from datetime import datetime, date
from functools import wraps
import hmac
import json
import os
import re

import requests
from flask import Blueprint, jsonify, request, session
from models.db2 import get_db2


def _ser(row):
    if row is None:
        return None
    return {k: (v.strftime('%Y-%m-%d %H:%M:%S') if isinstance(v, (datetime, date)) else v)
            for k, v in row.items()}


def _format_duration(start_time, end_time):
    if not start_time or not end_time:
        return "-"
    total_seconds = max(0, int((end_time - start_time).total_seconds()))
    if total_seconds < 60:
        return "不足1分钟"
    total_minutes = total_seconds // 60
    days, remainder = divmod(total_minutes, 24 * 60)
    hours, minutes = divmod(remainder, 60)
    parts = []
    if days:
        parts.append(f"{days}天")
    if hours:
        parts.append(f"{hours}小时")
    if minutes or not parts:
        parts.append(f"{minutes}分钟")
    return "".join(parts)


mo_bp = Blueprint("mo", __name__)

MO_WORKORDER_DETAIL_URL = os.getenv(
    "MO_WORKORDER_DETAIL_URL",
    "https://api.jinmilong.cn/api/mo/workorder/detail"
)


def _first_step_material_shortages(mo_code, sort_seq):
    """实时核对子件领料；只检查料号以 1、2、31 开头且应领数量大于 0 的材料。"""
    try:
        response = requests.get(
            MO_WORKORDER_DETAIL_URL,
            params={"mo_code": mo_code, "sort_seq": sort_seq},
            timeout=8
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise RuntimeError("暂时无法核对ERP领料数量，请稍后重试") from exc
    if payload.get("code") != 0:
        raise RuntimeError(payload.get("msg") or "暂时无法核对ERP领料数量，请稍后重试")

    shortages = []
    for item in (payload.get("data") or {}).get("components") or []:
        code = str(item.get("sub_code") or "").strip()
        if not code.startswith(("1", "2", "31")):
            continue
        try:
            planned = float(item.get("qty_plan") or 0)
            issued = float(item.get("qty_issued") or 0)
        except (TypeError, ValueError):
            planned = issued = 0
        if planned > 0 and issued + 0.0001 < planned:
            shortages.append({
                "sub_code": code,
                "sub_name": item.get("sub_name") or "",
                "qty_plan": planned,
                "qty_issued": issued
            })
    return shortages


def _route_admin_authorized():
    return session.get("mo_route_admin") is True


def _admin_api_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        expected = os.getenv("MO_ADMIN_API_TOKEN", "")
        supplied = request.headers.get("X-MO-Admin-Token", "")
        if not expected or not hmac.compare_digest(expected, supplied):
            return jsonify({"code": 403, "msg": "后台管理接口未授权"}), 403
        return view(*args, **kwargs)

    return wrapped


def _find_route(cur, mo_code, sort_seq, category_name=''):
    """显式绑定 > 已开工状态记录 > 产品类别映射，返回 route_id 或 None。"""
    cur.execute("SELECT route_id FROM mo_wo_route_yx WHERE mo_code=%s AND sort_seq=%s", (mo_code, sort_seq))
    b = cur.fetchone()
    if b:
        return b['route_id']
    cur.execute("SELECT route_id FROM mo_wo_state_yx WHERE mo_code=%s AND sort_seq=%s", (mo_code, sort_seq))
    s = cur.fetchone()
    if s:
        return s['route_id']
    category_name = (category_name or '').strip()
    if category_name:
        cur.execute(
            """
            SELECT r.id
            FROM bj_product_cost_yx pc
            JOIN mo_product_route_yx pr ON pr.product_code=pc.code
            JOIN mo_route_yx r ON r.id=pr.route_id
            WHERE TRIM(pc.name)=TRIM(%s) AND pc.is_enabled=1 AND r.is_active=1
            LIMIT 1
            """,
            (category_name,)
        )
        r = cur.fetchone()
        return r['id'] if r else None
    return None


def _get_operator(cur, user_id):
    if not user_id:
        return ''
    cur.execute("SELECT name FROM jml_staff WHERE id=%s", (user_id,))
    s = cur.fetchone()
    return (s['name'] or '') if s else ''


def _get_worker_map(cur, worker_ids):
    placeholders = ",".join(["%s"] * len(worker_ids))
    cur.execute(f"""
        SELECT u.user_id,u.user_name,u.mobile,u.main_dept_id,d.dept_path
        FROM ding_user_yx u
        LEFT JOIN ding_department_yx d ON d.dept_id=u.main_dept_id
        WHERE u.is_active=1 AND u.user_id IN ({placeholders})
    """, tuple(worker_ids))
    return {row['user_id']: row for row in cur.fetchall()}


def _temp_worker_count(body):
    value = body.get("temp_worker_count", 0)
    if isinstance(value, bool):
        raise ValueError
    count = int(value or 0)
    if count < 0 or count > 50 or float(value or 0) != count:
        raise ValueError
    return count


def _makeup_exceeds_plan(qty_before, qty_add, plan_qty):
    return plan_qty is not None and qty_before + qty_add > plan_qty


def _num(body, key, default=0):
    value = body.get(key, default)
    return float(value or 0)


def _complete_qty_from_body(body):
    qty_a = _num(body, "qty_a")
    qty_a1 = _num(body, "qty_a1")
    qty_a2 = _num(body, "qty_a2")
    qty_c = _num(body, "qty_c")
    values = (qty_a, qty_a1, qty_a2, qty_c)
    if any(v < 0 for v in values):
        raise ValueError("数量不能为负数")
    total = sum(values)
    if total <= 0:
        raise ValueError("完工数量必须大于0")
    good_total = qty_a + qty_a1 + qty_a2
    return qty_a, qty_a1, qty_a2, qty_c, total, good_total


def _receive_qty_from_body(body, prefix="qty"):
    if not any(body.get(f"{prefix}_{grade}") not in (None, "") for grade in ("a", "a1", "a2")):
        fallback = body.get(prefix)
        if fallback not in (None, ""):
            body = dict(body)
            body[f"{prefix}_a"] = fallback
    qty_a = _num(body, f"{prefix}_a")
    qty_a1 = _num(body, f"{prefix}_a1")
    qty_a2 = _num(body, f"{prefix}_a2")
    values = (qty_a, qty_a1, qty_a2)
    if any(v < 0 for v in values):
        raise ValueError("数量不能为负数")
    total = sum(values)
    if total <= 0:
        raise ValueError("接收数量必须大于0")
    if any(v > 99999 for v in values) or total > 99999:
        raise ValueError("数量不能超过99999")
    return qty_a, qty_a1, qty_a2, total


# ----------------------------------------------------------------
# 菜单
# ----------------------------------------------------------------
@mo_bp.get("/menu")
def get_mo_menu():
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT id, menu_name, menu_key, path, emoji, description
            FROM mo_menu_yx WHERE is_active = 1 ORDER BY sort ASC, id ASC
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": rows})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)}), 500


# ----------------------------------------------------------------
# 工序管理
# ----------------------------------------------------------------
@mo_bp.get("/process/list")
def process_list():
    keyword = request.args.get("keyword", "").strip()
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        if keyword:
            cur.execute("""
                SELECT id, process_code, process_name, description, sort, is_active, create_time
                FROM mo_process_yx
                WHERE process_code LIKE %s OR process_name LIKE %s
                ORDER BY sort ASC, id ASC
            """, (f"%{keyword}%", f"%{keyword}%"))
        else:
            cur.execute("""
                SELECT id, process_code, process_name, description, sort, is_active, create_time
                FROM mo_process_yx ORDER BY sort ASC, id ASC
            """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": [_ser(r) for r in rows]})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@mo_bp.get("/process/detail")
def process_detail():
    pid = request.args.get("id", "")
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM mo_process_yx WHERE id = %s", (pid,))
        row = cur.fetchone()
        cur.close(); conn.close()
        if not row:
            return jsonify({"code": 1, "msg": "记录不存在"})
        return jsonify({"code": 0, "data": _ser(row)})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/process/add")
@_admin_api_required
def process_add():
    body = request.get_json() or {}
    code = body.get("process_code", "").strip()
    name = body.get("process_name", "").strip()
    desc = body.get("description", "").strip()
    sort = int(body.get("sort", 0) or 0)
    if not code or not name:
        return jsonify({"code": 1, "msg": "工序编码和名称不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO mo_process_yx (process_code, process_name, description, sort)
            VALUES (%s, %s, %s, %s)
        """, (code, name, desc or None, sort))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "新增成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/process/update")
@_admin_api_required
def process_update():
    body = request.get_json() or {}
    pid  = body.get("id")
    code = body.get("process_code", "").strip()
    name = body.get("process_name", "").strip()
    desc = body.get("description", "").strip()
    sort = int(body.get("sort", 0) or 0)
    if not pid or not code or not name:
        return jsonify({"code": 1, "msg": "参数不完整"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        cur.execute("""
            UPDATE mo_process_yx SET process_code=%s, process_name=%s, description=%s, sort=%s
            WHERE id=%s
        """, (code, name, desc or None, sort, pid))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "更新成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/process/toggle")
@_admin_api_required
def process_toggle():
    body = request.get_json() or {}
    pid = body.get("id")
    if not pid:
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        cur.execute("UPDATE mo_process_yx SET is_active = 1 - is_active WHERE id = %s", (pid,))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "操作成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


# ----------------------------------------------------------------
# 工单执行状态
# ----------------------------------------------------------------
@mo_bp.get("/wo-status")
def wo_status():
    mo_code   = request.args.get("mo_code", "").strip()
    sort_seq  = request.args.get("sort_seq", "")
    category_name = request.args.get("category_name", "").strip()
    if not mo_code or not sort_seq:
        return jsonify({"code": 1, "msg": "参数不完整"})
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        route_id = _find_route(cur, mo_code, sort_seq, category_name)
        if not route_id:
            cur.close(); conn.close()
            return jsonify({"code": 0, "data": {"has_route": False}})

        cur.execute("SELECT route_name FROM mo_route_yx WHERE id=%s", (route_id,))
        route = cur.fetchone()

        cur.execute(
            "SELECT current_seq, status FROM mo_wo_state_yx WHERE mo_code=%s AND sort_seq=%s",
            (mo_code, sort_seq)
        )
        state = cur.fetchone()
        current_seq    = state['current_seq'] if state else 1
        current_status = state['status']      if state else 'pending'

        # 当前步骤 + 允许工站
        cur.execute("""
            SELECT rs.seq, p.process_name,
                   GROUP_CONCAT(ws.id          ORDER BY ws.id SEPARATOR ',') AS station_ids,
                   GROUP_CONCAT(ws.station_name ORDER BY ws.id SEPARATOR ',') AS station_names
            FROM mo_route_step_yx rs
            JOIN mo_process_yx p ON p.id = rs.process_id
            LEFT JOIN mo_step_station_yx ss ON ss.step_id = rs.id
            LEFT JOIN mo_workstation_yx  ws ON ws.id = ss.station_id
            WHERE rs.route_id=%s AND rs.seq=%s
            GROUP BY rs.seq, p.process_name
        """, (route_id, current_seq))
        step = cur.fetchone()

        # 进行中时取实际执行工站
        active_station = ''
        active_exec_id = None
        if current_status == 'processing':
            cur.execute("""
                SELECT id, station_name FROM mo_execution_yx
                WHERE mo_code=%s AND sort_seq=%s AND route_id=%s AND seq=%s AND status='processing'
                LIMIT 1
            """, (mo_code, sort_seq, route_id, current_seq))
            ex = cur.fetchone()
            if ex:
                active_exec_id = ex['id']
                active_station = ex['station_name'] or ''

        active_workers = []
        if active_exec_id:
            cur.execute("""
                SELECT ding_user_id AS user_id, user_name_snapshot AS user_name
                FROM mo_execution_worker_yx
                WHERE execution_id=%s ORDER BY id
            """, (active_exec_id,))
            active_workers = cur.fetchall()

        # 接收状态：当前步骤是否有待确认的交接单
        needs_receipt = False
        handover_info = None
        if current_status == 'pending' and current_seq > 1:
            cur.execute("""
                SELECT h.id, h.qty_out, h.qty_out_a, h.qty_out_a1, h.qty_out_a2,
                       h.status, e.complete_reason,
                       p.process_name AS prev_process_name
                FROM mo_handover_yx h
                LEFT JOIN mo_execution_yx e
                       ON e.mo_code=h.mo_code AND e.sort_seq=h.sort_seq AND e.seq=h.from_seq
                LEFT JOIN mo_route_step_yx rs ON rs.route_id=%s AND rs.seq=h.from_seq
                LEFT JOIN mo_process_yx p ON p.id=rs.process_id
                WHERE h.mo_code=%s AND h.sort_seq=%s AND h.to_seq=%s
                ORDER BY h.id DESC LIMIT 1
            """, (route_id, mo_code, sort_seq, current_seq))
            handover = cur.fetchone()
            if handover and handover['status'] == 'pending':
                needs_receipt = True
                handover_info = {
                    "id":               handover['id'],
                    "qty_out":          float(handover['qty_out']),
                    "qty_out_a":        float(handover.get('qty_out_a') or 0),
                    "qty_out_a1":       float(handover.get('qty_out_a1') or 0),
                    "qty_out_a2":       float(handover.get('qty_out_a2') or 0),
                    "complete_reason":  handover['complete_reason'],
                    "prev_process_name": handover['prev_process_name'] or ''
                }

        # 当前工序已接收数量（非第一道工序且进行中时，取已确认交接单的 qty_in）
        received_qty = None
        if current_status == 'processing' and current_seq > 1:
            cur.execute("""
                SELECT qty_in, qty_in_a, qty_in_a1, qty_in_a2 FROM mo_handover_yx
                WHERE mo_code=%s AND sort_seq=%s AND to_seq=%s AND status='confirmed'
                ORDER BY id DESC LIMIT 1
            """, (mo_code, sort_seq, current_seq))
            hv = cur.fetchone()
            if hv and hv['qty_in'] is not None:
                received_qty = float(hv['qty_in'])

        # 最近一条已完工的执行记录（供接收/追加使用）
        cur.execute("""
            SELECT id, seq, process_name, qty_done, complete_reason
            FROM mo_execution_yx
            WHERE mo_code=%s AND sort_seq=%s AND status='done'
            ORDER BY seq DESC, id DESC LIMIT 1
        """, (mo_code, sort_seq))
        ex_done = cur.fetchone()
        latest_exec = None
        if ex_done:
            cur.execute("""
                SELECT h.qty_out, h.qty_out_a, h.qty_out_a1, h.qty_out_a2,
                       h.qty_in, h.qty_in_a, h.qty_in_a1, h.qty_in_a2, p.process_name
                FROM mo_handover_yx h
                LEFT JOIN mo_route_step_yx rs ON rs.route_id=h.route_id AND rs.seq=h.from_seq
                LEFT JOIN mo_process_yx p ON p.id=rs.process_id
                WHERE h.mo_code=%s AND h.sort_seq=%s AND h.route_id=%s AND h.to_seq=%s
                ORDER BY h.id DESC LIMIT 1
            """, (mo_code, sort_seq, route_id, ex_done['seq']))
            incoming_handover = cur.fetchone()
            if incoming_handover:
                receive_ref_process_name = incoming_handover['process_name'] or '上一步工序'
                receive_ref_qty = float(incoming_handover['qty_out'] or 0)
                receive_current_qty = float(incoming_handover['qty_in'] or 0)
                receive_ref_a = float(incoming_handover.get('qty_out_a') or 0)
                receive_ref_a1 = float(incoming_handover.get('qty_out_a1') or 0)
                receive_ref_a2 = float(incoming_handover.get('qty_out_a2') or 0)
                receive_current_a = float(incoming_handover.get('qty_in_a') or 0)
                receive_current_a1 = float(incoming_handover.get('qty_in_a1') or 0)
                receive_current_a2 = float(incoming_handover.get('qty_in_a2') or 0)
            else:
                cur.execute("""
                    SELECT process_name, qty_done
                    FROM mo_execution_yx
                    WHERE mo_code=%s AND sort_seq=%s AND status='done' AND seq<%s
                    ORDER BY seq DESC, id DESC LIMIT 1
                """, (mo_code, sort_seq, ex_done['seq']))
                prev_done = cur.fetchone()
                receive_ref_process_name = prev_done['process_name'] if prev_done else '上一步工序'
                receive_ref_qty = float(prev_done['qty_done'] or 0) if prev_done else 0
                receive_current_qty = 0
                receive_ref_a = receive_ref_qty
                receive_ref_a1 = 0
                receive_ref_a2 = 0
                receive_current_a = receive_current_a1 = receive_current_a2 = 0
            latest_exec = {
                "id":              ex_done['id'],
                "seq":             ex_done['seq'],
                "process_name":    ex_done['process_name'],
                "qty_done":        float(ex_done['qty_done']),
                "complete_reason": ex_done['complete_reason'],
                "receive_ref_process_name": receive_ref_process_name,
                "receive_ref_qty": receive_ref_qty,
                "receive_current_qty": receive_current_qty,
                "receive_available_qty": max(0, receive_ref_qty - receive_current_qty),
                "receive_ref_a": receive_ref_a,
                "receive_ref_a1": receive_ref_a1,
                "receive_ref_a2": receive_ref_a2,
                "receive_current_a": receive_current_a,
                "receive_current_a1": receive_current_a1,
                "receive_current_a2": receive_current_a2,
            }

        cur.close(); conn.close()

        base = {
            "has_route":    True,
            "route_id":     route_id,
            "route_name":   route['route_name'] if route else '',
            "latest_exec":  latest_exec
        }

        if not step:
            return jsonify({"code": 0, "data": {**base, "status": "done", "current_seq": current_seq}})

        stations = []
        if step['station_ids']:
            ids   = step['station_ids'].split(',')
            names = step['station_names'].split(',')
            stations = [{"id": int(ids[i]), "name": names[i]} for i in range(len(ids))]

        return jsonify({"code": 0, "data": {
            **base,
            "status":         current_status,
            "current_seq":    current_seq,
            "process_name":   step['process_name'],
            "stations":       stations,
            "active_station": active_station,
            "workers":        active_workers,
            "needs_receipt":  needs_receipt,
            "handover":       handover_info,
            "received_qty":   received_qty
        }})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


# ----------------------------------------------------------------
# 开工
# ----------------------------------------------------------------
@mo_bp.post("/start")
def start_work():
    body      = request.get_json() or {}
    mo_code   = body.get("mo_code", "").strip()
    sort_seq  = body.get("sort_seq")
    station_id = body.get("station_id")
    user_id   = body.get("user_id", "").strip()
    start_photo_url = (body.get("start_photo_url") or "").strip() or None
    worker_ids = body.get("worker_ids") or []
    try:
        temp_worker_count = _temp_worker_count(body)
    except (ValueError, TypeError):
        return jsonify({"code": 1, "msg": "临时工人数必须是0到50之间的整数"})
    category_name = body.get("category_name", "").strip()
    if not isinstance(worker_ids, list):
        return jsonify({"code": 1, "msg": "开工人员格式错误"})
    worker_ids = list(dict.fromkeys(
        str(value).strip() for value in worker_ids if str(value).strip()
    ))
    if not mo_code or sort_seq is None:
        return jsonify({"code": 1, "msg": "参数不完整"})
    if not worker_ids:
        return jsonify({"code": 1, "msg": "请至少选择一名正式员工，不能只选择临时工"})
    if len(worker_ids) + temp_worker_count > 50:
        return jsonify({"code": 1, "msg": "单次开工人员不能超过50人"})
    conn = None
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        operator_name = _get_operator(cur, user_id)
        route_id = _find_route(cur, mo_code, sort_seq, category_name)
        if not route_id:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "未找到工艺路线，请联系PMC配置"})

        cur.execute(
            "SELECT current_seq, status FROM mo_wo_state_yx WHERE mo_code=%s AND sort_seq=%s",
            (mo_code, sort_seq)
        )
        state = cur.fetchone()
        if state:
            if state['status'] == 'done':
                cur.close(); conn.close()
                return jsonify({"code": 1, "msg": "工单已完成"})
            if state['status'] == 'processing':
                cur.close(); conn.close()
                return jsonify({"code": 1, "msg": "工单正在进行中"})
        current_seq = state['current_seq'] if state else 1
        if current_seq == 1:
            try:
                material_shortages = _first_step_material_shortages(mo_code, sort_seq)
            except RuntimeError as exc:
                cur.close(); conn.close()
                return jsonify({"code": 1, "msg": str(exc)})
            if material_shortages:
                first = material_shortages[0]
                more = f"，另有{len(material_shortages) - 1}项" if len(material_shortages) > 1 else ""
                cur.close(); conn.close()
                return jsonify({
                    "code": 1,
                    "msg": (
                        f"材料未领齐，不能开工：{first['sub_code']}"
                        f"（应领{first['qty_plan']:g}，已领{first['qty_issued']:g}）{more}"
                    ),
                    "data": {"material_shortages": material_shortages}
                })
        if current_seq > 1:
            cur.execute("""
                SELECT status FROM mo_handover_yx
                WHERE mo_code=%s AND sort_seq=%s AND to_seq=%s
                ORDER BY id DESC LIMIT 1
            """, (mo_code, sort_seq, current_seq))
            incoming = cur.fetchone()
            if not incoming or incoming['status'] != 'confirmed':
                cur.close(); conn.close()
                return jsonify({"code": 1, "msg": "请先完成接收后再开工"})

        cur.execute("""
            SELECT p.id AS process_id, p.process_name
            FROM mo_route_step_yx rs
            JOIN mo_process_yx p ON p.id = rs.process_id
            WHERE rs.route_id=%s AND rs.seq=%s
        """, (route_id, current_seq))
        step = cur.fetchone()
        if not step:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "路线步骤配置有误"})

        station_name = ''
        if station_id:
            cur.execute("SELECT station_name FROM mo_workstation_yx WHERE id=%s", (station_id,))
            ws = cur.fetchone()
            if ws:
                station_name = ws['station_name'] or ''

        worker_map = _get_worker_map(cur, worker_ids) if worker_ids else {}
        missing = [worker_id for worker_id in worker_ids if worker_id not in worker_map]
        if missing:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "所选人员已离职或不存在，请重新选择"})

        now = datetime.now()
        cur.close()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO mo_execution_yx
              (mo_code, sort_seq, route_id, seq, process_id, station_id,
               process_name, station_name, operator_id, operator_name, start_photo_url, start_time, status)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'processing')
        """, (mo_code, sort_seq, route_id, current_seq,
              step['process_id'], station_id or None,
              step['process_name'], station_name or None,
              user_id or None, operator_name or None, start_photo_url, now))
        execution_id = cur.lastrowid

        worker_rows = [
            (
                execution_id, worker_id, worker_map[worker_id]['user_name'],
                worker_map[worker_id]['mobile'], worker_map[worker_id]['main_dept_id'],
                worker_map[worker_id]['dept_path']
            )
            for worker_id in worker_ids
        ]
        worker_rows.extend([
            (execution_id, f"TEMP:{execution_id}:{index}", f"临时工{index}",
             None, None, "临时工")
            for index in range(1, temp_worker_count + 1)
        ])
        cur.executemany("""
            INSERT INTO mo_execution_worker_yx
              (execution_id,ding_user_id,user_name_snapshot,mobile_snapshot,
               dept_id_snapshot,dept_path_snapshot)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, worker_rows)

        cur.execute("""
            INSERT INTO mo_wo_state_yx (mo_code, sort_seq, route_id, current_seq, status)
            VALUES (%s,%s,%s,%s,'processing')
            ON DUPLICATE KEY UPDATE status='processing', route_id=%s, current_seq=%s
        """, (mo_code, sort_seq, route_id, current_seq, route_id, current_seq))

        conn.commit()
        cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "开工成功"})
    except Exception as e:
        if conn:
            try:
                conn.rollback()
                conn.close()
            except Exception:
                pass
        return jsonify({"code": 1, "msg": str(e)})


# ----------------------------------------------------------------
# 完工
# ----------------------------------------------------------------
@mo_bp.post("/complete")
def complete_work():
    body            = request.get_json() or {}
    mo_code         = body.get("mo_code", "").strip()
    sort_seq        = body.get("sort_seq")
    complete_reason = (body.get("complete_reason") or "").strip() or None
    complete_photo_url = (body.get("complete_photo_url") or "").strip() or None
    user_id         = body.get("user_id", "").strip()
    if not mo_code or sort_seq is None:
        return jsonify({"code": 1, "msg": "参数不完整"})
    if not complete_photo_url:
        return jsonify({"code": 1, "msg": "完工请先上传产品照片"})
    try:
        qty_a, qty_a1, qty_a2, qty_c, qty_done, good_total = _complete_qty_from_body(body)
    except (ValueError, TypeError):
        return jsonify({"code": 1, "msg": "数量格式错误或数量不合法"})
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT id, route_id, seq FROM mo_execution_yx
            WHERE mo_code=%s AND sort_seq=%s AND status='processing'
            LIMIT 1
        """, (mo_code, sort_seq))
        exec_rec = cur.fetchone()
        if not exec_rec:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "未找到进行中的执行记录"})

        operator_name = _get_operator(cur, user_id)
        now = datetime.now()
        route_id    = exec_rec['route_id']
        current_seq = exec_rec['seq']

        cur.execute("""
            SELECT seq FROM mo_route_step_yx
            WHERE route_id=%s AND seq > %s
            ORDER BY seq ASC LIMIT 1
        """, (route_id, current_seq))
        next_step = cur.fetchone()

        cur.close()
        cur = conn.cursor()

        cur.execute("""
            UPDATE mo_execution_yx
            SET status='done', qty_done=%s, qty_a=%s, qty_a1=%s, qty_a2=%s, qty_c=%s,
                complete_reason=%s, complete_photo_url=%s,
                complete_operator_id=%s, complete_operator_name=%s, end_time=%s
            WHERE id=%s
        """, (qty_done, qty_a, qty_a1, qty_a2, qty_c,
              complete_reason, complete_photo_url, user_id or None,
              operator_name or None, now, exec_rec['id']))

        if next_step:
            next_seq = next_step['seq']
            cur.execute("""
                UPDATE mo_wo_state_yx SET status='pending', current_seq=%s
                WHERE mo_code=%s AND sort_seq=%s
            """, (next_seq, mo_code, sort_seq))
            # 交接单只流转 A/A1/A2 合格数量，C级不进入下一工序
            cur.execute("""
                INSERT INTO mo_handover_yx
                  (mo_code, sort_seq, route_id, from_seq, to_seq,
                   qty_out, qty_out_a, qty_out_a1, qty_out_a2, operator_out, status)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending')
                ON DUPLICATE KEY UPDATE
                  qty_out=%s, qty_out_a=%s, qty_out_a1=%s, qty_out_a2=%s,
                  qty_in=0, qty_in_a=0, qty_in_a1=0, qty_in_a2=0,
                  operator_out=%s, status='pending',
                  confirm_time=NULL, receipt_reason=NULL
            """, (mo_code, sort_seq, route_id, current_seq, next_seq,
                  good_total, qty_a, qty_a1, qty_a2, operator_name,
                  good_total, qty_a, qty_a1, qty_a2, operator_name))
        else:
            cur.execute("""
                UPDATE mo_wo_state_yx SET status='done'
                WHERE mo_code=%s AND sort_seq=%s
            """, (mo_code, sort_seq))

        conn.commit()
        cur.close(); conn.close()
        return jsonify({
            "code": 0,
            "msg": "完工成功",
            "data": {"exec_id": exec_rec['id'], "has_next": bool(next_step)}
        })
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


# ----------------------------------------------------------------
# 接收（沿用原追加记录）
# ----------------------------------------------------------------
@mo_bp.post("/makeup")
def makeup_work():
    body     = request.get_json() or {}
    mo_code  = body.get("mo_code", "").strip()
    sort_seq = body.get("sort_seq")
    exec_id  = body.get("exec_id")
    qty_add  = body.get("qty_add")
    reason   = (body.get("reason") or "").strip() or None
    user_id  = (body.get("user_id") or "").strip()
    if not mo_code or sort_seq is None or not exec_id or qty_add is None:
        return jsonify({"code": 1, "msg": "参数不完整"})
    try:
        qty_add = float(qty_add)
        if qty_add <= 0:
            return jsonify({"code": 1, "msg": "接收数量必须大于0"})
        if qty_add > 99999:
            return jsonify({"code": 1, "msg": "接收数量不能超过99999"})
    except (ValueError, TypeError):
        return jsonify({"code": 1, "msg": "数量格式错误"})
    conn = None
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        cur.execute(
            """SELECT id, route_id, seq FROM mo_execution_yx
               WHERE id=%s AND mo_code=%s AND sort_seq=%s AND status='done'
               FOR UPDATE""",
            (exec_id, mo_code, sort_seq)
        )
        exec_rec = cur.fetchone()
        if not exec_rec:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "执行记录不存在或状态不正确"})

        cur.execute("""
            SELECT id, qty_out, qty_out_a, qty_out_a1, qty_out_a2,
                   qty_in, qty_in_a, qty_in_a1, qty_in_a2
            FROM mo_handover_yx
            WHERE mo_code=%s AND sort_seq=%s AND route_id=%s AND to_seq=%s
            ORDER BY id DESC LIMIT 1
            FOR UPDATE
        """, (mo_code, sort_seq, exec_rec['route_id'], exec_rec['seq']))
        handover = cur.fetchone()
        if not handover:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "未找到上工序交接记录，不能接收"})

        plan_qty = float(handover['qty_out'] or 0)
        qty_before = float(handover['qty_in'] or 0)
        qty_after = qty_before + qty_add
        if _makeup_exceeds_plan(qty_before, qty_add, plan_qty) and not reason:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "累计接收数量超过上工序完工数量，请填写原因"})
        operator_name = _get_operator(cur, user_id)

        now = datetime.now()
        cur.close()
        cur = conn.cursor()

        cur.execute("""
            UPDATE mo_handover_yx
            SET qty_in=%s, status='confirmed', confirm_time=COALESCE(confirm_time,%s),
                operator_in=COALESCE(operator_in,%s), receipt_reason=COALESCE(receipt_reason,%s)
            WHERE id=%s
        """, (qty_after, now, operator_name, reason, handover['id']))

        cur.execute("""
            INSERT INTO mo_makeup_record_yx
              (execution_id,mo_code,sort_seq,seq,qty_before,qty_add,qty_after,
               plan_qty,reason,operator_id,operator_name)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (exec_id, mo_code, sort_seq, exec_rec['seq'], qty_before, qty_add,
              qty_after, plan_qty, reason, user_id or None, operator_name or None))

        conn.commit()
        cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "接收成功"})
    except Exception as e:
        if conn:
            try:
                conn.rollback()
                conn.close()
            except Exception:
                pass
        return jsonify({"code": 1, "msg": str(e)})


# ----------------------------------------------------------------
# 接收
# ----------------------------------------------------------------
@mo_bp.post("/receive")
def receive_handover():
    body           = request.get_json() or {}
    mo_code        = body.get("mo_code", "").strip()
    sort_seq       = body.get("sort_seq")
    handover_id    = body.get("handover_id")
    receipt_reason = (body.get("receipt_reason") or "").strip() or None
    photo_url      = (body.get("photo_url") or "").strip() or None
    user_id        = body.get("user_id", "").strip()
    if not mo_code or sort_seq is None or not handover_id:
        return jsonify({"code": 1, "msg": "参数不完整"})
    if not photo_url:
        return jsonify({"code": 1, "msg": "接收请先上传领用照片"})
    try:
        if body.get("qty_in") not in (None, "") and body.get("qty_a") in (None, ""):
            body["qty_a"] = body.get("qty_in")
        qty_a, qty_a1, qty_a2, qty_in = _receive_qty_from_body(body, "qty")
    except (ValueError, TypeError):
        return jsonify({"code": 1, "msg": "数量格式错误"})
    conn = None
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        operator_name = _get_operator(cur, user_id)
        now = datetime.now()

        cur.execute("""
            SELECT id,qty_out,qty_out_a,qty_out_a1,qty_out_a2,qty_in,status
            FROM mo_handover_yx
            WHERE id=%s AND mo_code=%s AND sort_seq=%s FOR UPDATE
        """, (handover_id, mo_code, sort_seq))
        handover = cur.fetchone()
        if not handover or handover['status'] != 'pending':
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "交接单不存在或已接收完成"})
        qty_out = float(handover['qty_out'] or 0)
        out_a = float(handover.get('qty_out_a') or 0)
        out_a1 = float(handover.get('qty_out_a1') or 0)
        out_a2 = float(handover.get('qty_out_a2') or 0)
        if out_a + out_a1 + out_a2 <= 0:
            out_a, out_a1, out_a2 = qty_out, 0, 0
        if qty_a > out_a:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": f"A最多可接收{out_a:g}件"})
        if qty_a1 > out_a1:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": f"A1最多可接收{out_a1:g}件"})
        if qty_a2 > out_a2:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": f"A2最多可接收{out_a2:g}件"})
        if qty_in != qty_out and not receipt_reason:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "接收数量与交接数量不一致，请填写说明"})

        cur.close()
        cur = conn.cursor()
        cur.execute("""
            UPDATE mo_handover_yx
            SET qty_in=%s, qty_in_a=%s, qty_in_a1=%s, qty_in_a2=%s,
                receipt_reason=%s, operator_in=%s, receive_photo_url=%s,
                status='confirmed', confirm_time=%s
            WHERE id=%s AND mo_code=%s AND sort_seq=%s AND status='pending'
        """, (qty_in, qty_a, qty_a1, qty_a2, receipt_reason, operator_name, photo_url, now,
              handover_id, mo_code, sort_seq))

        if cur.rowcount == 0:
            conn.rollback()
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "交接单不存在或已接收完成"})

        conn.commit()
        cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "接收成功"})
    except Exception as e:
        if conn:
            try:
                conn.rollback(); conn.close()
            except Exception:
                pass
        return jsonify({"code": 1, "msg": str(e)})


# ----------------------------------------------------------------
# 批量查询工单执行状态（列表页用）
# ----------------------------------------------------------------
@mo_bp.post("/wo-status-batch")
def wo_status_batch():
    body  = request.get_json() or {}
    items = body.get("items", [])
    if not items:
        return jsonify({"code": 0, "data": []})
    try:
        conn = get_db2()
        results = []
        for item in items[:50]:
            mo_code   = str(item.get("mo_code", "")).strip()
            sort_seq  = item.get("sort_seq")
            category_name = str(item.get("category_name", "")).strip()
            if not mo_code or sort_seq is None:
                continue
            try:
                # buffered=True：execute 后立即把所有行缓冲到内存，
                # 避免 fetchone() 提前 return 后 cursor 还有未读结果
                # 导致下一次 execute 抛 InternalError: Unread result found
                cur = conn.cursor(dictionary=True, buffered=True)
                route_id = _find_route(cur, mo_code, sort_seq, category_name)
                if not route_id:
                    results.append({"mo_code": mo_code, "sort_seq": sort_seq, "status": "no_route", "process_name": ""})
                    cur.close()
                    continue

                cur.execute("""
                    SELECT ws.status, p.process_name
                    FROM mo_wo_state_yx ws
                    LEFT JOIN mo_route_step_yx rs ON rs.route_id=ws.route_id AND rs.seq=ws.current_seq
                    LEFT JOIN mo_process_yx p ON p.id=rs.process_id
                    WHERE ws.mo_code=%s AND ws.sort_seq=%s
                """, (mo_code, sort_seq))
                state = cur.fetchone()

                if state:
                    exec_status  = state['status']
                    process_name = state['process_name'] or ''
                    if exec_status == 'pending':
                        cur.execute("""
                            SELECT COUNT(*) AS cnt FROM mo_handover_yx
                            WHERE mo_code=%s AND sort_seq=%s AND status='pending'
                        """, (mo_code, sort_seq))
                        h = cur.fetchone()
                        if h and h['cnt'] > 0:
                            exec_status = 'needs_receipt'
                else:
                    cur.execute("""
                        SELECT p.process_name
                        FROM mo_route_step_yx rs
                        JOIN mo_process_yx p ON p.id=rs.process_id
                        WHERE rs.route_id=%s ORDER BY rs.seq ASC LIMIT 1
                    """, (route_id,))
                    first = cur.fetchone()
                    exec_status  = 'pending'
                    process_name = first['process_name'] if first else ''

                cur.close()
                results.append({
                    "mo_code":      mo_code,
                    "sort_seq":     sort_seq,
                    "status":       exec_status,
                    "process_name": process_name
                })
            except Exception as item_err:
                results.append({
                    "mo_code":      mo_code,
                    "sort_seq":     sort_seq,
                    "status":       "pending",
                    "process_name": "",
                    "_err":         str(item_err)
                })

        conn.close()
        return jsonify({"code": 0, "data": results})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


# ----------------------------------------------------------------
# 路线部门映射（工单列表用）
# ----------------------------------------------------------------
@mo_bp.get("/my-records")
def my_records():
    user_id = request.args.get("user_id", "").strip()
    if not user_id:
        return jsonify({"code": 1, "msg": "user_id不能为空", "data": []})
    today = datetime.now().strftime('%Y-%m-%d')
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True, buffered=True)
        cur.execute("""
            SELECT id, mo_code, sort_seq, process_name,
                   start_time, end_time, qty_done, status
            FROM mo_execution_yx
            WHERE operator_id = %s AND DATE(create_time) = %s
            ORDER BY create_time DESC
        """, (user_id, today))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": [_ser(r) for r in rows]})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@mo_bp.get("/execution/detail")
def execution_detail():
    exec_id = request.args.get("id", "").strip()
    if not exec_id:
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT id,mo_code,sort_seq,route_id,seq,process_name,station_name,
                   operator_name,complete_operator_name,start_time,end_time,status,
                   start_photo_url,complete_photo_url,qty_done,qty_a,qty_a1,qty_a2,qty_c,complete_reason,
                   (SELECT COUNT(*) FROM mo_execution_print_log_yx pl
                    WHERE pl.execution_id=mo_execution_yx.id) AS print_count
            FROM mo_execution_yx WHERE id=%s
        """, (exec_id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "执行记录不存在"})
        cur.execute("""
            SELECT ding_user_id AS user_id,user_name_snapshot AS user_name,
                   dept_path_snapshot AS dept_path
            FROM mo_execution_worker_yx
            WHERE execution_id=%s ORDER BY id
        """, (exec_id,))
        workers = cur.fetchall()
        cur.execute("""
            SELECT current_seq,status FROM mo_wo_state_yx
            WHERE mo_code=%s AND sort_seq=%s
        """, (row['mo_code'], row['sort_seq']))
        state = cur.fetchone()
        cur.execute("""
            SELECT id,seq,status,process_name FROM mo_execution_yx
            WHERE mo_code=%s AND sort_seq=%s AND seq>%s
            ORDER BY seq,id LIMIT 1
        """, (row['mo_code'], row['sort_seq'], row['seq']))
        next_exec = cur.fetchone()
        cur.execute("""
            SELECT h.id,h.from_seq AS seq,h.qty_out,h.qty_out_a,h.qty_out_a1,h.qty_out_a2,
                   h.qty_in,h.qty_in_a,h.qty_in_a1,h.qty_in_a2,p.process_name
            FROM mo_handover_yx h
            LEFT JOIN mo_route_step_yx rs ON rs.route_id=h.route_id AND rs.seq=h.from_seq
            LEFT JOIN mo_process_yx p ON p.id=rs.process_id
            WHERE h.mo_code=%s AND h.sort_seq=%s AND h.route_id=%s AND h.to_seq=%s
            ORDER BY h.id DESC LIMIT 1
        """, (row['mo_code'], row['sort_seq'], row['route_id'], row['seq']))
        previous_exec = cur.fetchone()
        if not previous_exec:
            cur.execute("""
                SELECT id,seq,process_name,qty_done
                FROM mo_execution_yx
                WHERE mo_code=%s AND sort_seq=%s AND status='done' AND seq<%s
                ORDER BY seq DESC,id DESC LIMIT 1
            """, (row['mo_code'], row['sort_seq'], row['seq']))
            previous_exec = cur.fetchone()
        cur.execute("""
            SELECT id,qty_before,qty_add,qty_after,plan_qty,reason,
                   operator_name,create_time
            FROM mo_makeup_record_yx
            WHERE execution_id=%s ORDER BY id DESC
        """, (exec_id,))
        makeup_records = cur.fetchall()
        cur.execute("""
            SELECT id,qty_input,qty_input_a,qty_input_a1,qty_input_a2,
                   qty_a,qty_a1,qty_a2,qty_c,qty_before,qty_ref,reason,
                   photo_url,complete_photo_url,status,start_time,end_time
            FROM mo_receive_work_yx
            WHERE execution_id=%s
            ORDER BY id DESC
        """, (exec_id,))
        receive_work_records = cur.fetchall()
        receive_worker_map = {}
        if receive_work_records:
            receive_ids = [row['id'] for row in receive_work_records]
            marks = ",".join(["%s"] * len(receive_ids))
            cur.execute(f"""
                SELECT receive_id,ding_user_id AS user_id,user_name_snapshot AS user_name
                FROM mo_receive_worker_yx
                WHERE receive_id IN ({marks}) ORDER BY id
            """, receive_ids)
            for worker in cur.fetchall():
                receive_worker_map.setdefault(worker['receive_id'], []).append(worker)
        receive_work = next(
            (row for row in receive_work_records if row['status'] == 'processing'),
            receive_work_records[0] if receive_work_records else None
        )
        cur.execute("""
            SELECT id,qty_input,qty_a,qty_a1,qty_a2,qty_c,reason,complete_remark,status,
                   photo_url,complete_photo_url,start_time,end_time
            FROM mo_rework_yx
            WHERE source_execution_id=%s
            ORDER BY id DESC
        """, (exec_id,))
        rework_records = cur.fetchall()
        rework_worker_map = {}
        if rework_records:
            rework_ids = [row['id'] for row in rework_records]
            marks = ",".join(["%s"] * len(rework_ids))
            cur.execute(f"""
                SELECT rework_id,ding_user_id AS user_id,user_name_snapshot AS user_name
                FROM mo_rework_worker_yx
                WHERE rework_id IN ({marks}) ORDER BY id
            """, rework_ids)
            for worker in cur.fetchall():
                rework_worker_map.setdefault(worker['rework_id'], []).append(worker)
        cur.close(); conn.close()
        duration_text = _format_duration(row['start_time'], row['end_time'])
        has_next = bool(next_exec or (state and int(state['current_seq']) > int(row['seq'])))
        data = _ser(row)
        data["qty_done"] = float(data["qty_done"] or 0)
        data["qty_a"] = float(data["qty_a"] or 0)
        data["qty_a1"] = float(data["qty_a1"] or 0)
        data["qty_a2"] = float(data["qty_a2"] or 0)
        data["qty_c"] = float(data["qty_c"] or 0)
        data["workers"] = workers
        data["duration_text"] = duration_text
        data["has_next"] = has_next
        data["next_status"] = (
            next_exec['status'] if next_exec else (state['status'] if has_next else None)
        )
        data["next_seq"] = (
            next_exec['seq'] if next_exec else (state['current_seq'] if has_next else None)
        )
        data["next_exec_id"] = (
            next_exec['id'] if next_exec and next_exec['status'] == 'done' else None
        )
        data["next_process_name"] = next_exec['process_name'] if next_exec else None
        data["previous_exec"] = _ser(previous_exec)
        if data["previous_exec"]:
            data["previous_exec"]["qty_out"] = float(data["previous_exec"].get("qty_out") or 0)
            data["previous_exec"]["qty_in"] = float(data["previous_exec"].get("qty_in") or 0)
            for field in ("qty_out_a", "qty_out_a1", "qty_out_a2", "qty_in_a", "qty_in_a1", "qty_in_a2"):
                if field in data["previous_exec"]:
                    data["previous_exec"][field] = float(data["previous_exec"].get(field) or 0)
            if "qty_done" in data["previous_exec"]:
                data["previous_exec"]["qty_done"] = float(data["previous_exec"]["qty_done"] or 0)
        data["receive_ref_process_name"] = (
            previous_exec["process_name"] if previous_exec else "上一步工序"
        )
        if previous_exec and "qty_out" in previous_exec:
            data["receive_ref_qty"] = float(previous_exec["qty_out"] or 0)
            data["receive_current_qty"] = float(previous_exec["qty_in"] or 0)
            data["receive_ref_a"] = float(previous_exec.get("qty_out_a") or 0)
            data["receive_ref_a1"] = float(previous_exec.get("qty_out_a1") or 0)
            data["receive_ref_a2"] = float(previous_exec.get("qty_out_a2") or 0)
            data["receive_current_a"] = float(previous_exec.get("qty_in_a") or 0)
            data["receive_current_a1"] = float(previous_exec.get("qty_in_a1") or 0)
            data["receive_current_a2"] = float(previous_exec.get("qty_in_a2") or 0)
        elif previous_exec:
            data["receive_ref_qty"] = float(previous_exec["qty_done"] or 0)
            data["receive_current_qty"] = 0
            data["receive_ref_a"] = data["receive_ref_qty"]
            data["receive_ref_a1"] = 0
            data["receive_ref_a2"] = 0
            data["receive_current_a"] = data["receive_current_a1"] = data["receive_current_a2"] = 0
        else:
            data["receive_ref_qty"] = 0
            data["receive_current_qty"] = 0
            data["receive_ref_a"] = data["receive_ref_a1"] = data["receive_ref_a2"] = 0
            data["receive_current_a"] = data["receive_current_a1"] = data["receive_current_a2"] = 0
        data["receive_available_qty"] = max(0, data["receive_ref_qty"] - data["receive_current_qty"])
        data["makeup_records"] = [_ser(record) for record in makeup_records]
        for record in data["makeup_records"]:
            for field in ("qty_before", "qty_add", "qty_after", "plan_qty"):
                record[field] = float(record[field]) if record[field] is not None else None
        data["receive_work_records"] = []
        for record in receive_work_records:
            item = _ser(record)
            for field in ("qty_input", "qty_input_a", "qty_input_a1", "qty_input_a2",
                          "qty_a", "qty_a1", "qty_a2", "qty_c", "qty_before", "qty_ref"):
                item[field] = float(item[field] or 0)
            item["workers"] = receive_worker_map.get(record['id'], [])
            item["duration_text"] = _format_duration(record['start_time'], record['end_time'])
            data["receive_work_records"].append(item)
        data["receive_work"] = next(
            (item for item in data["receive_work_records"] if item["status"] == "processing"),
            data["receive_work_records"][0] if data["receive_work_records"] else None
        )
        data["rework_records"] = []
        for record in rework_records:
            item = _ser(record)
            for field in ("qty_input", "qty_a", "qty_a1", "qty_a2", "qty_c"):
                item[field] = float(item[field] or 0)
            item["workers"] = rework_worker_map.get(record['id'], [])
            item["duration_text"] = _format_duration(record['start_time'], record['end_time'])
            data["rework_records"].append(item)
        data["rework"] = next(
            (item for item in data["rework_records"] if item["status"] == "processing"),
            data["rework_records"][0] if data["rework_records"] else None
        )
        return jsonify({"code": 0, "data": data})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.get("/execution/label")
def execution_label():
    exec_id = request.args.get("id", "").strip()
    if not exec_id:
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT e.id,e.mo_code,e.sort_seq,e.route_id,e.seq,e.process_name,e.station_name,
                   e.end_time,e.status,e.qty_done,e.qty_a,e.qty_a1,e.qty_a2,e.qty_c,
                   r.route_name,
                   (SELECT COUNT(*) FROM mo_execution_print_log_yx pl
                    WHERE pl.execution_id=e.id) AS print_count
            FROM mo_execution_yx e
            LEFT JOIN mo_route_yx r ON r.id=e.route_id
            WHERE e.id=%s
        """, (exec_id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "执行记录不存在"})
        if row['status'] != 'done':
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "工序尚未完工，不能打印标签"})

        cur.execute("""
            SELECT rs.seq,p.process_name
            FROM mo_route_step_yx rs
            JOIN mo_process_yx p ON p.id=rs.process_id
            WHERE rs.route_id=%s
            ORDER BY rs.seq
        """, (row['route_id'],))
        steps = cur.fetchall()
        cur.close(); conn.close()

        current_index = next(
            (index for index, step in enumerate(steps) if int(step['seq']) == int(row['seq'])),
            -1
        )
        next_process_name = (
            steps[current_index + 1]['process_name']
            if current_index >= 0 and current_index + 1 < len(steps) else ''
        )
        data = _ser(row)
        for field in ("qty_done", "qty_a", "qty_a1", "qty_a2", "qty_c"):
            data[field] = float(data[field] or 0)
        data["print_count"] = int(data["print_count"] or 0)
        data["steps"] = [_ser(step) for step in steps]
        data["step_index"] = current_index + 1 if current_index >= 0 else int(row['seq'])
        data["step_total"] = len(steps)
        data["next_process_name"] = next_process_name
        data["qr_content"] = json.dumps({
            "mocode": row['mo_code'],
            "sortseq": row['sort_seq'],
            "execid": row['id']
        }, ensure_ascii=False, separators=(",", ":"))
        return jsonify({"code": 0, "data": data})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/execution/print-log")
def execution_print_log():
    body = request.get_json() or {}
    exec_id = body.get("execution_id")
    client_job_id = (body.get("client_job_id") or "").strip()
    printer_device_id = (body.get("printer_device_id") or "").strip() or None
    printer_name = (body.get("printer_name") or "").strip() or None
    user_id = (body.get("user_id") or "").strip()
    if not exec_id or not client_job_id:
        return jsonify({"code": 1, "msg": "打印记录参数不完整"})
    conn = None
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT id,status FROM mo_execution_yx WHERE id=%s", (exec_id,))
        execution = cur.fetchone()
        if not execution:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "执行记录不存在"})
        if execution['status'] != 'done':
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "工序尚未完工，不能记录打印"})
        operator_name = _get_operator(cur, user_id)
        cur.execute("""
            INSERT IGNORE INTO mo_execution_print_log_yx
              (execution_id,client_job_id,printer_device_id,printer_name,operator_id,operator_name)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (exec_id, client_job_id, printer_device_id, printer_name,
              user_id or None, operator_name or None))
        conn.commit()
        cur.execute("""
            SELECT COUNT(*) AS print_count
            FROM mo_execution_print_log_yx WHERE execution_id=%s
        """, (exec_id,))
        count_row = cur.fetchone()
        cur.close(); conn.close()
        return jsonify({
            "code": 0,
            "msg": "打印记录成功",
            "data": {"print_count": int(count_row['print_count'] or 0)}
        })
    except Exception as e:
        if conn:
            try:
                conn.rollback()
                conn.close()
            except Exception:
                pass
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/receive-work/start")
def start_receive_work():
    body = request.get_json() or {}
    exec_id = body.get("exec_id")
    worker_ids = body.get("worker_ids") or []
    reason = (body.get("reason") or "").strip() or None
    photo_url = (body.get("photo_url") or "").strip() or None
    user_id = (body.get("user_id") or "").strip()
    try:
        temp_worker_count = _temp_worker_count(body)
    except (ValueError, TypeError):
        return jsonify({"code": 1, "msg": "临时工人数必须是0到50之间的整数"})
    if not exec_id:
        return jsonify({"code": 1, "msg": "exec_id不能为空"})
    if not photo_url:
        return jsonify({"code": 1, "msg": "领用接收请先拍照留底"})
    if not isinstance(worker_ids, list):
        return jsonify({"code": 1, "msg": "接收人员格式错误"})
    worker_ids = list(dict.fromkeys(
        str(value).strip() for value in worker_ids if str(value).strip()
    ))
    if not worker_ids:
        return jsonify({"code": 1, "msg": "请至少选择一名正式员工，不能只选择临时工"})
    if len(worker_ids) + temp_worker_count > 50:
        return jsonify({"code": 1, "msg": "单次接收人员不能超过50人"})
    try:
        qty_input_a, qty_input_a1, qty_input_a2, qty_input = _receive_qty_from_body(body, "qty_input")
    except (ValueError, TypeError):
        return jsonify({"code": 1, "msg": "接收数量格式错误"})

    conn = None
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT id,mo_code,sort_seq,route_id,seq,process_name,status
            FROM mo_execution_yx WHERE id=%s FOR UPDATE
        """, (exec_id,))
        source = cur.fetchone()
        if not source or source['status'] != 'done':
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "只能对已完工记录发起接收"})
        cur.execute("""
            SELECT id FROM mo_receive_work_yx
            WHERE execution_id=%s AND status='processing'
            LIMIT 1
        """, (exec_id,))
        if cur.fetchone():
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "该记录已有进行中的接收"})
        cur.execute("""
            SELECT id, qty_out, qty_in
            FROM mo_handover_yx
            WHERE mo_code=%s AND sort_seq=%s AND route_id=%s AND to_seq=%s
            ORDER BY id DESC LIMIT 1
            FOR UPDATE
        """, (source['mo_code'], source['sort_seq'], source['route_id'], source['seq']))
        handover = cur.fetchone()
        if not handover:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "未找到上工序交接记录，不能接收"})
        qty_ref = float(handover['qty_out'] or 0)
        qty_before = float(handover['qty_in'] or 0)
        out_a = float(handover.get('qty_out_a') or 0)
        out_a1 = float(handover.get('qty_out_a1') or 0)
        out_a2 = float(handover.get('qty_out_a2') or 0)
        in_a = float(handover.get('qty_in_a') or 0)
        in_a1 = float(handover.get('qty_in_a1') or 0)
        in_a2 = float(handover.get('qty_in_a2') or 0)
        if out_a + out_a1 + out_a2 <= 0:
            out_a, out_a1, out_a2 = qty_ref, 0, 0
        avail_a = max(0, out_a - in_a)
        avail_a1 = max(0, out_a1 - in_a1)
        avail_a2 = max(0, out_a2 - in_a2)
        if qty_input_a > avail_a:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": f"A最多可接收{avail_a:g}件"})
        if qty_input_a1 > avail_a1:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": f"A1最多可接收{avail_a1:g}件"})
        if qty_input_a2 > avail_a2:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": f"A2最多可接收{avail_a2:g}件"})
        if _makeup_exceeds_plan(qty_before, qty_input, qty_ref) and not reason:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "累计接收数量超过上工序完工数量，请填写原因"})
        worker_map = _get_worker_map(cur, worker_ids) if worker_ids else {}
        if any(worker_id not in worker_map for worker_id in worker_ids):
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "所选接收人员已离职或不存在"})
        operator_name = _get_operator(cur, user_id)
        now = datetime.now()
        cur.close()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO mo_receive_work_yx
              (execution_id,handover_id,mo_code,sort_seq,route_id,seq,process_name,
               qty_input,qty_input_a,qty_input_a1,qty_input_a2,
               qty_before,qty_ref,reason,photo_url,operator_id,operator_name,status,start_time)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'processing',%s)
        """, (source['id'], handover['id'], source['mo_code'], source['sort_seq'],
              source['route_id'], source['seq'], source['process_name'],
              qty_input, qty_input_a, qty_input_a1, qty_input_a2,
              qty_before, qty_ref, reason, photo_url, user_id or None, operator_name or None, now))
        receive_id = cur.lastrowid
        worker_rows = [(
            receive_id, worker_id, worker_map[worker_id]['user_name'],
            worker_map[worker_id]['mobile'], worker_map[worker_id]['main_dept_id'],
            worker_map[worker_id]['dept_path']
        ) for worker_id in worker_ids]
        worker_rows.extend([
            (receive_id, f"TEMP:RE{receive_id}:{index}", f"临时工{index}",
             None, None, "临时工")
            for index in range(1, temp_worker_count + 1)
        ])
        cur.executemany("""
            INSERT INTO mo_receive_worker_yx
              (receive_id,ding_user_id,user_name_snapshot,mobile_snapshot,
               dept_id_snapshot,dept_path_snapshot)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, worker_rows)
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "接收已开始", "data": {"id": receive_id}})
    except Exception as e:
        if conn:
            try:
                conn.rollback(); conn.close()
            except Exception:
                pass
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/receive-work/complete")
def complete_receive_work():
    body = request.get_json() or {}
    receive_id = body.get("receive_id")
    complete_photo_url = (body.get("complete_photo_url") or "").strip() or None
    if not receive_id:
        return jsonify({"code": 1, "msg": "receive_id不能为空"})
    if not complete_photo_url:
        return jsonify({"code": 1, "msg": "接收完工请先上传照片"})
    try:
        qty_a, qty_a1, qty_a2, qty_c, qty_done, _good_total = _complete_qty_from_body(body)
    except (ValueError, TypeError):
        return jsonify({"code": 1, "msg": "接收完工数量格式错误"})
    conn = None
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM mo_receive_work_yx WHERE id=%s FOR UPDATE", (receive_id,))
        receive = cur.fetchone()
        if not receive or receive['status'] != 'processing':
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "接收记录不存在或已经完工"})
        cur.execute("""
            SELECT id, qty_out, qty_in
            FROM mo_handover_yx
            WHERE id=%s FOR UPDATE
        """, (receive['handover_id'],))
        handover = cur.fetchone()
        if not handover:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "交接记录不存在"})
        qty_before = float(handover['qty_in'] or 0)
        qty_add = float(receive['qty_input'] or 0)
        if abs(qty_done - qty_add) > 0.0001:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "A/A1/A2/C级合计必须等于接收数量"})
        qty_after = qty_before + qty_add
        qty_ref = float(handover['qty_out'] or 0)
        if _makeup_exceeds_plan(qty_before, qty_add, qty_ref) and not receive['reason']:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "累计接收数量超过上工序完工数量，请填写原因"})
        now = datetime.now()
        cur.close()
        cur = conn.cursor()
        cur.execute("""
            UPDATE mo_handover_yx
            SET qty_in=%s,
                qty_in_a=qty_in_a+%s, qty_in_a1=qty_in_a1+%s, qty_in_a2=qty_in_a2+%s,
                status='confirmed', confirm_time=COALESCE(confirm_time,%s),
                operator_in=COALESCE(operator_in,%s), receipt_reason=COALESCE(receipt_reason,%s)
            WHERE id=%s
        """, (qty_after,
              float(receive.get('qty_input_a') or 0),
              float(receive.get('qty_input_a1') or 0),
              float(receive.get('qty_input_a2') or 0),
              now, receive['operator_name'], receive['reason'], receive['handover_id']))
        cur.execute("""
            INSERT INTO mo_makeup_record_yx
              (execution_id,mo_code,sort_seq,seq,qty_before,qty_add,qty_after,
               plan_qty,reason,operator_id,operator_name)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (receive['execution_id'], receive['mo_code'], receive['sort_seq'],
              receive['seq'], qty_before, qty_add, qty_after, qty_ref,
              receive['reason'], receive['operator_id'], receive['operator_name']))
        cur.execute("""
            UPDATE mo_receive_work_yx
            SET qty_a=%s, qty_a1=%s, qty_a2=%s, qty_c=%s,
                complete_photo_url=%s, status='done', end_time=%s
            WHERE id=%s
        """, (qty_a, qty_a1, qty_a2, qty_c, complete_photo_url, now, receive_id))
        cur.execute("""
            UPDATE mo_execution_yx
            SET qty_done=qty_done+%s, qty_a=qty_a+%s, qty_a1=qty_a1+%s,
                qty_a2=qty_a2+%s, qty_c=qty_c+%s, end_time=%s
            WHERE id=%s
        """, (qty_done, qty_a, qty_a1, qty_a2, qty_c, now, receive['execution_id']))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "接收完工成功"})
    except Exception as e:
        if conn:
            try:
                conn.rollback(); conn.close()
            except Exception:
                pass
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/rework/start")
def start_rework():
    body = request.get_json() or {}
    exec_id = body.get("exec_id")
    reason = (body.get("reason") or "").strip()
    photo_url = (body.get("photo_url") or "").strip() or None
    worker_ids = body.get("worker_ids") or []
    try:
        temp_worker_count = _temp_worker_count(body)
    except (ValueError, TypeError):
        return jsonify({"code": 1, "msg": "临时工人数必须是0到50之间的整数"})
    user_id = (body.get("user_id") or "").strip()
    if not exec_id or not reason:
        return jsonify({"code": 1, "msg": "返工数量和返工说明不能为空"})
    if not photo_url:
        return jsonify({"code": 1, "msg": "返工开工请先上传照片"})
    if not isinstance(worker_ids, list):
        return jsonify({"code": 1, "msg": "返工人员格式错误"})
    worker_ids = list(dict.fromkeys(
        str(value).strip() for value in worker_ids if str(value).strip()
    ))
    if not worker_ids:
        return jsonify({"code": 1, "msg": "请至少选择一名正式员工，不能只选择临时工"})
    if len(worker_ids) + temp_worker_count > 50:
        return jsonify({"code": 1, "msg": "单次返工人员不能超过50人"})
    try:
        qty_input = float(body.get("qty_input"))
        if qty_input <= 0 or qty_input > 99999:
            return jsonify({"code": 1, "msg": "返工数量必须大于0且不能超过99999"})
    except (ValueError, TypeError):
        return jsonify({"code": 1, "msg": "返工数量格式错误"})

    conn = None
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT id,mo_code,sort_seq,route_id,seq,process_name,qty_c,status
            FROM mo_execution_yx WHERE id=%s FOR UPDATE
        """, (exec_id,))
        source = cur.fetchone()
        if not source or source['status'] != 'done':
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "只能对已完工记录发起返工"})
        cur.execute("""
            SELECT COALESCE(SUM(qty_input),0) AS reserved
            FROM mo_rework_yx
            WHERE source_execution_id=%s AND status='processing'
        """, (exec_id,))
        reserved = float(cur.fetchone()['reserved'] or 0)
        if reserved > 0:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "该完工记录已有进行中的返工"})
        if qty_input > float(source['qty_c'] or 0) - reserved:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "返工数量不能超过当前可返工C级数量"})
        worker_map = _get_worker_map(cur, worker_ids) if worker_ids else {}
        if any(worker_id not in worker_map for worker_id in worker_ids):
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "所选返工人员已离职或不存在"})
        operator_name = _get_operator(cur, user_id)
        now = datetime.now()
        cur.close()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO mo_rework_yx
              (source_execution_id,mo_code,sort_seq,route_id,seq,process_name,
               qty_input,reason,photo_url,operator_id,operator_name,status,start_time)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'processing',%s)
        """, (exec_id, source['mo_code'], source['sort_seq'], source['route_id'],
              source['seq'], source['process_name'], qty_input, reason,
              photo_url, user_id or None, operator_name or None, now))
        rework_id = cur.lastrowid
        worker_rows = [(
            rework_id, worker_id, worker_map[worker_id]['user_name'],
            worker_map[worker_id]['mobile'], worker_map[worker_id]['main_dept_id'],
            worker_map[worker_id]['dept_path']
        ) for worker_id in worker_ids]
        worker_rows.extend([
            (rework_id, f"TEMP:R{rework_id}:{index}", f"临时工{index}",
             None, None, "临时工")
            for index in range(1, temp_worker_count + 1)
        ])
        cur.executemany("""
            INSERT INTO mo_rework_worker_yx
              (rework_id,ding_user_id,user_name_snapshot,mobile_snapshot,
               dept_id_snapshot,dept_path_snapshot)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, worker_rows)
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "返工已开始", "data": {"id": rework_id}})
    except Exception as e:
        if conn:
            try:
                conn.rollback(); conn.close()
            except Exception:
                pass
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/rework/complete")
def complete_rework():
    body = request.get_json() or {}
    rework_id = body.get("rework_id")
    remark = (body.get("remark") or "").strip() or None
    complete_photo_url = (body.get("complete_photo_url") or "").strip() or None
    if not complete_photo_url:
        return jsonify({"code": 1, "msg": "返工完工请先上传照片"})
    try:
        qty_a, qty_a1, qty_a2, qty_c, qty_done, good_total = _complete_qty_from_body(body)
    except (ValueError, TypeError):
        return jsonify({"code": 1, "msg": "返工完工数量格式错误"})
    conn = None
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT * FROM mo_rework_yx WHERE id=%s FOR UPDATE
        """, (rework_id,))
        rework = cur.fetchone()
        if not rework or rework['status'] != 'processing':
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "返工记录不存在或已经完工"})
        if abs(qty_done - float(rework['qty_input'])) > 0.0001:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "A/A1/A2/C级合计必须等于返工投入数量"})
        now = datetime.now()
        cur.close()
        cur = conn.cursor()
        cur.execute("""
            UPDATE mo_rework_yx
            SET qty_a=%s,qty_a1=%s,qty_a2=%s,qty_c=%s,
                complete_remark=%s,complete_photo_url=%s,status='done',end_time=%s
            WHERE id=%s
        """, (qty_a, qty_a1, qty_a2, qty_c, remark, complete_photo_url, now, rework_id))
        cur.execute("""
            UPDATE mo_execution_yx
            SET qty_a=qty_a+%s,qty_a1=qty_a1+%s,qty_a2=qty_a2+%s,
                qty_c=qty_c-%s,end_time=%s
            WHERE id=%s AND qty_c>=%s
        """, (qty_a, qty_a1, qty_a2, good_total, now, rework['source_execution_id'], good_total))
        if cur.rowcount == 0:
            conn.rollback(); cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "原记录C级数量不足，返工完工失败"})
        if good_total > 0:
            cur.execute("""
                UPDATE mo_handover_yx
                SET qty_out=qty_out+%s, qty_out_a=qty_out_a+%s,
                    qty_out_a1=qty_out_a1+%s, qty_out_a2=qty_out_a2+%s
                WHERE mo_code=%s AND sort_seq=%s AND from_seq=%s
                ORDER BY id DESC LIMIT 1
            """, (good_total, qty_a, qty_a1, qty_a2,
                  rework['mo_code'], rework['sort_seq'], rework['seq']))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "返工完工成功"})
    except Exception as e:
        if conn:
            try:
                conn.rollback(); conn.close()
            except Exception:
                pass
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.get("/route/dept-map")
def route_dept_map():
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT dept_code, route_name FROM mo_route_yx
            WHERE is_default = 1 AND is_active = 1 AND dept_code IS NOT NULL
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": {r['dept_code']: r['route_name'] for r in rows}})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": {}})


# ----------------------------------------------------------------
# 工站管理
# ----------------------------------------------------------------
@mo_bp.get("/workstation/list")
def workstation_list():
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM mo_workstation_yx ORDER BY id ASC")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": [_ser(r) for r in rows]})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@mo_bp.post("/workstation/add")
@_admin_api_required
def workstation_add():
    d = request.json or {}
    code = (d.get("station_code") or "").strip()
    name = (d.get("station_name") or "").strip()
    if not code or not name:
        return jsonify({"code": 1, "msg": "编码和名称不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO mo_workstation_yx (station_code,station_name,description,is_active,create_time,update_time) VALUES (%s,%s,%s,1,NOW(),NOW())",
            (code, name, d.get("description", ""))
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "添加成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/workstation/update")
@_admin_api_required
def workstation_update():
    d = request.json or {}
    if not d.get("id"):
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        cur.execute(
            "UPDATE mo_workstation_yx SET station_name=%s,description=%s,update_time=NOW() WHERE id=%s",
            (d.get("station_name",""), d.get("description",""), d["id"])
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "更新成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/workstation/toggle")
@_admin_api_required
def workstation_toggle():
    d = request.json or {}
    if not d.get("id"):
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        cur.execute("UPDATE mo_workstation_yx SET is_active=%s,update_time=NOW() WHERE id=%s",
                    (d.get("is_active", 0), d["id"]))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "操作成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


# ----------------------------------------------------------------
# 工艺路线 CRUD（列表/详情/增改/切换）
# ----------------------------------------------------------------
@mo_bp.get("/product-category/list")
def product_category_list():
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT code, name
            FROM bj_product_cost_yx
            WHERE is_enabled=1
            ORDER BY code
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": rows})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@mo_bp.get("/product-category/manage-list")
def product_category_manage_list():
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT code,name,is_enabled,created_at,updated_at
            FROM bj_product_cost_yx
            ORDER BY CAST(code AS UNSIGNED),code
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": [_ser(row) for row in rows]})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@mo_bp.post("/product-category/add")
@_admin_api_required
def product_category_add():
    name = str((request.get_json() or {}).get("name") or "").strip()
    if not name:
        return jsonify({"code": 1, "msg": "产品类别名称不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        cur.execute("SELECT code FROM bj_product_cost_yx WHERE name=%s LIMIT 1", (name,))
        if cur.fetchone():
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "产品类别名称已存在"})
        cur.execute("SELECT COALESCE(MAX(CAST(code AS UNSIGNED)),0)+1 FROM bj_product_cost_yx WHERE code REGEXP '^[0-9]+$'")
        next_code = str(int(cur.fetchone()[0])).zfill(2)
        cur.execute("""
            INSERT INTO bj_product_cost_yx
                (code,name,unit,mgmt_rate,mgmt_method,is_enabled,remark)
            VALUES (%s,%s,NULL,0,NULL,1,'报工产品类别')
        """, (next_code, name))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "新增成功", "data": {"code": next_code}})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/product-category/update")
@_admin_api_required
def product_category_update():
    body = request.get_json() or {}
    code = str(body.get("code") or "").strip()
    name = str(body.get("name") or "").strip()
    if not code or not name:
        return jsonify({"code": 1, "msg": "产品类别编码和名称不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        cur.execute("SELECT code FROM bj_product_cost_yx WHERE name=%s AND code<>%s LIMIT 1", (name, code))
        if cur.fetchone():
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "产品类别名称已存在"})
        cur.execute("UPDATE bj_product_cost_yx SET name=%s WHERE code=%s", (name, code))
        if cur.rowcount == 0:
            conn.rollback(); cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "产品类别不存在"})
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "更新成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/product-category/toggle")
@_admin_api_required
def product_category_toggle():
    code = str((request.get_json() or {}).get("code") or "").strip()
    if not code:
        return jsonify({"code": 1, "msg": "产品类别编码不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        cur.execute("UPDATE bj_product_cost_yx SET is_enabled=1-is_enabled WHERE code=%s", (code,))
        if cur.rowcount == 0:
            conn.rollback(); cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "产品类别不存在"})
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "操作成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


def _route_usage_count(cur, route_id):
    cur.execute("""
        SELECT COUNT(DISTINCT CONCAT(mo_code, '#', sort_seq)) AS cnt
        FROM (
            SELECT mo_code,sort_seq FROM mo_execution_yx WHERE route_id=%s
            UNION ALL SELECT mo_code,sort_seq FROM mo_wo_state_yx WHERE route_id=%s
            UNION ALL SELECT mo_code,sort_seq FROM mo_handover_yx WHERE route_id=%s
            UNION ALL SELECT mo_code,sort_seq FROM mo_wo_route_yx WHERE route_id=%s
        ) usage_rows
    """, (route_id, route_id, route_id, route_id))
    row = cur.fetchone()
    value = row["cnt"] if isinstance(row, dict) else row[0]
    return int(value or 0)


def _sync_route_categories(cur, route_id, version_group):
    cur.execute(
        "DELETE FROM mo_product_route_yx WHERE route_id IN "
        "(SELECT id FROM mo_route_yx WHERE version_group=%s)",
        (version_group,),
    )
    cur.execute("""
        INSERT INTO mo_product_route_yx (product_code,route_id)
        SELECT product_code,route_id FROM mo_route_version_category_yx WHERE route_id=%s
        ON DUPLICATE KEY UPDATE route_id=VALUES(route_id)
    """, (route_id,))


@mo_bp.post("/route/set-categories")
@_admin_api_required
def route_set_categories():
    d = request.json or {}
    route_id = d.get("route_id")
    product_codes = [str(v).strip() for v in d.get("product_codes", []) if str(v).strip()]
    if not route_id:
        return jsonify({"code": 1, "msg": "route_id不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        cur.execute("SELECT version_group,is_current FROM mo_route_yx WHERE id=%s", (route_id,))
        route = cur.fetchone()
        if not route or not route[1]:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "只能修改当前路线版本"})
        if _route_usage_count(cur, route_id) > 0:
            cur.close(); conn.close()
            return jsonify({"code": 2, "msg": "路线已使用，请创建新版本后修改", "require_new_version": True})
        cur.execute("DELETE FROM mo_route_version_category_yx WHERE route_id=%s", (route_id,))
        for product_code in product_codes:
            cur.execute("""
                INSERT INTO mo_route_version_category_yx (route_id,product_code)
                VALUES (%s,%s)
            """, (route_id, product_code))
        _sync_route_categories(cur, route_id, route[0])
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "产品类别已保存"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.get("/route/list")
def route_list():
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT r.*,
                   GROUP_CONCAT(vc.product_code ORDER BY vc.product_code) AS product_codes,
                   GROUP_CONCAT(pc.name ORDER BY vc.product_code SEPARATOR '、') AS product_names
            FROM mo_route_yx r
            LEFT JOIN mo_route_version_category_yx vc ON vc.route_id=r.id
            LEFT JOIN bj_product_cost_yx pc ON pc.code=vc.product_code
            WHERE r.is_current=1
            GROUP BY r.id
            ORDER BY r.dept_code,r.route_name
        """)
        rows = cur.fetchall()
        for row in rows:
            row['product_codes'] = row['product_codes'].split(',') if row['product_codes'] else []
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": [_ser(r) for r in rows]})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@mo_bp.get("/route/detail")
def route_detail():
    route_id = request.args.get("id", type=int)
    if not route_id:
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM mo_route_yx WHERE id=%s", (route_id,))
        route = cur.fetchone()
        if not route:
            return jsonify({"code": 1, "msg": "路线不存在"})
        cur.execute("""
            SELECT s.seq, s.process_id, p.process_name, ss.station_id,
                   COALESCE(w.station_name,'') AS station_name
            FROM mo_route_step_yx s
            LEFT JOIN mo_process_yx   p ON p.id = s.process_id
            LEFT JOIN mo_step_station_yx ss ON ss.step_id = s.id
            LEFT JOIN mo_workstation_yx w ON w.id = ss.station_id
            WHERE s.route_id=%s ORDER BY s.seq ASC
        """, (route_id,))
        steps = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": {**_ser(route), "steps": [_ser(s) for s in steps]}})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/route/add")
@_admin_api_required
def route_add():
    d = request.json or {}
    code = (d.get("route_code") or "").strip()
    name = (d.get("route_name") or "").strip()
    if not code or not name:
        return jsonify({"code": 1, "msg": "编码和名称不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        version_match = re.search(r"V(\d+)$", name, flags=re.IGNORECASE)
        version_no = int(version_match.group(1)) if version_match else 1
        cur.execute(
            """INSERT INTO mo_route_yx
               (route_code,version_group,version_no,route_name,dept_code,description,
                version_note,is_active,is_default,is_current,create_time,update_time)
               VALUES (%s,%s,%s,%s,%s,%s,%s,1,0,1,NOW(),NOW())""",
            (code, code, version_no, name, d.get("dept_code",""),
             d.get("description",""), d.get("version_note",""))
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "添加成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/route/update")
@_admin_api_required
def route_update():
    d = request.json or {}
    if not d.get("id"):
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT is_current FROM mo_route_yx WHERE id=%s", (d["id"],))
        route = cur.fetchone()
        if not route or not route["is_current"]:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "只能编辑当前路线版本"})
        if _route_usage_count(cur, d["id"]) > 0:
            cur.close(); conn.close()
            return jsonify({"code": 2, "msg": "路线已使用，请创建新版本后修改", "require_new_version": True})
        cur.close(); cur = conn.cursor()
        cur.execute(
            """UPDATE mo_route_yx SET route_name=%s,dept_code=%s,description=%s,
               version_note=%s,update_time=NOW() WHERE id=%s""",
            (d.get("route_name",""), d.get("dept_code",""), d.get("description",""),
             d.get("version_note",""), d["id"])
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "更新成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/route/toggle")
@_admin_api_required
def route_toggle():
    d = request.json or {}
    if not d.get("id"):
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        cur.execute("UPDATE mo_route_yx SET is_active=%s,update_time=NOW() WHERE id=%s",
                    (d.get("is_active", 0), d["id"]))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "操作成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/route/set-processes")
@_admin_api_required
def route_set_processes():
    d = request.json or {}
    route_id = d.get("route_id")
    steps = d.get("steps", [])
    if not route_id:
        return jsonify({"code": 1, "msg": "route_id不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT id,is_current FROM mo_route_yx WHERE id=%s", (route_id,))
        route = cur.fetchone()
        if not route:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "路线不存在"})
        if not route["is_current"]:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "只能修改当前路线版本"})
        if _route_usage_count(cur, route_id) > 0:
            cur.close(); conn.close()
            return jsonify({"code": 2, "msg": "路线已使用，不能调整工序；请创建新版本", "require_new_version": True})

        cur.execute("SELECT id FROM mo_route_step_yx WHERE route_id=%s", (route_id,))
        step_ids = [row["id"] for row in cur.fetchall()]
        cur.close()
        cur = conn.cursor()
        if step_ids:
            marks = ",".join(["%s"] * len(step_ids))
            cur.execute(f"DELETE FROM mo_step_station_yx WHERE step_id IN ({marks})", step_ids)
        cur.execute("DELETE FROM mo_route_step_yx WHERE route_id=%s", (route_id,))
        for s in steps:
            cur.execute(
                "INSERT INTO mo_route_step_yx (route_id,seq,process_id) VALUES (%s,%s,%s)",
                (route_id, s["seq"], s["process_id"])
            )
            step_id = cur.lastrowid
            if s.get("station_id"):
                cur.execute(
                    "INSERT INTO mo_step_station_yx (step_id,station_id) VALUES (%s,%s)",
                    (step_id, s["station_id"]),
                )
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "保存成功"})
    except Exception as e:
        if 'conn' in locals():
            try:
                conn.rollback(); conn.close()
            except Exception:
                pass
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/route/admin-authorize")
@_admin_api_required
def route_admin_authorize():
    expected = os.getenv("MO_ROUTE_ADMIN_PASSWORD", "")
    supplied = str((request.get_json() or {}).get("password") or "")
    if not expected or not hmac.compare_digest(expected, supplied):
        return jsonify({"code": 1, "msg": "管理员验证失败"}), 403
    session.permanent = True
    session["mo_route_admin"] = True
    return jsonify({"code": 0, "msg": "管理员验证成功"})


@mo_bp.post("/route/delete")
@_admin_api_required
def route_delete():
    if not _route_admin_authorized():
        return jsonify({"code": 1, "msg": "仅admin可以删除工艺路线"}), 403
    route_id = (request.get_json() or {}).get("id")
    if not route_id:
        return jsonify({"code": 1, "msg": "id不能为空"})
    conn = None
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT id,route_name,version_group,is_current,is_default FROM mo_route_yx WHERE id=%s FOR UPDATE", (route_id,))
        route = cur.fetchone()
        if not route:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "路线不存在"})

        checks = (
            ("mo_execution_yx", "执行记录"),
            ("mo_wo_state_yx", "工单状态"),
            ("mo_handover_yx", "交接记录"),
            ("mo_wo_route_yx", "工单指定"),
        )
        used_by = []
        for table, label in checks:
            cur.execute(f"SELECT COUNT(*) AS cnt FROM {table} WHERE route_id=%s", (route_id,))
            if int(cur.fetchone()["cnt"] or 0) > 0:
                used_by.append(label)
        if used_by:
            cur.close(); conn.close()
            return jsonify({
                "code": 1,
                "msg": f"路线已使用（{'、'.join(used_by)}），只能禁用，不能删除",
            })

        cur.execute("SELECT id FROM mo_route_step_yx WHERE route_id=%s", (route_id,))
        step_ids = [row["id"] for row in cur.fetchall()]
        cur.close()
        cur = conn.cursor()
        if step_ids:
            marks = ",".join(["%s"] * len(step_ids))
            cur.execute(f"DELETE FROM mo_step_station_yx WHERE step_id IN ({marks})", step_ids)
        cur.execute("DELETE FROM mo_route_step_yx WHERE route_id=%s", (route_id,))
        cur.execute("DELETE FROM mo_product_route_yx WHERE route_id=%s", (route_id,))
        cur.execute("DELETE FROM mo_route_version_category_yx WHERE route_id=%s", (route_id,))
        cur.execute("DELETE FROM mo_route_yx WHERE id=%s", (route_id,))
        if route["is_current"]:
            cur.execute(
                "SELECT id FROM mo_route_yx WHERE version_group=%s ORDER BY version_no DESC,id DESC LIMIT 1",
                (route["version_group"],),
            )
            previous = cur.fetchone()
            if previous:
                previous_id = previous[0]
                cur.execute(
                    "UPDATE mo_route_yx SET is_current=1,is_default=%s WHERE id=%s",
                    (route["is_default"], previous_id),
                )
                _sync_route_categories(cur, previous_id, route["version_group"])
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "删除成功"})
    except Exception as e:
        if conn:
            try:
                conn.rollback(); conn.close()
            except Exception:
                pass
        return jsonify({"code": 1, "msg": str(e)})


# ----------------------------------------------------------------
# 工单路线绑定
# ----------------------------------------------------------------
@mo_bp.get("/wo-route/list")
def wo_route_list():
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT b.mo_code, b.sort_seq, b.route_id, r.route_name
            FROM mo_wo_route_yx b
            LEFT JOIN mo_route_yx r ON r.id = b.route_id
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": [_ser(r) for r in rows]})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@mo_bp.post("/wo-route/set")
@_admin_api_required
def wo_route_set():
    d = request.json or {}
    mo_code  = (d.get("mo_code") or "").strip()
    sort_seq = d.get("sort_seq")
    route_id = d.get("route_id")
    if not mo_code or sort_seq is None or not route_id:
        return jsonify({"code": 1, "msg": "参数不完整"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO mo_wo_route_yx (mo_code, sort_seq, route_id)
            VALUES (%s,%s,%s)
            ON DUPLICATE KEY UPDATE route_id=%s
        """, (mo_code, sort_seq, route_id, route_id))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "指定成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/wo-route/set-batch")
@_admin_api_required
def wo_route_set_batch():
    d = request.json or {}
    route_id = d.get("route_id")
    items = d.get("items", [])
    if not route_id or not items:
        return jsonify({"code": 1, "msg": "参数不完整"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        for item in items:
            cur.execute("""
                INSERT INTO mo_wo_route_yx (mo_code, sort_seq, route_id)
                VALUES (%s,%s,%s)
                ON DUPLICATE KEY UPDATE route_id=%s
            """, (item["mo_code"], item["sort_seq"], route_id, route_id))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": f"已批量指定 {len(items)} 条"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})
