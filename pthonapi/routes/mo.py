from datetime import datetime, date, timedelta, timezone
from functools import wraps
import hmac
from io import BytesIO
import json
import logging
from math import isfinite
import os
import re

import requests
from flask import Blueprint, jsonify, request, send_file, session, g, has_request_context
from services.mo_station_access import business_db as get_db2
from services.mo_operation_log import worker_snapshots, write_operation_log
from services.mo_workorder_context import upsert_workorder_context
from services.mo_quantity_rules import (
    load_global_settings as load_quantity_rule_global_settings,
    load_settings as load_quantity_rule_settings,
    validate_complete as validate_quantity_rule_complete,
    validate_receive as validate_quantity_rule_receive,
)
from routes.mo_reporting import record_batch_print
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import createBarcodeDrawing
from reportlab.lib.colors import Color, black, white
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


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
logger = logging.getLogger(__name__)

MO_WORKORDER_DETAIL_URL = os.getenv(
    "MO_WORKORDER_DETAIL_URL",
    "https://api.jinmilong.cn/api/mo/workorder/detail"
)


def _fetch_workorder_detail(mo_code, sort_seq):
    try:
        response = requests.get(
            MO_WORKORDER_DETAIL_URL,
            params={"mo_code": mo_code, "sort_seq": sort_seq},
            timeout=8
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise RuntimeError("暂时无法读取ERP工单资料，请稍后重试") from exc
    if payload.get("code") != 0:
        raise RuntimeError(payload.get("msg") or "暂时无法读取ERP工单资料，请稍后重试")

    data = payload.get("data") or {}
    header = data.get("header") or {}
    if header and not (has_request_context() and getattr(g, 'mo_reporting_readonly', False)):
        try:
            upsert_workorder_context(header)
        except Exception:
            # Customer enrichment is report context and must not block shop-floor actions.
            logger.exception("work-order context sync failed for %s/%s", mo_code, sort_seq)
    return data

def _first_step_material_calculation(components, plan_qty=None):
    """汇总首工序领料，并保留比例折算的真实计算依据。"""
    all_lines = []
    for item in components or []:
        code = str(item.get("sub_code") or "").strip()
        try:
            planned = max(0, float(item.get("qty_plan") or 0))
            issued = max(0, float(item.get("qty_issued") or 0))
        except (TypeError, ValueError):
            planned = issued = 0
        all_lines.append({
            "sub_code": code,
            "sub_name": item.get("sub_name") or "",
            "qty_plan": planned,
            "qty_issued": issued
        })
    controlled = [
        line for line in all_lines
        if line["sub_code"].startswith(("1", "2", "31"))
    ]
    if controlled:
        return controlled, sum(line["qty_issued"] for line in controlled), None

    fallback = [line for line in all_lines if line["sub_code"] and line["qty_plan"] > 0]
    try:
        order_qty = max(0, float(plan_qty or 0))
    except (TypeError, ValueError):
        order_qty = 0
    if not fallback or order_qty <= 0:
        return fallback, 0, None
    bottleneck = min(
        fallback,
        key=lambda line: (
            min(1, line["qty_issued"] / line["qty_plan"]),
            line["sub_code"],
        ),
    )
    coverage = min(1, bottleneck["qty_issued"] / bottleneck["qty_plan"])
    issued = round(order_qty * coverage, 4)
    return fallback, issued, {
        "mode": "bom_ratio",
        "material_count": len(fallback),
        "bottleneck_inv_code": bottleneck["sub_code"],
        "bottleneck_required_qty": bottleneck["qty_plan"],
        "bottleneck_issued_qty": bottleneck["qty_issued"],
        "bottleneck_ratio": coverage,
    }


def _summarize_first_step_materials(components, plan_qty=None):
    """兼容现有接收校验，只返回材料行和可接收基准数量。"""
    lines, issued, _calculation = _first_step_material_calculation(
        components, plan_qty
    )
    return lines, issued


def _first_step_order_materials(data):
    header = data.get("header") or {}
    dept_code = str(header.get("DeptCode") or "").strip()
    if dept_code == "04125" or (not dept_code and header.get("cDepName") == "拼皮线"):
        panel = data.get("panel_first_issue") or {}
        calculation = panel.get("calculation") or {}
        issued = panel.get("issued_qty")
        if calculation.get("mode") != "panel_area" or issued is None or not isfinite(issued) or issued < 0:
            raise RuntimeError("拼皮领料面积待核对，请确认ERP工单的应领木皮面积")
        return calculation["materials"], issued, calculation
    return _first_step_material_calculation(data.get("components") or [], header.get("Qty_b"))


def _first_step_material_receipt(mo_code, sort_seq):
    """实时读取ERP领料并返回核算材料明细和可接收数量。"""
    data = _fetch_workorder_detail(mo_code, sort_seq)
    lines, issued, _ = _first_step_order_materials(data)
    return lines, issued


def _workorder_plan_qty(mo_code, sort_seq):
    try:
        data = _fetch_workorder_detail(mo_code, sort_seq)
        return float(((data.get("header") or {}).get("Qty_b")) or 0)
    except (RuntimeError, ValueError, TypeError):
        return 0


def _quantity_rule_settings(cur, mo_code, sort_seq):
    """按ERP工单生产部门应用规则；全部开关关闭时不请求ERP。"""
    settings = load_quantity_rule_global_settings(cur)
    if not any(settings.values()):
        return settings
    header = (_fetch_workorder_detail(mo_code, sort_seq).get("header") or {})
    return load_quantity_rule_settings(cur, header.get("DeptCode"))


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


def _handover_good_qty(handover):
    grade_total = sum(float(handover.get(field) or 0) for field in (
        "qty_out_a", "qty_out_a1", "qty_out_a2"
    ))
    if grade_total > 0:
        return grade_total
    return float(handover.get("qty_out") or 0)


def _initial_received_qty(handover, makeup_records):
    if makeup_records:
        return float(makeup_records[0].get("qty_before") or 0)
    return float(handover.get("qty_in") or 0)


def _is_pure_a_completion(qty_a, qty_a1, qty_a2, qty_c):
    return qty_a > 0 and qty_a1 == 0 and qty_a2 == 0 and qty_c == 0


COMPLETION_MAX_PHOTOS = 5
QUALITY_REPORT_MAX_PHOTOS = 2
BEIJING_TIMEZONE = timezone(timedelta(hours=8), "Asia/Shanghai")


def _photo_url_list(value):
    if value in (None, ""):
        return []
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        if text.startswith("["):
            try:
                value = json.loads(text)
            except (TypeError, ValueError) as exc:
                raise ValueError("质量报告照片格式错误") from exc
        else:
            value = text.split(",")
    if not isinstance(value, (list, tuple)):
        raise ValueError("质量报告照片格式错误")
    photos = []
    for item in value:
        photo = str(item or "").strip()
        if photo and photo not in photos:
            photos.append(photo)
    return photos


def _quality_report_photos(body, legacy_key="complete_photo_url"):
    value = body.get("quality_report_photo_urls")
    if value is None:
        return _photo_url_list(body.get(legacy_key))[:QUALITY_REPORT_MAX_PHOTOS]
    photos = _photo_url_list(value)
    if len(photos) > QUALITY_REPORT_MAX_PHOTOS:
        raise ValueError(f"质量报告单照片最多上传{QUALITY_REPORT_MAX_PHOTOS}张")
    return photos


def _completion_photos(body, key="complete_photo_url"):
    photos = _photo_url_list(body.get(key))
    if len(photos) > COMPLETION_MAX_PHOTOS:
        raise ValueError(f"完工照片最多上传{COMPLETION_MAX_PHOTOS}张")
    return photos


def _validate_completion_photos(qty_a, qty_a1, qty_a2, qty_c, photos):
    if not _is_pure_a_completion(qty_a, qty_a1, qty_a2, qty_c) and not photos:
        raise ValueError("存在A1、A2或C级品时必须拍摄完工照片")


def _validate_quality_report_photos(qty_a, qty_a1, qty_a2, qty_c, photos):
    if not _is_pure_a_completion(qty_a, qty_a1, qty_a2, qty_c) and not photos:
        raise ValueError("存在A1、A2或C级品时必须拍摄质量报告单照片")


def _quality_report_json(photos):
    return json.dumps(photos, ensure_ascii=False) if photos else None


def _merge_photo_lists(*photo_lists):
    merged = []
    for photos in photo_lists:
        for photo in photos or []:
            if photo not in merged:
                merged.append(photo)
    return merged


def _completion_is_partial(qty_before, qty_add, target_qty):
    return target_qty > 0 and qty_before + qty_add + 0.0001 < target_qty


def _rework_progress(rework):
    qty_input = float(rework.get("qty_input") or 0)
    completed_qty = sum(float(rework.get(field) or 0) for field in (
        "qty_a", "qty_a1", "qty_a2", "qty_c"
    ))
    return completed_qty, max(0, qty_input - completed_qty)


def _receive_completion_progress(receive, confirmed_qty, execution_qty_done):
    completed = sum(float(receive.get(field) or 0) for field in ('qty_a', 'qty_a1', 'qty_a2', 'qty_c'))
    if receive['status'] != 'processing':
        return completed, 0
    # The execution total already includes this receipt's previous completion batches.
    prior_unfinished = max(0, confirmed_qty - (execution_qty_done - completed))
    return completed, round(max(0, float(receive['qty_input'] or 0) + prior_unfinished - completed), 4)


def _append_record_text(current, value, separator=","):
    current = (current or "").strip()
    value = (value or "").strip()
    if not value:
        return current or None
    if not current:
        return value
    return f"{current}{separator}{value}"


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


@mo_bp.get("/quantity-limits")
def quantity_limits():
    exec_id = request.args.get("exec_id", type=int)
    handover_id = request.args.get("handover_id", type=int)
    if not exec_id and not handover_id:
        return jsonify({"code": 1, "msg": "缺少工序记录"})
    conn = None
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        execution = None
        if exec_id:
            cur.execute("""
                SELECT id,mo_code,sort_seq,route_id,seq,station_id,qty_done
                FROM mo_execution_yx WHERE id=%s
            """, (exec_id,))
            execution = cur.fetchone()
            if not execution:
                raise ValueError("工序记录不存在")
            cur.execute("""
                SELECT id,qty_in,qty_out,qty_out_a,qty_out_a1,qty_out_a2
                FROM mo_handover_yx
                WHERE mo_code=%s AND sort_seq=%s AND route_id=%s AND to_seq=%s
                ORDER BY id DESC LIMIT 1
            """, (execution["mo_code"], execution["sort_seq"], execution["route_id"], execution["seq"]))
        else:
            cur.execute("""
                SELECT id,mo_code,sort_seq,route_id,to_seq AS seq,to_station_id AS station_id,
                       qty_in,qty_out,qty_out_a,qty_out_a1,qty_out_a2
                FROM mo_handover_yx WHERE id=%s
            """, (handover_id,))
        handover = cur.fetchone()
        if not handover:
            raise ValueError("交接记录不存在")
        mo_code = execution["mo_code"] if execution else handover["mo_code"]
        sort_seq = execution["sort_seq"] if execution else handover["sort_seq"]
        settings = _quantity_rule_settings(cur, mo_code, sort_seq)
        seq = int(execution["seq"] if execution else handover["seq"])
        received = float(handover.get("qty_in") or 0)
        previous = _handover_good_qty(handover) if seq > 1 else 0
        completed = float(execution.get("qty_done") or 0) if execution else 0
        pending_receive = 0
        if execution:
            cur.execute("""
                SELECT COALESCE(SUM(qty_input),0) AS qty
                FROM mo_receive_work_yx
                WHERE execution_id=%s AND status='processing'
            """, (execution["id"],))
            pending_receive = float((cur.fetchone() or {}).get("qty") or 0)
        receive_max = None
        if settings["receive_not_exceed_previous_completed"] and seq > 1:
            receive_max = max(0, previous - received - pending_receive)
        complete_caps = []
        if settings["completion_not_exceed_received"] and seq > 1:
            complete_caps.append(received)
        if settings["completion_not_exceed_previous_completed"] and seq > 1:
            complete_caps.append(previous)
        complete_max = max(0, min(complete_caps) - completed) if complete_caps else None
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": {
            "settings": settings,
            "first_step_exempt": seq == 1,
            "current_received": received,
            "current_completed": completed,
            "previous_completed": previous if seq > 1 else None,
            "pending_received": pending_receive,
            "max_receive_qty": receive_max,
            "max_complete_qty": complete_max,
        }})
    except ValueError as exc:
        if conn:
            conn.close()
        return jsonify({"code": 1, "msg": str(exc)})
    except Exception as exc:
        if conn:
            conn.close()
        return jsonify({"code": 1, "msg": str(exc)})


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
                SELECT id, station_name, qty_done, qty_a, qty_a1, qty_a2, qty_c
                FROM mo_execution_yx
                WHERE mo_code=%s AND sort_seq=%s AND route_id=%s AND seq=%s AND status='processing'
                LIMIT 1
            """, (mo_code, sort_seq, route_id, current_seq))
            ex = cur.fetchone()
            if ex:
                active_exec_id = ex['id']
                active_station = ex['station_name'] or ''

        active_workers = []
        completed_qty = 0
        if active_exec_id:
            completed_qty = float(ex.get('qty_done') or 0)
            cur.execute("""
                SELECT ding_user_id AS user_id, user_name_snapshot AS user_name
                FROM mo_execution_worker_yx
                WHERE execution_id=%s ORDER BY id
            """, (active_exec_id,))
            active_workers = cur.fetchall()

        # 接收状态：当前步骤是否有待确认的交接单
        needs_receipt = False
        handover_info = None
        received_qty = None
        if current_status == 'pending' and current_seq == 1:
            cur.execute("""
                SELECT id,qty_out,qty_in,status
                FROM mo_handover_yx
                WHERE mo_code=%s AND sort_seq=%s AND route_id=%s
                  AND from_seq=0 AND to_seq=1
                ORDER BY id DESC LIMIT 1
            """, (mo_code, sort_seq, route_id))
            first_receipt = cur.fetchone()
            if first_receipt and first_receipt['status'] == 'confirmed' and float(first_receipt['qty_in'] or 0) > 0:
                received_qty = float(first_receipt['qty_in'] or 0)
            else:
                try:
                    material_lines, issued_total = _first_step_material_receipt(mo_code, sort_seq)
                except RuntimeError as exc:
                    cur.close(); conn.close()
                    return jsonify({"code": 1, "msg": str(exc)})
                needs_receipt = True
                handover_info = {
                    "id": first_receipt['id'] if first_receipt else None,
                    "is_first_step": True,
                    "qty_out": issued_total,
                    "qty_out_a": issued_total,
                    "qty_out_a1": 0,
                    "qty_out_a2": 0,
                    "complete_reason": None,
                    "prev_process_name": "ERP领料",
                    "material_lines": material_lines
                }
        elif current_status == 'pending' and current_seq > 1:
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
                    "qty_out":          _handover_good_qty(handover),
                    "qty_out_a":        float(handover.get('qty_out_a') or 0),
                    "qty_out_a1":       float(handover.get('qty_out_a1') or 0),
                    "qty_out_a2":       float(handover.get('qty_out_a2') or 0),
                    "complete_reason":  handover['complete_reason'],
                    "prev_process_name": handover['prev_process_name'] or ''
                }

        # 进行中时取当前工序已确认的实际接收数量（第一工序来自ERP领料接收）。
        if current_status == 'processing':
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
                receive_ref_qty = _handover_good_qty(incoming_handover)
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
            "active_exec_id": active_exec_id,
            "workers":        active_workers,
            "needs_receipt":  needs_receipt,
            "handover":       handover_info,
            "received_qty":   received_qty,
            "completed_qty":  completed_qty
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
        cur.execute("""
                SELECT status,qty_in FROM mo_handover_yx
                WHERE mo_code=%s AND sort_seq=%s AND to_seq=%s
                ORDER BY id DESC LIMIT 1
        """, (mo_code, sort_seq, current_seq))
        incoming = cur.fetchone()
        if (not incoming or incoming['status'] != 'confirmed'
                or float(incoming['qty_in'] or 0) <= 0):
            cur.close(); conn.close()
            msg = "第一工序请先接收已领材料后再开工" if current_seq == 1 else "请先完成接收后再开工"
            return jsonify({"code": 1, "msg": msg})

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

        write_operation_log(
            cur,
            event_key=f"execution:start:{execution_id}",
            event_type="start",
            event_name="开工",
            occurred_at=now,
            operator_id=user_id,
            operator_name=operator_name,
            worker_details=worker_snapshots(
                worker_map, worker_ids, temp_worker_count
            ),
            mo_code=mo_code,
            sort_seq=sort_seq,
            route_id=route_id,
            seq=current_seq,
            process_name=step["process_name"],
            station_id=station_id,
            station_name=station_name,
            photo_urls=[start_photo_url] if start_photo_url else [],
            source_type="execution",
            source_id=execution_id,
        )

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
    continue_exec_id = body.get("exec_id")
    complete_reason = (body.get("complete_reason") or "").strip() or None
    user_id         = body.get("user_id", "").strip()
    if not mo_code or sort_seq is None:
        return jsonify({"code": 1, "msg": "参数不完整"})
    try:
        qty_a, qty_a1, qty_a2, qty_c, qty_done, _good_total = _complete_qty_from_body(body)
        completion_photos = _completion_photos(body)
        quality_report_photos = _quality_report_photos(body)
        _validate_completion_photos(
            qty_a, qty_a1, qty_a2, qty_c, completion_photos
        )
        _validate_quality_report_photos(
            qty_a, qty_a1, qty_a2, qty_c, quality_report_photos
        )
    except (ValueError, TypeError) as exc:
        if "照片" in str(exc):
            return jsonify({"code": 1, "msg": str(exc)})
        return jsonify({"code": 1, "msg": "数量格式错误或数量不合法"})
    complete_photo_url = ",".join(completion_photos) or None
    quality_report_photo_urls = _quality_report_json(quality_report_photos)
    conn = None
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        if continue_exec_id:
            cur.execute("""
                SELECT id, route_id, seq, process_name, station_id, station_name,
                       qty_done, qty_a, qty_a1, qty_a2, qty_c,
                       complete_reason, complete_photo_url
                FROM mo_execution_yx
                WHERE id=%s AND mo_code=%s AND sort_seq=%s AND status='done'
                FOR UPDATE
            """, (continue_exec_id, mo_code, sort_seq))
        else:
            cur.execute("""
                SELECT id, route_id, seq, process_name, station_id, station_name,
                       qty_done, qty_a, qty_a1, qty_a2, qty_c,
                       complete_reason, complete_photo_url
                FROM mo_execution_yx
                WHERE mo_code=%s AND sort_seq=%s AND status='processing'
                LIMIT 1 FOR UPDATE
            """, (mo_code, sort_seq))
        exec_rec = cur.fetchone()
        if not exec_rec:
            cur.close(); conn.close()
            msg = "完工记录不存在或状态不正确" if continue_exec_id else "未找到进行中的执行记录"
            return jsonify({"code": 1, "msg": msg})

        operator_name = _get_operator(cur, user_id)
        now = datetime.now()
        route_id    = exec_rec['route_id']
        current_seq = exec_rec['seq']

        cur.execute("""
            SELECT qty_in,qty_out,qty_out_a,qty_out_a1,qty_out_a2 FROM mo_handover_yx
            WHERE mo_code=%s AND sort_seq=%s AND route_id=%s AND to_seq=%s
              AND status='confirmed'
            ORDER BY id DESC LIMIT 1 FOR UPDATE
        """, (mo_code, sort_seq, route_id, current_seq))
        incoming = cur.fetchone()
        if incoming:
            target_qty = float(incoming['qty_in'] or 0)
        elif current_seq == 1:
            try:
                target_qty = float(body.get("plan_qty") or 0)
            except (ValueError, TypeError):
                target_qty = 0
            if target_qty <= 0:
                target_qty = _workorder_plan_qty(mo_code, sort_seq)
        else:
            target_qty = 0
        if target_qty <= 0:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "无法确定应完工数量，请刷新工单后重试"})

        qty_before = float(exec_rec['qty_done'] or 0)
        cumulative_qty = qty_before + qty_done
        cumulative_a = float(exec_rec['qty_a'] or 0) + qty_a
        cumulative_a1 = float(exec_rec['qty_a1'] or 0) + qty_a1
        cumulative_a2 = float(exec_rec['qty_a2'] or 0) + qty_a2
        cumulative_c = float(exec_rec['qty_c'] or 0) + qty_c
        quantity_settings = _quantity_rule_settings(cur, mo_code, sort_seq)
        validate_quantity_rule_complete(
            quantity_settings,
            qty_before,
            qty_done,
            float(incoming['qty_in'] or 0) if incoming else 0,
            _handover_good_qty(incoming) if incoming and current_seq > 1 else 0,
            current_seq > 1,
        )
        is_continue = bool(continue_exec_id)
        is_partial = _completion_is_partial(qty_before, qty_done, target_qty)
        if cumulative_qty > target_qty + 0.0001 and not complete_reason:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "累计完工数量超过应完工数量，请填写说明"})
        all_photos = _append_record_text(exec_rec.get('complete_photo_url'), complete_photo_url)
        all_reasons = _append_record_text(exec_rec.get('complete_reason'), complete_reason, "；")

        cur.execute("""
            SELECT seq FROM mo_route_step_yx
            WHERE route_id=%s AND seq > %s
            ORDER BY seq ASC LIMIT 1
        """, (route_id, current_seq))
        next_step = cur.fetchone()

        cur.close()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO mo_execution_completion_yx
              (execution_id,qty_a,qty_a1,qty_a2,qty_c,qty_done,reason,photo_url,
               quality_report_photo_urls,operator_id,operator_name,is_final,complete_time)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (exec_rec['id'], qty_a, qty_a1, qty_a2, qty_c, qty_done,
              complete_reason, complete_photo_url, quality_report_photo_urls, user_id or None,
              operator_name or None, 0 if is_partial else 1, now))
        completion_id = cur.lastrowid

        cur.execute("""
            UPDATE mo_execution_yx
            SET status='done', qty_done=%s, qty_a=%s, qty_a1=%s, qty_a2=%s, qty_c=%s,
                complete_reason=%s, complete_photo_url=%s,
                complete_operator_id=%s, complete_operator_name=%s, end_time=%s
            WHERE id=%s
        """, (cumulative_qty, cumulative_a, cumulative_a1, cumulative_a2, cumulative_c,
              all_reasons, all_photos, user_id or None, operator_name or None,
              now, exec_rec['id']))

        if next_step:
            next_seq = next_step['seq']
            if is_continue:
                # 继续完工只增加交出数量，保留下工序已接收/已开工状态。
                cur.execute("""
                    INSERT INTO mo_handover_yx
                      (mo_code, sort_seq, route_id, from_seq, to_seq,
                       qty_out, qty_out_a, qty_out_a1, qty_out_a2, operator_out, status)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending')
                    ON DUPLICATE KEY UPDATE
                      qty_out=%s, qty_out_a=%s, qty_out_a1=%s, qty_out_a2=%s,
                      operator_out=%s
                """, (mo_code, sort_seq, route_id, current_seq, next_seq,
                      cumulative_a + cumulative_a1 + cumulative_a2,
                      cumulative_a, cumulative_a1, cumulative_a2, operator_name,
                      cumulative_a + cumulative_a1 + cumulative_a2,
                      cumulative_a, cumulative_a1, cumulative_a2, operator_name))
            else:
                cur.execute("""
                    UPDATE mo_wo_state_yx SET status='pending', current_seq=%s
                    WHERE mo_code=%s AND sort_seq=%s
                """, (next_seq, mo_code, sort_seq))
                # 首批完工即生成交接单；只流转A/A1/A2，C级不进入下一工序。
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
                      cumulative_a + cumulative_a1 + cumulative_a2,
                      cumulative_a, cumulative_a1, cumulative_a2, operator_name,
                      cumulative_a + cumulative_a1 + cumulative_a2,
                      cumulative_a, cumulative_a1, cumulative_a2, operator_name))
        elif not is_continue:
            cur.execute("""
                UPDATE mo_wo_state_yx SET status='done'
                WHERE mo_code=%s AND sort_seq=%s
            """, (mo_code, sort_seq))

        write_operation_log(
            cur,
            event_key=f"completion:{completion_id}",
            event_type="complete",
            event_name="继续完工" if is_continue else (
                "分批完工" if is_partial else "完工"
            ),
            occurred_at=now,
            operator_id=user_id,
            operator_name=operator_name,
            mo_code=mo_code,
            sort_seq=sort_seq,
            route_id=route_id,
            seq=current_seq,
            process_name=exec_rec.get("process_name"),
            station_id=exec_rec.get("station_id"),
            station_name=exec_rec.get("station_name"),
            qty=qty_done,
            qty_a=qty_a,
            qty_a1=qty_a1,
            qty_a2=qty_a2,
            qty_c=qty_c,
            reason=complete_reason,
            photo_urls=_merge_photo_lists(completion_photos, quality_report_photos),
            source_type="completion",
            source_id=completion_id,
            details={
                "is_partial": is_partial,
                "is_continue": is_continue,
                "cumulative_qty": cumulative_qty,
                "target_qty": target_qty,
            },
        )

        conn.commit()
        cur.close(); conn.close()
        return jsonify({
            "code": 0,
            "msg": "本次完工已保存" if is_partial else "完工成功",
            "data": {
                "exec_id": exec_rec['id'],
                "completion_id": completion_id,
                "has_next": bool(next_step),
                "is_partial": is_partial,
                "is_continue": is_continue,
                "cumulative_qty": cumulative_qty,
                "target_qty": target_qty,
                "remaining_qty": max(0, target_qty - cumulative_qty)
            }
        })
    except Exception as e:
        if conn:
            try:
                conn.rollback(); conn.close()
            except Exception:
                pass
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
            """SELECT id, route_id, seq, process_name, station_id, station_name
               FROM mo_execution_yx
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

        plan_qty = _handover_good_qty(handover)
        qty_before = float(handover['qty_in'] or 0)
        qty_after = qty_before + qty_add
        validate_quantity_rule_receive(
            _quantity_rule_settings(cur, mo_code, sort_seq),
            qty_before, 0, qty_add, plan_qty
        )
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
        makeup_id = cur.lastrowid

        write_operation_log(
            cur,
            event_key=f"makeup:{makeup_id}",
            event_type="receive_more",
            event_name="追加接收",
            occurred_at=now,
            operator_id=user_id,
            operator_name=operator_name,
            mo_code=mo_code,
            sort_seq=sort_seq,
            route_id=exec_rec["route_id"],
            seq=exec_rec["seq"],
            process_name=exec_rec.get("process_name"),
            station_id=exec_rec.get("station_id"),
            station_name=exec_rec.get("station_name"),
            qty=qty_add,
            reason=reason,
            source_type="makeup",
            source_id=makeup_id,
            details={
                "qty_before": qty_before,
                "qty_after": qty_after,
                "reference_qty": plan_qty,
            },
        )

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
@mo_bp.post("/receive-first")
def receive_first_step_materials():
    body = request.get_json() or {}
    mo_code = body.get("mo_code", "").strip()
    sort_seq = body.get("sort_seq")
    category_name = body.get("category_name", "").strip()
    receipt_reason = (body.get("receipt_reason") or "").strip() or None
    photo_url = (body.get("photo_url") or "").strip() or None
    user_id = body.get("user_id", "").strip()
    if not mo_code or sort_seq is None:
        return jsonify({"code": 1, "msg": "参数不完整"})
    if not photo_url:
        return jsonify({"code": 1, "msg": "接收请先上传领用照片"})
    try:
        qty_a, qty_a1, qty_a2, qty_in = _receive_qty_from_body(body, "qty")
    except (ValueError, TypeError):
        return jsonify({"code": 1, "msg": "数量格式错误"})
    try:
        material_lines, issued_total = _first_step_material_receipt(mo_code, sort_seq)
    except RuntimeError as exc:
        return jsonify({"code": 1, "msg": str(exc)})
    if issued_total <= 0:
        return jsonify({"code": 1, "msg": "ERP材料尚未领料，不能接收"})
    if qty_in > issued_total + 0.0001:
        return jsonify({"code": 1, "msg": f"最多可接收ERP已领材料{issued_total:g}件"})
    if abs(qty_in - issued_total) > 0.0001 and not receipt_reason:
        return jsonify({"code": 1, "msg": "接收数量与ERP已领材料汇总不一致，请填写说明"})

    conn = None
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        route_id = _find_route(cur, mo_code, sort_seq, category_name)
        if not route_id:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "未找到工艺路线，请联系PMC配置"})
        cur.execute("""
            SELECT current_seq,status FROM mo_wo_state_yx
            WHERE mo_code=%s AND sort_seq=%s FOR UPDATE
        """, (mo_code, sort_seq))
        state = cur.fetchone()
        if state and (int(state['current_seq']) != 1 or state['status'] != 'pending'):
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "第一工序当前不能接收材料"})
        cur.execute("""
            SELECT id,status,qty_in FROM mo_handover_yx
            WHERE mo_code=%s AND sort_seq=%s AND route_id=%s
              AND from_seq=0 AND to_seq=1
            ORDER BY id DESC LIMIT 1 FOR UPDATE
        """, (mo_code, sort_seq, route_id))
        existing = cur.fetchone()
        if existing and existing['status'] == 'confirmed' and float(existing['qty_in'] or 0) > 0:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "第一工序已完成领料接收"})
        operator_name = _get_operator(cur, user_id)
        cur.execute("""
            SELECT p.process_name
            FROM mo_route_step_yx step
            JOIN mo_process_yx p ON p.id=step.process_id
            WHERE step.route_id=%s AND step.seq=1
        """, (route_id,))
        first_step = cur.fetchone() or {}
        now = datetime.now()
        cur.close()
        cur = conn.cursor()
        if existing:
            cur.execute("""
                UPDATE mo_handover_yx
                SET qty_out=%s,qty_out_a=%s,qty_out_a1=0,qty_out_a2=0,
                    qty_in=%s,qty_in_a=%s,qty_in_a1=%s,qty_in_a2=%s,
                    receipt_reason=%s,receive_photo_url=%s,operator_out='ERP领料',
                    operator_in=%s,status='confirmed',confirm_time=%s
                WHERE id=%s
            """, (issued_total, issued_total, qty_in, qty_a, qty_a1, qty_a2,
                  receipt_reason, photo_url, operator_name, now, existing['id']))
            handover_id = existing['id']
        else:
            cur.execute("""
                INSERT INTO mo_handover_yx
                  (mo_code,sort_seq,route_id,from_seq,to_seq,
                   qty_out,qty_out_a,qty_out_a1,qty_out_a2,
                   qty_in,qty_in_a,qty_in_a1,qty_in_a2,
                   receipt_reason,receive_photo_url,operator_out,operator_in,status,confirm_time)
                VALUES (%s,%s,%s,0,1,%s,%s,0,0,%s,%s,%s,%s,%s,%s,'ERP领料',%s,'confirmed',%s)
            """, (mo_code, sort_seq, route_id, issued_total, issued_total,
                  qty_in, qty_a, qty_a1, qty_a2, receipt_reason, photo_url,
                  operator_name, now))
            handover_id = cur.lastrowid
        write_operation_log(
            cur,
            event_key=f"handover:receive:{handover_id}",
            event_type="receive_first",
            event_name="首工序领料接收",
            occurred_at=now,
            operator_id=user_id,
            operator_name=operator_name,
            mo_code=mo_code,
            sort_seq=sort_seq,
            route_id=route_id,
            seq=1,
            process_name=first_step.get("process_name"),
            qty=qty_in,
            qty_a=qty_a,
            qty_a1=qty_a1,
            qty_a2=qty_a2,
            reason=receipt_reason,
            photo_urls=[photo_url],
            source_type="handover",
            source_id=handover_id,
            details={"erp_issued_qty": issued_total},
        )
        conn.commit()
        cur.close(); conn.close()
        return jsonify({
            "code": 0,
            "msg": "接收成功",
            "data": {
                "handover_id": handover_id,
                "received_qty": qty_in,
                "issued_total": issued_total,
                "material_count": len(material_lines)
            }
        })
    except Exception as e:
        if conn:
            try:
                conn.rollback(); conn.close()
            except Exception:
                pass
        return jsonify({"code": 1, "msg": str(e)})


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
            SELECT id,route_id,to_seq,to_station_id,
                   qty_out,qty_out_a,qty_out_a1,qty_out_a2,qty_in,status
            FROM mo_handover_yx
            WHERE id=%s AND mo_code=%s AND sort_seq=%s FOR UPDATE
        """, (handover_id, mo_code, sort_seq))
        handover = cur.fetchone()
        if not handover or handover['status'] != 'pending':
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "交接单不存在或已接收完成"})
        qty_out = _handover_good_qty(handover)
        if int(handover['to_seq']) > 1:
            validate_quantity_rule_receive(
                _quantity_rule_settings(cur, mo_code, sort_seq),
                0, 0, qty_in, qty_out
            )
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

        cur.execute("""
            SELECT p.process_name,w.station_name
            FROM mo_route_step_yx step
            JOIN mo_process_yx p ON p.id=step.process_id
            LEFT JOIN mo_workstation_yx w ON w.id=%s
            WHERE step.route_id=%s AND step.seq=%s
        """, (
            handover.get("to_station_id"), handover["route_id"],
            handover["to_seq"],
        ))
        target = cur.fetchone() or {}

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

        write_operation_log(
            cur,
            event_key=f"handover:receive:{handover_id}",
            event_type="receive",
            event_name="工序接收",
            occurred_at=now,
            operator_id=user_id,
            operator_name=operator_name,
            mo_code=mo_code,
            sort_seq=sort_seq,
            route_id=handover["route_id"],
            seq=handover["to_seq"],
            process_name=target.get("process_name"),
            station_id=handover.get("to_station_id"),
            station_name=target.get("station_name"),
            qty=qty_in,
            qty_a=qty_a,
            qty_a1=qty_a1,
            qty_a2=qty_a2,
            reason=receipt_reason,
            photo_urls=[photo_url],
            source_type="handover",
            source_id=handover_id,
        )

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
            SELECT id,qty_a,qty_a1,qty_a2,qty_c,qty_done,reason,photo_url,
                   quality_report_photo_urls,operator_name,is_final,complete_time
            FROM mo_execution_completion_yx
            WHERE execution_id=%s ORDER BY id
        """, (exec_id,))
        completion_records = cur.fetchall()
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
                   h.qty_in,h.qty_in_a,h.qty_in_a1,h.qty_in_a2,h.receipt_reason,
                   h.operator_in,h.receive_photo_url,h.confirm_time,p.process_name
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
            WHERE execution_id=%s ORDER BY id
        """, (exec_id,))
        makeup_records = cur.fetchall()
        cur.execute("""
            SELECT id,qty_input,qty_input_a,qty_input_a1,qty_input_a2,
                   qty_a,qty_a1,qty_a2,qty_c,qty_before,qty_ref,reason,
                   photo_url,complete_photo_url,status,start_time,end_time
            FROM mo_receive_work_yx
            WHERE execution_id=%s
            ORDER BY id
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
        rework_completion_map = {}
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
            cur.execute(f"""
                SELECT id,rework_id,qty_a,qty_a1,qty_a2,qty_c,qty_done,
                       remark,photo_url,quality_report_photo_urls,is_final,complete_time
                FROM mo_rework_completion_yx
                WHERE rework_id IN ({marks}) ORDER BY id
            """, rework_ids)
            for completion in cur.fetchall():
                rework_completion_map.setdefault(completion['rework_id'], []).append(completion)
        cur.close(); conn.close()
        first_step_material_lines = None
        first_step_issued_total = None
        if int(row['seq']) == 1 and previous_exec and "qty_in" in previous_exec:
            try:
                first_step_material_lines, first_step_issued_total = _first_step_material_receipt(
                    row['mo_code'], row['sort_seq']
                )
            except RuntimeError:
                # ERP暂时不可用时沿用已保存快照，不放大可接收数量。
                pass
        duration_text = _format_duration(row['start_time'], row['end_time'])
        has_next = bool(next_exec or (state and int(state['current_seq']) > int(row['seq'])))
        data = _ser(row)
        data["qty_done"] = float(data["qty_done"] or 0)
        data["qty_a"] = float(data["qty_a"] or 0)
        data["qty_a1"] = float(data["qty_a1"] or 0)
        data["qty_a2"] = float(data["qty_a2"] or 0)
        data["qty_c"] = float(data["qty_c"] or 0)
        data["workers"] = workers
        data["completion_records"] = []
        for record in completion_records:
            item = _ser(record)
            for field in ("qty_a", "qty_a1", "qty_a2", "qty_c", "qty_done"):
                item[field] = float(item[field] or 0)
            item["quality_report_photo_urls"] = _photo_url_list(
                item.get("quality_report_photo_urls")
            )
            data["completion_records"].append(item)
        if previous_exec and "qty_in" in previous_exec:
            completion_target_qty = float(previous_exec.get("qty_in") or 0)
        else:
            completion_target_qty = _workorder_plan_qty(row['mo_code'], row['sort_seq'])
        data["completion_target_qty"] = completion_target_qty
        data["completion_remaining_qty"] = max(0, completion_target_qty - data["qty_done"])
        data["can_continue_completion"] = (
            data["status"] == "done" and data["completion_remaining_qty"] > 0.0001
        )
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
            data["receive_ref_qty"] = _handover_good_qty(previous_exec)
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
        if first_step_issued_total is not None:
            data["receive_ref_process_name"] = "ERP领料"
            data["receive_ref_qty"] = first_step_issued_total
            data["receive_ref_a"] = first_step_issued_total
            data["receive_ref_a1"] = 0
            data["receive_ref_a2"] = 0
            data["first_step_material_lines"] = first_step_material_lines
        processing_receive_records = [
            record for record in receive_work_records if record["status"] == "processing"
        ]
        data["receive_processing_qty"] = sum(
            float(record.get("qty_input") or 0) for record in processing_receive_records
        )
        data["receive_processing_a"] = sum(
            float(record.get("qty_input_a") or 0) for record in processing_receive_records
        )
        data["receive_processing_a1"] = sum(
            float(record.get("qty_input_a1") or 0) for record in processing_receive_records
        )
        data["receive_processing_a2"] = sum(
            float(record.get("qty_input_a2") or 0) for record in processing_receive_records
        )
        data["receive_available_qty"] = max(
            0,
            data["receive_ref_qty"] - data["receive_current_qty"] - data["receive_processing_qty"]
        )
        data["makeup_records"] = []
        if previous_exec and float(previous_exec.get("qty_in") or 0) > 0:
            initial_received_qty = _initial_received_qty(previous_exec, makeup_records)
            data["makeup_records"].append({
                "id": f"handover-{previous_exec['id']}",
                "qty_before": 0,
                "qty_add": initial_received_qty,
                "qty_after": initial_received_qty,
                "plan_qty": _handover_good_qty(previous_exec),
                "reason": previous_exec.get("receipt_reason"),
                "operator_name": previous_exec.get("operator_in"),
                "create_time": (
                    previous_exec["confirm_time"].strftime('%Y-%m-%d %H:%M:%S')
                    if previous_exec.get("confirm_time") else None
                ),
                "is_initial": True,
            })
        data["makeup_records"].extend(_ser(record) for record in makeup_records)
        for record in data["makeup_records"]:
            for field in ("qty_before", "qty_add", "qty_after", "plan_qty"):
                record[field] = float(record[field]) if record[field] is not None else None
        data["receive_work_records"] = []
        if previous_exec and float(previous_exec.get("qty_in") or 0) > 0:
            initial_received_qty = _initial_received_qty(previous_exec, makeup_records)
            completed_receives = [
                record for record in receive_work_records if record["status"] == "done"
            ]
            initial_a = max(0, float(previous_exec.get("qty_in_a") or 0) - sum(
                float(record.get("qty_input_a") or 0) for record in completed_receives
            ))
            initial_a1 = max(0, float(previous_exec.get("qty_in_a1") or 0) - sum(
                float(record.get("qty_input_a1") or 0) for record in completed_receives
            ))
            initial_a2 = max(0, float(previous_exec.get("qty_in_a2") or 0) - sum(
                float(record.get("qty_input_a2") or 0) for record in completed_receives
            ))
            if initial_a + initial_a1 + initial_a2 <= 0:
                initial_a = initial_received_qty
            data["receive_work_records"].append({
                "id": f"handover-{previous_exec['id']}",
                "qty_input": initial_received_qty,
                "qty_input_a": initial_a,
                "qty_input_a1": initial_a1,
                "qty_input_a2": initial_a2,
                "qty_a": 0,
                "qty_a1": 0,
                "qty_a2": 0,
                "qty_c": 0,
                "qty_before": 0,
                "qty_ref": _handover_good_qty(previous_exec),
                "reason": previous_exec.get("receipt_reason"),
                "photo_url": previous_exec.get("receive_photo_url"),
                "complete_photo_url": None,
                "status": "received",
                "start_time": (
                    previous_exec["confirm_time"].strftime('%Y-%m-%d %H:%M:%S')
                    if previous_exec.get("confirm_time") else None
                ),
                "end_time": None,
                "duration_text": "-",
                "workers": workers,
                "is_initial": True,
            })
        for record in receive_work_records:
            item = _ser(record)
            for field in ("qty_input", "qty_input_a", "qty_input_a1", "qty_input_a2",
                          "qty_a", "qty_a1", "qty_a2", "qty_c", "qty_before", "qty_ref"):
                item[field] = float(item[field] or 0)
            item["workers"] = receive_worker_map.get(record['id'], [])
            item["duration_text"] = _format_duration(record['start_time'], record['end_time'])
            item["completed_qty"], item["remaining_qty"] = _receive_completion_progress(
                item, data["receive_current_qty"], data["qty_done"],
            )
            data["receive_work_records"].append(item)
        data["receive_work"] = next(
            (item for item in data["receive_work_records"] if item["status"] == "processing"),
            data["receive_work_records"][-1] if data["receive_work_records"] else None
        )
        data["rework_records"] = []
        for record in rework_records:
            item = _ser(record)
            for field in ("qty_input", "qty_a", "qty_a1", "qty_a2", "qty_c"):
                item[field] = float(item[field] or 0)
            item["workers"] = rework_worker_map.get(record['id'], [])
            item["duration_text"] = _format_duration(record['start_time'], record['end_time'])
            completed_qty, remaining_qty = _rework_progress(item)
            item["completed_qty"] = completed_qty
            item["remaining_qty"] = remaining_qty
            item["completion_records"] = []
            for completion in rework_completion_map.get(record['id'], []):
                completion_item = _ser(completion)
                for field in ("qty_a", "qty_a1", "qty_a2", "qty_c", "qty_done"):
                    completion_item[field] = float(completion_item[field] or 0)
                completion_item["quality_report_photo_urls"] = _photo_url_list(
                    completion_item.get("quality_report_photo_urls")
                )
                completion_item["source_type"] = "rework_completion"
                completion_item["source_id"] = completion_item["id"]
                item["completion_records"].append(completion_item)
            if item["status"] == "done" and not item["completion_records"]:
                item["completion_records"].append({
                    "id": f"legacy-{item['id']}",
                    "qty_a": item["qty_a"],
                    "qty_a1": item["qty_a1"],
                    "qty_a2": item["qty_a2"],
                    "qty_c": item["qty_c"],
                    "qty_done": completed_qty,
                    "remark": item.get("complete_remark"),
                    "photo_url": item.get("complete_photo_url"),
                    "is_final": 1,
                    "complete_time": item.get("end_time"),
                    "source_type": "rework",
                    "source_id": item["id"],
                })
            data["rework_records"].append(item)
        data["rework"] = next(
            (item for item in data["rework_records"] if item["status"] == "processing"),
            data["rework_records"][0] if data["rework_records"] else None
        )
        data["rework_processing_qty"] = sum(
            item["remaining_qty"] for item in data["rework_records"] if item["status"] == "processing"
        )
        data["rework_available_qty"] = max(0, data["qty_done"] - data["rework_processing_qty"])
        return jsonify({"code": 0, "data": data})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.get("/execution/label")
def execution_label(source_args=None):
    source_args = request.args if source_args is None else source_args
    exec_id = source_args.get("id", "").strip()
    source_type = source_args.get("source_type", "").strip()
    source_id = source_args.get("source_id", "").strip()
    if not exec_id:
        return jsonify({"code": 1, "msg": "id不能为空"})
    if source_type and (
        source_type not in ("completion", "receive", "rework", "rework_completion")
        or not source_id
    ):
        return jsonify({"code": 1, "msg": "标签来源参数不正确"})
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

        label_type = "工序流转"
        if source_type == "completion":
            cur.execute("""
                SELECT qty_done,qty_a,qty_a1,qty_a2,qty_c,complete_time
                FROM mo_execution_completion_yx
                WHERE id=%s AND execution_id=%s
            """, (source_id, exec_id))
            source = cur.fetchone()
            if source:
                for field in ("qty_done", "qty_a", "qty_a1", "qty_a2", "qty_c"):
                    row[field] = source[field]
                row['end_time'] = source['complete_time']
                label_type = "本次工序完工"
        elif source_type == "receive":
            cur.execute("""
                SELECT qty_a,qty_a1,qty_a2,qty_c,end_time,status
                FROM mo_receive_work_yx
                WHERE id=%s AND execution_id=%s
            """, (source_id, exec_id))
            source = cur.fetchone()
            if source and source['status'] == 'done':
                for field in ("qty_a", "qty_a1", "qty_a2", "qty_c"):
                    row[field] = source[field]
                row['qty_done'] = sum(float(source[field] or 0) for field in ("qty_a", "qty_a1", "qty_a2", "qty_c"))
                row['end_time'] = source['end_time']
                label_type = "本次工序完工"
            else:
                source = None
        elif source_type == "rework":
            cur.execute("""
                SELECT qty_a,qty_a1,qty_a2,qty_c,end_time,status
                FROM mo_rework_yx
                WHERE id=%s AND source_execution_id=%s
            """, (source_id, exec_id))
            source = cur.fetchone()
            if source and source['status'] == 'done':
                for field in ("qty_a", "qty_a1", "qty_a2", "qty_c"):
                    row[field] = source[field]
                row['qty_done'] = sum(float(source[field] or 0) for field in ("qty_a", "qty_a1", "qty_a2", "qty_c"))
                row['end_time'] = source['end_time']
                label_type = "本次返工完工"
            else:
                source = None
        elif source_type == "rework_completion":
            cur.execute("""
                SELECT c.qty_done,c.qty_a,c.qty_a1,c.qty_a2,c.qty_c,c.complete_time
                FROM mo_rework_completion_yx c
                JOIN mo_rework_yx r ON r.id=c.rework_id
                WHERE c.id=%s AND r.source_execution_id=%s
            """, (source_id, exec_id))
            source = cur.fetchone()
            if source:
                for field in ("qty_done", "qty_a", "qty_a1", "qty_a2", "qty_c"):
                    row[field] = source[field]
                row['end_time'] = source['complete_time']
                label_type = "本次返工完工"
        else:
            source = row
        if source_type and not source:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "本次完工标签记录不存在"})

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
        data["label_type"] = label_type
        data["source_type"] = source_type or "execution"
        data["source_id"] = source_id or row['id']
        return jsonify({"code": 0, "data": data})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


def _label_pdf_font():
    font_name = "JMLLabelCJK"
    if font_name in pdfmetrics.getRegisteredFontNames():
        return font_name
    candidates = (
        (os.getenv("JML_LABEL_PDF_FONT") or "").strip(),
        "/usr/share/fonts/wqy-microhei/wqy-microhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "C:/Windows/Fonts/simhei.ttf",
    )
    for path in candidates:
        if path and os.path.isfile(path):
            pdfmetrics.registerFont(TTFont(font_name, path))
            return font_name
    fallback = "STSong-Light"
    if fallback not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(UnicodeCIDFont(fallback))
    return fallback


def _label_text(value, limit=120):
    return str(value if value is not None else "").replace("\r", " ").replace("\n", " ")[:limit]


def _label_number(value):
    try:
        number = float(value or 0)
    except (TypeError, ValueError):
        return "0"
    return str(int(number)) if number.is_integer() else (f"{number:.4f}".rstrip("0").rstrip("."))


def _label_wrap(text, max_width, font_name, font_size, max_lines=3):
    lines = []
    current = ""
    for char in _label_text(text, 300):
        candidate = current + char
        if current and pdfmetrics.stringWidth(candidate, font_name, font_size) > max_width:
            lines.append(current.rstrip())
            current = char.lstrip()
            if len(lines) >= max_lines:
                break
        else:
            current = candidate
    if current and len(lines) < max_lines:
        lines.append(current.rstrip())
    return lines


def _build_process_label_pdf(label, header, route_steps=None, queue_index=1, queue_total=1):
    font_name = _label_pdf_font()
    page_width, page_height = 100 * mm, 180 * mm
    stream = BytesIO()
    pdf = canvas.Canvas(stream, pagesize=(page_width, page_height), pageCompression=1)

    mo_code = _label_text(label.get("mo_code"), 40)
    sort_seq = _label_text(label.get("sort_seq"), 12)
    label_type = _label_text(label.get("label_type") or "工序流转", 30)
    title = f"{label_type}标签"
    try:
        queue_index = max(1, int(queue_index or 1))
        queue_total = max(1, int(queue_total or 1))
    except (TypeError, ValueError):
        queue_index, queue_total = 1, 1
    if queue_total > 1:
        title += f"（{queue_index}/{queue_total}）"
    pdf.setTitle(f"{mo_code} 第{sort_seq}行 {title}")
    pdf.setAuthor("金米龙生产报工系统")

    border_margin = 2.5 * mm
    margin = 5.4 * mm
    right = page_width - margin
    mid_gray = Color(0.33, 0.33, 0.33)

    def centered(text, center_x, y, size, color=black):
        pdf.setFillColor(color)
        pdf.setFont(font_name, size)
        pdf.drawCentredString(center_x, y, _label_text(text))

    pdf.setStrokeColor(black)
    pdf.setLineWidth(1.15)
    pdf.rect(border_margin, border_margin, 95 * mm, 175 * mm, fill=0, stroke=1)

    pdf.setFillColor(black)
    title_size = min(14.5, 14.5 * (64 * mm) / max(pdfmetrics.stringWidth(title, font_name, 14.5), 1))
    pdf.setFont(font_name, title_size)
    pdf.drawString(margin, 168.7 * mm, title)

    qr_url = (
        "https://api.quanshenghuoqin.com/jml/process/"
        f"?mocode={mo_code}&sortseq={sort_seq}&target=next_process"
    )
    qr_size = 21.3 * mm
    qr = createBarcodeDrawing(
        "QR", value=qr_url, barLevel="M", width=qr_size, height=qr_size,
        humanReadable=False
    )
    renderPDF.draw(qr, pdf, 73.1 * mm, 149.3 * mm)

    pdf.setFillColor(black)
    pdf.setFont(font_name, 5.7)
    pdf.drawString(margin, 161.5 * mm, "完整路线")

    legend_y = 159.8 * mm
    legend_x = 18.4 * mm
    current_legend_width = 14.2 * mm
    pdf.setFillColor(black)
    pdf.rect(legend_x, legend_y, current_legend_width, 4.3 * mm, fill=1, stroke=0)
    centered("当前工序", legend_x + current_legend_width / 2, legend_y + 1.25 * mm, 4.5, white)
    next_legend_x = legend_x + current_legend_width + 2 * mm
    next_legend_width = 14.2 * mm
    pdf.setFillColor(white)
    pdf.setStrokeColor(black)
    pdf.setLineWidth(0.65)
    pdf.rect(next_legend_x, legend_y, next_legend_width, 4.3 * mm, fill=1, stroke=1)
    centered("下一工序", next_legend_x + next_legend_width / 2, legend_y + 1.25 * mm, 4.5)

    steps = route_steps if isinstance(route_steps, list) else []
    if not steps:
        raw_steps = label.get("steps") if isinstance(label.get("steps"), list) else []
        current_index = max(0, int(float(label.get("step_index") or 1)) - 1)
        steps = []
        for index, step in enumerate(raw_steps):
            item = dict(step) if isinstance(step, dict) else {"process_name": step}
            item["state"] = "current" if index == current_index else ("next" if index == current_index + 1 else "")
            steps.append(item)
    x, y = margin, 151.4 * mm
    max_route_right = 70.5 * mm
    chip_height = 5.2 * mm
    for index, step in enumerate(steps[:12]):
        name = _label_text((step or {}).get("process_name") if isinstance(step, dict) else step, 14) or "-"
        state = _label_text((step or {}).get("state") if isinstance(step, dict) else "", 10)
        chip_width = max(7.5 * mm, pdfmetrics.stringWidth(name, font_name, 5.2) + 2.2 * mm)
        arrow_width = 3.8 * mm if index < len(steps) - 1 else 0
        if x + chip_width + arrow_width > max_route_right:
            x = margin
            y -= 6.8 * mm
        if state == "current":
            pdf.setFillColor(black)
            pdf.rect(x, y, chip_width, chip_height, fill=1, stroke=0)
            centered(name, x + chip_width / 2, y + 1.55 * mm, 5.2, white)
        elif state == "next":
            pdf.setFillColor(white)
            pdf.setStrokeColor(black)
            pdf.setLineWidth(0.75)
            pdf.rect(x, y, chip_width, chip_height, fill=1, stroke=1)
            centered(name, x + chip_width / 2, y + 1.55 * mm, 5.2)
        else:
            centered(name, x + chip_width / 2, y + 1.55 * mm, 5.2)
        x += chip_width
        if index < len(steps) - 1:
            centered("→", x + 1.5 * mm, y + 1.55 * mm, 5, mid_gray)
            x += arrow_width

    pdf.setStrokeColor(black)
    pdf.setLineWidth(0.8)
    pdf.line(margin, 136.4 * mm, right, 136.4 * mm)
    pdf.setFillColor(black)
    pdf.setFont(font_name, 8.1)
    pdf.drawString(margin + 1.3 * mm, 130.7 * mm, f"工单：{mo_code}")
    pdf.drawString(margin + 1.3 * mm, 124.5 * mm, f"行号：{sort_seq}")
    pdf.setFillColor(mid_gray)
    pdf.setFont(font_name, 5.4)
    pdf.drawString(margin + 1.3 * mm, 118.2 * mm, "产品")
    pdf.setFillColor(black)
    pdf.setFont(font_name, 5.6)
    product_code = _label_text(header.get("InvCode_b"), 100) or "-"
    for index, line in enumerate(_label_wrap(product_code, 86 * mm, font_name, 5.6, 2)):
        pdf.drawString(margin + 1.3 * mm, (113.8 - index * 4) * mm, line)
    pdf.setFont(font_name, 7.2)
    product_name = _label_text(header.get("cInvName"), 240) or "-"
    for index, line in enumerate(_label_wrap(product_name, 86 * mm, font_name, 7.2, 3)):
        pdf.drawString(margin + 1.3 * mm, (106.3 - index * 4.8) * mm, line)

    pdf.setStrokeColor(black)
    pdf.setLineWidth(0.8)
    pdf.line(margin, 94.5 * mm, right, 94.5 * mm)
    pdf.setFillColor(black)
    pdf.setFont(font_name, 7.3)
    pdf.drawString(margin + 1.3 * mm, 87.9 * mm, "当前流转")
    pdf.setFont(font_name, 6.2)
    step_total = _label_number(label.get("step_total"))
    pdf.drawRightString(right - 1.3 * mm, 88.1 * mm, f"步骤 {_label_number(label.get('step_index'))}/{step_total}")

    box_y, box_height = 75.3 * mm, 8.6 * mm
    box_width = 40 * mm
    pdf.setFillColor(black)
    pdf.rect(margin + 1.3 * mm, box_y, box_width, box_height, fill=1, stroke=0)
    centered(f"当前：{_label_text(label.get('process_name'), 24) or '-'}", margin + 1.3 * mm + box_width / 2, box_y + 3.1 * mm, 7, white)
    next_x = right - 1.3 * mm - box_width
    pdf.setFillColor(white)
    pdf.setStrokeColor(black)
    pdf.setLineWidth(0.9)
    pdf.rect(next_x, box_y, box_width, box_height, fill=1, stroke=1)
    centered(f"下一步：{_label_text(label.get('next_process_name'), 24) or '无'}", next_x + box_width / 2, box_y + 3.1 * mm, 7)

    grid_bottom, grid_top = 47 * mm, 67.2 * mm
    grid_width = right - margin - 1.3 * mm
    col_width = grid_width / 5
    c_column_x = margin + 4 * col_width
    pdf.setFillColor(black)
    pdf.rect(c_column_x, grid_bottom, col_width, grid_top - grid_bottom, fill=1, stroke=0)
    pdf.setStrokeColor(black)
    pdf.setLineWidth(1.1)
    pdf.line(margin, grid_top, margin + grid_width, grid_top)
    pdf.line(margin, grid_bottom, margin + grid_width, grid_bottom)
    for index in range(1, 5):
        x = margin + col_width * index
        pdf.setLineWidth(0.4)
        pdf.line(x, grid_bottom, x, grid_top)
    values = (
        ("合计", label.get("qty_done")),
        ("A", label.get("qty_a")),
        ("A1", label.get("qty_a1")),
        ("A2", label.get("qty_a2")),
        ("C", label.get("qty_c")),
    )
    for index, (name, value) in enumerate(values):
        color = white if index == 4 else black
        center_x = margin + col_width * (index + 0.5)
        centered(name, center_x, 59.9 * mm, 6.5, color)
        centered(_label_number(value), center_x, 51.3 * mm, 11.5, color)

    pdf.setFillColor(black)
    pdf.setFont(font_name, 6.3)
    pdf.drawString(margin + 1.3 * mm, 39 * mm, f"工站：{_label_text(label.get('station_name'), 48) or '-'}")
    pdf.drawString(margin + 1.3 * mm, 32.8 * mm, f"完工：{_label_text(label.get('end_time'), 30) or '-'}")
    pdf.setStrokeColor(black)
    pdf.setLineWidth(0.55)
    pdf.line(margin + 1.3 * mm, 27.2 * mm, right - 1.3 * mm, 27.2 * mm)
    pdf.setFillColor(black)
    pdf.setFont(font_name, 5.2)
    tip = "提示：下一工序接收前，请核对工单、步骤、数量与产品信息。"
    for index, line in enumerate(_label_wrap(tip, 85 * mm, font_name, 5.2, 2)):
        pdf.drawString(margin + 1.3 * mm, (22.7 - index * 4.2) * mm, line)

    pdf.showPage()
    pdf.save()
    stream.seek(0)
    return stream


@mo_bp.post("/execution/label-pdf")
def execution_label_pdf():
    body = request.get_json(silent=True) or {}
    label = body.get("label")
    header = body.get("header")
    route_steps = body.get("route_steps")
    if not isinstance(label, dict) or not isinstance(header, dict):
        return jsonify({"code": 1, "msg": "PDF标签数据不完整"}), 400
    if not label.get("mo_code") or label.get("sort_seq") in (None, ""):
        return jsonify({"code": 1, "msg": "PDF标签缺少工单号或行号"}), 400
    try:
        pdf_stream = _build_process_label_pdf(
            label,
            header,
            route_steps=route_steps,
            queue_index=body.get("queue_index", 1),
            queue_total=body.get("queue_total", 1),
        )
        filename = f"{_label_text(label.get('mo_code'), 40)}_第{_label_text(label.get('sort_seq'), 12)}行_工序流转标签.pdf"
        return send_file(
            pdf_stream,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
            max_age=0,
        )
    except Exception as e:
        return jsonify({"code": 1, "msg": f"PDF生成失败：{e}"}), 500


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
        cur.execute("SELECT id,status,mo_code,sort_seq,route_id,seq,process_name FROM mo_execution_yx WHERE id=%s", (exec_id,))
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
        if body.get('source_type') or body.get('source_id'):
            cur.execute('SELECT id,execution_id,operator_id FROM mo_execution_print_log_yx WHERE client_job_id=%s', (client_job_id,))
            print_row = cur.fetchone()
            if (not print_row or int(print_row['execution_id']) != int(exec_id)
                    or (print_row['operator_id'] or '') != user_id):
                raise ValueError('打印记录与工序或人员不匹配')
            record_batch_print(cur, execution, print_row['id'], body.get('source_type'),
                               body.get('source_id'), user_id, operator_name)
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
            SELECT id,mo_code,sort_seq,route_id,seq,process_name,
                   station_id,station_name,status
            FROM mo_execution_yx WHERE id=%s FOR UPDATE
        """, (exec_id,))
        source = cur.fetchone()
        if not source or source['status'] != 'done':
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "只能对已完工记录发起接收"})
        cur.execute("""
            SELECT id,qty_input,qty_input_a,qty_input_a1,qty_input_a2,reason,photo_url
            FROM mo_receive_work_yx
            WHERE execution_id=%s AND status='processing'
            ORDER BY id DESC LIMIT 1
            FOR UPDATE
        """, (exec_id,))
        active_receive = cur.fetchone()
        cur.execute("""
            SELECT id,qty_out,qty_out_a,qty_out_a1,qty_out_a2,
                   qty_in,qty_in_a,qty_in_a1,qty_in_a2
            FROM mo_handover_yx
            WHERE mo_code=%s AND sort_seq=%s AND route_id=%s AND to_seq=%s
            ORDER BY id DESC LIMIT 1
            FOR UPDATE
        """, (source['mo_code'], source['sort_seq'], source['route_id'], source['seq']))
        handover = cur.fetchone()
        if not handover:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "未找到上工序交接记录，不能接收"})
        qty_ref = _handover_good_qty(handover)
        qty_before = float(handover['qty_in'] or 0)
        out_a = float(handover.get('qty_out_a') or 0)
        out_a1 = float(handover.get('qty_out_a1') or 0)
        out_a2 = float(handover.get('qty_out_a2') or 0)
        in_a = float(handover.get('qty_in_a') or 0)
        in_a1 = float(handover.get('qty_in_a1') or 0)
        in_a2 = float(handover.get('qty_in_a2') or 0)
        if int(source['seq']) == 1:
            try:
                _material_lines, qty_ref = _first_step_material_receipt(
                    source['mo_code'], source['sort_seq']
                )
            except RuntimeError as exc:
                cur.close(); conn.close()
                return jsonify({"code": 1, "msg": str(exc)})
            out_a, out_a1, out_a2 = qty_ref, 0, 0
            cur.execute("""
                UPDATE mo_handover_yx
                SET qty_out=%s,qty_out_a=%s,qty_out_a1=0,qty_out_a2=0
                WHERE id=%s
            """, (qty_ref, qty_ref, handover['id']))
        if out_a + out_a1 + out_a2 <= 0:
            out_a, out_a1, out_a2 = qty_ref, 0, 0
        reserved_a = float(active_receive.get('qty_input_a') or 0) if active_receive else 0
        reserved_a1 = float(active_receive.get('qty_input_a1') or 0) if active_receive else 0
        reserved_a2 = float(active_receive.get('qty_input_a2') or 0) if active_receive else 0
        reserved_total = float(active_receive.get('qty_input') or 0) if active_receive else 0
        if int(source['seq']) > 1:
            validate_quantity_rule_receive(
                _quantity_rule_settings(cur, source['mo_code'], source['sort_seq']),
                qty_before, reserved_total,
                qty_input, qty_ref
            )
        elif qty_before + reserved_total + qty_input > qty_ref + 0.0001:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": f"本次最多可接收{max(0, qty_ref - qty_before - reserved_total):g}件"})
        avail_a = max(0, out_a - in_a - reserved_a)
        avail_a1 = max(0, out_a1 - in_a1 - reserved_a1)
        avail_a2 = max(0, out_a2 - in_a2 - reserved_a2)
        grade_exceeds = int(source['seq']) > 1 and (
            qty_input_a > avail_a or qty_input_a1 > avail_a1 or qty_input_a2 > avail_a2
        )
        if grade_exceeds and not reason:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "接收数量超过剩余可接收数量，请填写超出原因"})
        if _makeup_exceeds_plan(qty_before + reserved_total, qty_input, qty_ref) and not reason:
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
        if active_receive:
            receive_id = active_receive['id']
            merged_reason = "；".join(filter(None, [active_receive.get('reason'), reason])) or None
            merged_photo = ",".join(filter(None, [active_receive.get('photo_url'), photo_url])) or None
            cur.execute("""
                UPDATE mo_receive_work_yx
                SET qty_input=qty_input+%s,qty_input_a=qty_input_a+%s,
                    qty_input_a1=qty_input_a1+%s,qty_input_a2=qty_input_a2+%s,
                    qty_ref=%s,reason=%s,photo_url=%s
                WHERE id=%s AND status='processing'
            """, (qty_input, qty_input_a, qty_input_a1, qty_input_a2,
                  qty_ref, merged_reason, merged_photo, receive_id))
        else:
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
            (receive_id, f"TEMP:RE{receive_id}:{now.strftime('%Y%m%d%H%M%S%f')}:{index}", f"临时工{index}",
             None, None, "临时工")
            for index in range(1, temp_worker_count + 1)
        ])
        cur.executemany("""
            INSERT INTO mo_receive_worker_yx
              (receive_id,ding_user_id,user_name_snapshot,mobile_snapshot,
               dept_id_snapshot,dept_path_snapshot)
            VALUES (%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE user_name_snapshot=VALUES(user_name_snapshot)
        """, worker_rows)
        write_operation_log(
            cur,
            event_type="receive_work_start",
            event_name="追加接收开工",
            occurred_at=now,
            operator_id=user_id,
            operator_name=operator_name,
            worker_details=worker_snapshots(
                worker_map, worker_ids, temp_worker_count
            ),
            mo_code=source["mo_code"],
            sort_seq=source["sort_seq"],
            route_id=source["route_id"],
            seq=source["seq"],
            process_name=source.get("process_name"),
            station_id=source.get("station_id"),
            station_name=source.get("station_name"),
            qty=qty_input,
            qty_a=qty_input_a,
            qty_a1=qty_input_a1,
            qty_a2=qty_input_a2,
            reason=reason,
            photo_urls=[photo_url],
            source_type="receive_work",
            source_id=receive_id,
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({
            "code": 0,
            "msg": "接收已累计",
            "data": {"id": receive_id, "qty_input": reserved_total + qty_input}
        })
    except Exception as e:
        if conn:
            try:
                conn.rollback(); conn.close()
            except Exception:
                pass
        return jsonify({"code": 1, "msg": str(e)})


def _report_receive_batch(cur, execution, receive_id, quantities, *, expected_completed, photo_url,
                          quality_report, operator_id, operator_name, now, reason=None):
    cur.execute("""SELECT * FROM mo_receive_work_yx
        WHERE id=%s AND execution_id=%s FOR UPDATE""", (receive_id, execution['id']))
    receive = cur.fetchone()
    if not receive or receive['status'] != 'processing':
        raise ValueError('接收记录不存在或已经完工')
    cur.execute("""SELECT id,qty_out,qty_out_a,qty_out_a1,qty_out_a2,qty_in
        FROM mo_handover_yx WHERE id=%s FOR UPDATE""", (receive['handover_id'],))
    incoming = cur.fetchone()
    if not incoming:
        raise ValueError('交接记录不存在')

    qty_a, qty_a1, qty_a2, qty_c, qty_done, good_total = quantities
    if any(not isfinite(value) or abs(value - round(value, 4)) > 1e-8 for value in quantities[:4]):
        raise ValueError('完工数量最多保留四位小数')
    qty_before = float(incoming['qty_in'] or 0)
    qty_add = float(receive['qty_input'] or 0)
    execution_done = float(execution['qty_done'] or 0)
    completed, remaining = _receive_completion_progress(receive, qty_before, execution_done)
    if expected_completed is not None:
        expected = float(expected_completed)
        if not isfinite(expected) or abs(expected - completed) > 1e-8:
            raise ValueError('该批次已更新，请刷新后再报工')
    if qty_done > remaining + 1e-8:
        raise ValueError(f'本次完工不能超过剩余{remaining:g}件')
    remaining_after = round(max(0, remaining - qty_done), 4)
    is_final = remaining_after == 0
    qty_after = qty_before + qty_add
    qty_ref = _handover_good_qty(incoming)
    later_step = int(receive['seq']) > 1
    validate_quantity_rule_complete(
        _quantity_rule_settings(cur, receive['mo_code'], receive['sort_seq']),
        execution_done, qty_done, qty_after, qty_ref if later_step else 0, later_step,
    )
    if _makeup_exceeds_plan(qty_before, qty_add, qty_ref) and not receive['reason']:
        raise ValueError('累计接收数量超过上工序完工数量，请填写原因')

    # While the batch is open, readers already count its full input as reserved.
    if is_final:
        cur.execute("""UPDATE mo_handover_yx
            SET qty_in=%s,qty_in_a=qty_in_a+%s,qty_in_a1=qty_in_a1+%s,qty_in_a2=qty_in_a2+%s,
                status='confirmed',confirm_time=COALESCE(confirm_time,%s),
                operator_in=COALESCE(operator_in,%s),receipt_reason=COALESCE(receipt_reason,%s)
            WHERE id=%s""", (qty_after, float(receive.get('qty_input_a') or 0),
                                 float(receive.get('qty_input_a1') or 0), float(receive.get('qty_input_a2') or 0),
                                 now, receive['operator_name'], receive['reason'], receive['handover_id']))
        cur.execute("""INSERT INTO mo_makeup_record_yx
            (execution_id,mo_code,sort_seq,seq,qty_before,qty_add,qty_after,
             plan_qty,reason,operator_id,operator_name)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""", (
            execution['id'], receive['mo_code'], receive['sort_seq'], receive['seq'],
            qty_before, qty_add, qty_after, qty_ref, receive['reason'], receive['operator_id'], receive['operator_name'],
        ))
    cur.execute("""UPDATE mo_receive_work_yx
        SET qty_a=qty_a+%s,qty_a1=qty_a1+%s,qty_a2=qty_a2+%s,qty_c=qty_c+%s,
            complete_photo_url=COALESCE(%s,complete_photo_url),status=%s,end_time=%s
        WHERE id=%s""", (qty_a, qty_a1, qty_a2, qty_c, photo_url,
                          'done' if is_final else 'processing', now if is_final else None, receive_id))
    cur.execute("""UPDATE mo_execution_yx
        SET qty_done=qty_done+%s,qty_a=qty_a+%s,qty_a1=qty_a1+%s,
            qty_a2=qty_a2+%s,qty_c=qty_c+%s,end_time=%s WHERE id=%s""",
                (qty_done, qty_a, qty_a1, qty_a2, qty_c, now, execution['id']))
    cur.execute("""INSERT INTO mo_execution_completion_yx
        (execution_id,qty_a,qty_a1,qty_a2,qty_c,qty_done,reason,photo_url,
         quality_report_photo_urls,operator_id,operator_name,is_final,complete_time)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""", (
        execution['id'], qty_a, qty_a1, qty_a2, qty_c, qty_done, reason or receive['reason'], photo_url,
        quality_report, operator_id or receive['operator_id'] or None,
        operator_name or receive['operator_name'] or None, int(is_final), now,
    ))
    completion_id = cur.lastrowid
    if good_total > 0:
        cur.execute("""UPDATE mo_handover_yx
            SET qty_out=qty_out+%s,qty_out_a=qty_out_a+%s,qty_out_a1=qty_out_a1+%s,qty_out_a2=qty_out_a2+%s
            WHERE mo_code=%s AND sort_seq=%s AND route_id=%s AND from_seq=%s
            ORDER BY id DESC LIMIT 1""", (good_total, qty_a, qty_a1, qty_a2, receive['mo_code'],
                                         receive['sort_seq'], receive['route_id'], receive['seq']))
    return receive, {
        'cumulative_qty': round(execution_done + qty_done, 4), 'completed_qty': round(completed + qty_done, 4),
        'remaining_qty': remaining_after, 'is_partial': not is_final, 'complete_target': remaining,
        'completion_id': completion_id,
    }


@mo_bp.post("/receive-work/complete")
def complete_receive_work():
    body = request.get_json() or {}
    receive_id = body.get("receive_id")
    user_id = (body.get("user_id") or "").strip()
    if not receive_id:
        return jsonify({"code": 1, "msg": "receive_id不能为空"})
    try:
        qty_a, qty_a1, qty_a2, qty_c, qty_done, good_total = _complete_qty_from_body(body)
        completion_photos = _completion_photos(body)
        quality_report_photos = _quality_report_photos(body)
        _validate_completion_photos(
            qty_a, qty_a1, qty_a2, qty_c, completion_photos
        )
        _validate_quality_report_photos(
            qty_a, qty_a1, qty_a2, qty_c, quality_report_photos
        )
    except (ValueError, TypeError) as exc:
        if "照片" in str(exc):
            return jsonify({"code": 1, "msg": str(exc)})
        return jsonify({"code": 1, "msg": "完工数量格式错误"})
    complete_photo_url = ",".join(completion_photos) or None
    quality_report_photo_urls = _quality_report_json(quality_report_photos)
    conn = None
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT execution_id FROM mo_receive_work_yx WHERE id=%s", (receive_id,))
        source = cur.fetchone()
        if not source:
            raise ValueError('接收记录不存在或已经完工')
        cur.execute("""SELECT id,qty_done,station_id,station_name FROM mo_execution_yx
            WHERE id=%s FOR UPDATE""", (source['execution_id'],))
        execution = cur.fetchone()
        if not execution:
            raise ValueError('工序执行记录不存在')
        now = datetime.now(BEIJING_TIMEZONE).replace(tzinfo=None)
        operator_name = _get_operator(cur, user_id) if user_id else None
        receive, result = _report_receive_batch(
            cur, execution, receive_id, (qty_a, qty_a1, qty_a2, qty_c, qty_done, good_total),
            expected_completed=body.get('expected_completed_qty'), photo_url=complete_photo_url,
            quality_report=quality_report_photo_urls, operator_id=user_id, operator_name=operator_name, now=now,
        )
        completion_id = result['completion_id']
        write_operation_log(
            cur,
            event_key=f"completion:{completion_id}",
            event_type="complete",
            event_name="追加接收部分完工" if result['is_partial'] else "追加接收完工",
            occurred_at=now,
            operator_id=user_id or receive['operator_id'],
            operator_name=operator_name or receive['operator_name'],
            mo_code=receive["mo_code"],
            sort_seq=receive["sort_seq"],
            route_id=receive["route_id"],
            seq=receive["seq"],
            process_name=receive.get("process_name"),
            station_id=execution.get("station_id"),
            station_name=execution.get("station_name"),
            qty=qty_done,
            qty_a=qty_a,
            qty_a1=qty_a1,
            qty_a2=qty_a2,
            qty_c=qty_c,
            reason=receive.get("reason"),
            photo_urls=_merge_photo_lists(completion_photos, quality_report_photos),
            source_type="completion",
            source_id=completion_id,
            details={"receive_id": receive_id, "is_final": not result['is_partial']},
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({
            "code": 0,
            "msg": "本批已报工" if result['is_partial'] else "完工成功",
            "data": {
                "exec_id": receive['execution_id'],
                "receive_id": receive_id,
                **result,
            }
        })
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
            SELECT id,mo_code,sort_seq,route_id,seq,process_name,
                   station_id,station_name,
                   qty_done,qty_a,qty_a1,qty_a2,qty_c,status
            FROM mo_execution_yx WHERE id=%s FOR UPDATE
        """, (exec_id,))
        source = cur.fetchone()
        if not source or source['status'] != 'done':
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "只能对已完工记录发起返工"})
        cur.execute("""
            SELECT id,qty_input,qty_a,qty_a1,qty_a2,qty_c,reason,photo_url
            FROM mo_rework_yx
            WHERE source_execution_id=%s AND status='processing'
            ORDER BY id DESC LIMIT 1
            FOR UPDATE
        """, (exec_id,))
        active_rework = cur.fetchone()
        reserved = _rework_progress(active_rework)[1] if active_rework else 0
        if reserved + qty_input > float(source['qty_done'] or 0) + 0.0001:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "本次返工和正在返工数量不能超过累计完工数量"})
        worker_map = _get_worker_map(cur, worker_ids) if worker_ids else {}
        if any(worker_id not in worker_map for worker_id in worker_ids):
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "所选返工人员已离职或不存在"})
        operator_name = _get_operator(cur, user_id)
        now = datetime.now()
        cur.close()
        cur = conn.cursor()
        free_c = max(0, float(source['qty_c'] or 0) - reserved)
        convert_qty = max(0, qty_input - free_c)
        remaining_convert = convert_qty
        take_a = min(float(source['qty_a'] or 0), remaining_convert)
        remaining_convert -= take_a
        take_a1 = min(float(source['qty_a1'] or 0), remaining_convert)
        remaining_convert -= take_a1
        take_a2 = min(float(source['qty_a2'] or 0), remaining_convert)
        remaining_convert -= take_a2
        if remaining_convert > 0.0001:
            conn.rollback(); cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "累计完工分级数量不足，不能发起本次返工"})
        if convert_qty > 0:
            cur.execute("""
                UPDATE mo_execution_yx
                SET qty_a=qty_a-%s,qty_a1=qty_a1-%s,qty_a2=qty_a2-%s,qty_c=qty_c+%s
                WHERE id=%s
            """, (take_a, take_a1, take_a2, convert_qty, exec_id))
            cur.execute("""
                UPDATE mo_handover_yx
                SET qty_out=GREATEST(0,qty_out-%s),
                    qty_out_a=GREATEST(0,qty_out_a-%s),
                    qty_out_a1=GREATEST(0,qty_out_a1-%s),
                    qty_out_a2=GREATEST(0,qty_out_a2-%s)
                WHERE mo_code=%s AND sort_seq=%s AND from_seq=%s
                ORDER BY id DESC LIMIT 1
            """, (convert_qty, take_a, take_a1, take_a2,
                  source['mo_code'], source['sort_seq'], source['seq']))
        if active_rework:
            rework_id = active_rework['id']
            total_input = float(active_rework.get('qty_input') or 0) + qty_input
            merged_reason = "；".join(filter(None, [active_rework.get('reason'), reason]))
            merged_photo = ",".join(filter(None, [active_rework.get('photo_url'), photo_url])) or None
            cur.execute("""
                UPDATE mo_rework_yx
                SET qty_input=qty_input+%s,reason=%s,photo_url=%s
                WHERE id=%s AND status='processing'
            """, (qty_input, merged_reason, merged_photo, rework_id))
        else:
            cur.execute("""
                INSERT INTO mo_rework_yx
                  (source_execution_id,mo_code,sort_seq,route_id,seq,process_name,
                   qty_input,reason,photo_url,operator_id,operator_name,status,start_time)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'processing',%s)
            """, (exec_id, source['mo_code'], source['sort_seq'], source['route_id'],
                  source['seq'], source['process_name'], qty_input, reason,
                  photo_url, user_id or None, operator_name or None, now))
            rework_id = cur.lastrowid
            total_input = qty_input
        worker_rows = [(
            rework_id, worker_id, worker_map[worker_id]['user_name'],
            worker_map[worker_id]['mobile'], worker_map[worker_id]['main_dept_id'],
            worker_map[worker_id]['dept_path']
        ) for worker_id in worker_ids]
        worker_rows.extend([
            (rework_id, f"TEMP:R{rework_id}:{now.strftime('%Y%m%d%H%M%S%f')}:{index}", f"临时工{index}",
             None, None, "临时工")
            for index in range(1, temp_worker_count + 1)
        ])
        cur.executemany("""
            INSERT INTO mo_rework_worker_yx
              (rework_id,ding_user_id,user_name_snapshot,mobile_snapshot,
               dept_id_snapshot,dept_path_snapshot)
            VALUES (%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE user_name_snapshot=VALUES(user_name_snapshot)
        """, worker_rows)
        write_operation_log(
            cur,
            event_type="rework_start",
            event_name="发起返工",
            occurred_at=now,
            operator_id=user_id,
            operator_name=operator_name,
            worker_details=worker_snapshots(
                worker_map, worker_ids, temp_worker_count
            ),
            mo_code=source["mo_code"],
            sort_seq=source["sort_seq"],
            route_id=source["route_id"],
            seq=source["seq"],
            process_name=source.get("process_name"),
            station_id=source.get("station_id"),
            station_name=source.get("station_name"),
            qty=qty_input,
            reason=reason,
            photo_urls=[photo_url],
            source_type="rework",
            source_id=rework_id,
            details={"total_rework_qty": total_input},
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({
            "code": 0,
            "msg": "返工已累计",
            "data": {"id": rework_id, "qty_input": total_input}
        })
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
    user_id = (body.get("user_id") or "").strip()
    try:
        qty_a, qty_a1, qty_a2, qty_c, qty_done, good_total = _complete_qty_from_body(body)
        completion_photos = _completion_photos(body)
        quality_report_photos = _quality_report_photos(body)
        _validate_completion_photos(
            qty_a, qty_a1, qty_a2, qty_c, completion_photos
        )
        _validate_quality_report_photos(
            qty_a, qty_a1, qty_a2, qty_c, quality_report_photos
        )
    except (ValueError, TypeError) as exc:
        if "照片" in str(exc):
            return jsonify({"code": 1, "msg": str(exc)})
        return jsonify({"code": 1, "msg": "返工完工数量格式错误"})
    complete_photo_url = ",".join(completion_photos) or None
    quality_report_photo_urls = _quality_report_json(quality_report_photos)
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
        completed_before, remaining_before = _rework_progress(rework)
        if qty_done > remaining_before + 0.0001:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": f"本次返工完工不能超过剩余{remaining_before:g}件"})
        now = datetime.now()
        operator_name = _get_operator(cur, user_id)
        cur.execute("""
            SELECT station_id,station_name
            FROM mo_execution_yx WHERE id=%s
        """, (rework["source_execution_id"],))
        source_execution = cur.fetchone() or {}
        completed_after = completed_before + qty_done
        remaining_after = max(0, float(rework['qty_input'] or 0) - completed_after)
        is_final = remaining_after <= 0.0001
        all_remarks = _append_record_text(rework.get('complete_remark'), remark, "；")
        all_photos = _append_record_text(rework.get('complete_photo_url'), complete_photo_url)
        cur.close()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO mo_rework_completion_yx
              (rework_id,qty_a,qty_a1,qty_a2,qty_c,qty_done,remark,photo_url,
               quality_report_photo_urls,operator_id,operator_name,is_final,complete_time)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (rework_id, qty_a, qty_a1, qty_a2, qty_c, qty_done,
              remark, complete_photo_url, quality_report_photo_urls,
              user_id or None, operator_name or None,
              1 if is_final else 0, now))
        completion_id = cur.lastrowid
        cur.execute("""
            UPDATE mo_rework_yx
            SET qty_a=qty_a+%s,qty_a1=qty_a1+%s,qty_a2=qty_a2+%s,qty_c=qty_c+%s,
                complete_remark=%s,complete_photo_url=%s,status=%s,end_time=%s
            WHERE id=%s AND status='processing'
        """, (qty_a, qty_a1, qty_a2, qty_c, all_remarks, all_photos,
              'done' if is_final else 'processing', now if is_final else None, rework_id))
        if cur.rowcount != 1:
            raise RuntimeError("返工任务状态已变化")
        if good_total > 0:
            cur.execute("""
                UPDATE mo_execution_yx
                SET qty_a=qty_a+%s,qty_a1=qty_a1+%s,qty_a2=qty_a2+%s,
                    qty_c=qty_c-%s,end_time=%s
                WHERE id=%s AND qty_c>=%s
            """, (qty_a, qty_a1, qty_a2, good_total, now,
                  rework['source_execution_id'], good_total))
            if cur.rowcount == 0:
                conn.rollback(); cur.close(); conn.close()
                return jsonify({"code": 1, "msg": "原记录C级数量不足，返工完工失败"})
            cur.execute("""
                UPDATE mo_handover_yx
                SET qty_out=qty_out+%s, qty_out_a=qty_out_a+%s,
                    qty_out_a1=qty_out_a1+%s, qty_out_a2=qty_out_a2+%s
                WHERE mo_code=%s AND sort_seq=%s AND from_seq=%s
                ORDER BY id DESC LIMIT 1
            """, (good_total, qty_a, qty_a1, qty_a2,
                  rework['mo_code'], rework['sort_seq'], rework['seq']))
        write_operation_log(
            cur,
            event_key=f"rework_completion:{completion_id}",
            event_type="rework_complete",
            event_name="返工完工",
            occurred_at=now,
            operator_id=user_id,
            operator_name=operator_name,
            mo_code=rework["mo_code"],
            sort_seq=rework["sort_seq"],
            route_id=rework["route_id"],
            seq=rework["seq"],
            process_name=rework.get("process_name"),
            station_id=source_execution.get("station_id"),
            station_name=source_execution.get("station_name"),
            qty=qty_done,
            qty_a=qty_a,
            qty_a1=qty_a1,
            qty_a2=qty_a2,
            qty_c=qty_c,
            reason=remark,
            photo_urls=_merge_photo_lists(completion_photos, quality_report_photos),
            source_type="rework_completion",
            source_id=completion_id,
            details={
                "rework_id": rework_id,
                "is_final": is_final,
                "remaining_qty": remaining_after,
            },
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({
            "code": 0,
            "msg": "返工已全部完工" if is_final else "本批返工完工成功",
            "data": {
                "exec_id": rework['source_execution_id'],
                "rework_id": rework_id,
                "completion_id": completion_id,
                "source_type": "rework_completion",
                "is_final": is_final,
                "completed_qty": completed_after,
                "remaining_qty": remaining_after,
            }
        })
    except Exception as e:
        if conn:
            try:
                conn.rollback(); conn.close()
            except Exception:
                pass
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/complete-combined")
def complete_combined():
    body = request.get_json() or {}
    exec_id = body.get("exec_id")
    normal_type = (body.get("normal_type") or "").strip()
    normal_body = body.get("normal") or {}
    rework_body = body.get("rework") or {}
    rework_id = rework_body.get("rework_id")
    user_id = (body.get("user_id") or "").strip()
    if not exec_id or normal_type not in ("completion", "receive") or not rework_id:
        return jsonify({"code": 1, "msg": "组合完工参数不完整"})
    try:
        normal_a, normal_a1, normal_a2, normal_c, normal_total, normal_good = _complete_qty_from_body(normal_body)
        rework_a, rework_a1, rework_a2, rework_c, rework_total, rework_good = _complete_qty_from_body(rework_body)
        normal_completion_photos = _completion_photos(normal_body)
        rework_completion_photos = _completion_photos(rework_body)
        if body.get("quality_report_photo_urls") is not None:
            quality_report_photos = _quality_report_photos(body)
        else:
            quality_report_photos = []
            for legacy_value in (
                normal_body.get("complete_photo_url"),
                rework_body.get("complete_photo_url"),
            ):
                for photo in _photo_url_list(legacy_value):
                    if photo not in quality_report_photos:
                        quality_report_photos.append(photo)
            quality_report_photos = quality_report_photos[:QUALITY_REPORT_MAX_PHOTOS]
        normal_pure_a = _is_pure_a_completion(
            normal_a, normal_a1, normal_a2, normal_c
        )
        rework_pure_a = _is_pure_a_completion(
            rework_a, rework_a1, rework_a2, rework_c
        )
        _validate_completion_photos(
            normal_a, normal_a1, normal_a2, normal_c,
            normal_completion_photos
        )
        _validate_completion_photos(
            rework_a, rework_a1, rework_a2, rework_c,
            rework_completion_photos
        )
        if (not normal_pure_a or not rework_pure_a) and not quality_report_photos:
            raise ValueError("存在A1、A2或C级品时必须拍摄质量报告单照片")
    except (ValueError, TypeError) as exc:
        if "照片" in str(exc):
            return jsonify({"code": 1, "msg": str(exc)})
        return jsonify({"code": 1, "msg": "组合完工数量格式错误"})
    quality_report_json = _quality_report_json(quality_report_photos)
    normal_photo = ",".join(normal_completion_photos) or None
    normal_quality_report = None if normal_pure_a else quality_report_json
    rework_photo = ",".join(rework_completion_photos) or None
    rework_quality_report = None if rework_pure_a else quality_report_json

    conn = None
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT id,mo_code,sort_seq,route_id,seq,process_name,station_id,
                   station_name,status,qty_done,qty_a,qty_a1,qty_a2,qty_c,
                   complete_reason,complete_photo_url
            FROM mo_execution_yx WHERE id=%s AND status='done' FOR UPDATE
        """, (exec_id,))
        execution = cur.fetchone()
        if not execution:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "完工记录不存在或状态不正确"})
        cur.execute("SELECT * FROM mo_rework_yx WHERE id=%s AND source_execution_id=%s FOR UPDATE", (rework_id, exec_id))
        rework = cur.fetchone()
        if not rework or rework['status'] != 'processing':
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "返工任务不存在或已经完工"})
        rework_completed_before, rework_remaining_before = _rework_progress(rework)
        if rework_total > rework_remaining_before + 0.0001:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": f"本次返工完工不能超过剩余{rework_remaining_before:g}件"})

        now = datetime.now(BEIJING_TIMEZONE).replace(tzinfo=None)
        operator_name = _get_operator(cur, user_id)
        rework_completed_after = rework_completed_before + rework_total
        rework_remaining_after = max(
            0, float(rework['qty_input'] or 0) - rework_completed_after
        )
        rework_is_final = rework_remaining_after <= 0.0001
        rework_remark = (rework_body.get("remark") or "").strip() or None
        rework_all_remarks = _append_record_text(
            rework.get('complete_remark'), rework_remark, "；"
        )
        rework_all_photos = _append_record_text(
            rework.get('complete_photo_url'), rework_photo
        )
        labels = []
        normal_result = {}
        normal_log_reason = (
            normal_body.get("complete_reason") or normal_body.get("reason") or ""
        ).strip() or None

        if normal_type == "completion":
            cur.execute("""
                SELECT qty_in,qty_out,qty_out_a,qty_out_a1,qty_out_a2 FROM mo_handover_yx
                WHERE mo_code=%s AND sort_seq=%s AND route_id=%s AND to_seq=%s
                  AND status='confirmed'
                ORDER BY id DESC LIMIT 1 FOR UPDATE
            """, (execution['mo_code'], execution['sort_seq'], execution['route_id'], execution['seq']))
            incoming = cur.fetchone()
            target_qty = float(incoming['qty_in'] or 0) if incoming else 0
            if target_qty <= 0 and int(execution['seq']) == 1:
                target_qty = _workorder_plan_qty(execution['mo_code'], execution['sort_seq'])
            if target_qty <= 0:
                cur.close(); conn.close()
                return jsonify({"code": 1, "msg": "无法确定正常工序应完工数量"})
            qty_before = float(execution['qty_done'] or 0)
            cumulative_qty = qty_before + normal_total
            normal_reason = (normal_body.get("complete_reason") or "").strip() or None
            validate_quantity_rule_complete(
                _quantity_rule_settings(cur, execution['mo_code'], execution['sort_seq']),
                qty_before, normal_total,
                float(incoming['qty_in'] or 0) if incoming else 0,
                _handover_good_qty(incoming) if incoming and int(execution['seq']) > 1 else 0,
                int(execution['seq']) > 1,
            )
            if cumulative_qty > target_qty + 0.0001 and not normal_reason:
                cur.close(); conn.close()
                return jsonify({"code": 1, "msg": "正常工序累计完工超过接收数量，请填写说明"})
            cumulative_a = float(execution['qty_a'] or 0) + normal_a
            cumulative_a1 = float(execution['qty_a1'] or 0) + normal_a1
            cumulative_a2 = float(execution['qty_a2'] or 0) + normal_a2
            cumulative_c = float(execution['qty_c'] or 0) + normal_c
            is_partial = _completion_is_partial(qty_before, normal_total, target_qty)
            all_photos = _append_record_text(execution.get('complete_photo_url'), normal_photo)
            all_reasons = _append_record_text(execution.get('complete_reason'), normal_reason, "；")
            cur.close(); cur = conn.cursor()
            cur.execute("""
                INSERT INTO mo_execution_completion_yx
                  (execution_id,qty_a,qty_a1,qty_a2,qty_c,qty_done,reason,photo_url,
                   quality_report_photo_urls,operator_id,operator_name,is_final,complete_time)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (exec_id, normal_a, normal_a1, normal_a2, normal_c, normal_total,
                  normal_reason, normal_photo, normal_quality_report,
                  user_id or None, operator_name or None,
                  0 if is_partial else 1, now))
            completion_id = cur.lastrowid
            cur.execute("""
                UPDATE mo_execution_yx
                SET qty_done=%s,qty_a=%s,qty_a1=%s,qty_a2=%s,qty_c=%s,
                    complete_reason=%s,complete_photo_url=%s,
                    complete_operator_id=%s,complete_operator_name=%s,end_time=%s
                WHERE id=%s
            """, (cumulative_qty, cumulative_a, cumulative_a1, cumulative_a2, cumulative_c,
                  all_reasons, all_photos, user_id or None, operator_name or None, now, exec_id))
            cur.execute("""
                UPDATE mo_handover_yx
                SET qty_out=%s,qty_out_a=%s,qty_out_a1=%s,qty_out_a2=%s,operator_out=%s
                WHERE mo_code=%s AND sort_seq=%s AND route_id=%s AND from_seq=%s
                ORDER BY id DESC LIMIT 1
            """, (cumulative_a + cumulative_a1 + cumulative_a2,
                  cumulative_a, cumulative_a1, cumulative_a2, operator_name,
                  execution['mo_code'], execution['sort_seq'], execution['route_id'], execution['seq']))
            labels.append({"source_type": "completion", "source_id": completion_id})
            normal_result = {
                "is_partial": is_partial,
                "cumulative_qty": cumulative_qty,
                "remaining_qty": max(0, target_qty - cumulative_qty)
            }
        else:
            receive_id = normal_body.get("receive_id")
            _, normal_result = _report_receive_batch(
                cur, execution, receive_id, (normal_a, normal_a1, normal_a2, normal_c, normal_total, normal_good),
                expected_completed=normal_body.get('expected_completed_qty'), photo_url=normal_photo,
                quality_report=normal_quality_report, operator_id=user_id, operator_name=operator_name,
                now=now, reason=normal_log_reason,
            )
            completion_id = normal_result['completion_id']
            labels.append({"source_type": "completion", "source_id": completion_id})

        cur.execute("""
            INSERT INTO mo_rework_completion_yx
              (rework_id,qty_a,qty_a1,qty_a2,qty_c,qty_done,remark,photo_url,
               quality_report_photo_urls,operator_id,operator_name,is_final,complete_time)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (rework_id, rework_a, rework_a1, rework_a2, rework_c, rework_total,
              rework_remark, rework_photo, rework_quality_report,
              user_id or None, operator_name or None,
              1 if rework_is_final else 0, now))
        rework_completion_id = cur.lastrowid
        cur.execute("""
            UPDATE mo_rework_yx
            SET qty_a=qty_a+%s,qty_a1=qty_a1+%s,qty_a2=qty_a2+%s,qty_c=qty_c+%s,
                complete_remark=%s,complete_photo_url=%s,status=%s,end_time=%s
            WHERE id=%s AND status='processing'
        """, (rework_a, rework_a1, rework_a2, rework_c,
              rework_all_remarks, rework_all_photos,
              'done' if rework_is_final else 'processing',
              now if rework_is_final else None, rework_id))
        if cur.rowcount != 1:
            raise RuntimeError("返工任务状态已变化")
        if rework_good > 0:
            cur.execute("""
                UPDATE mo_execution_yx
                SET qty_a=qty_a+%s,qty_a1=qty_a1+%s,qty_a2=qty_a2+%s,
                    qty_c=qty_c-%s,end_time=%s
                WHERE id=%s AND qty_c>=%s
            """, (rework_a, rework_a1, rework_a2, rework_good, now, exec_id, rework_good))
            if cur.rowcount == 0:
                raise RuntimeError("原记录C级数量不足，组合完工失败")
            cur.execute("""
                UPDATE mo_handover_yx
                SET qty_out=qty_out+%s,qty_out_a=qty_out_a+%s,
                    qty_out_a1=qty_out_a1+%s,qty_out_a2=qty_out_a2+%s
                WHERE mo_code=%s AND sort_seq=%s AND from_seq=%s
                ORDER BY id DESC LIMIT 1
            """, (rework_good, rework_a, rework_a1, rework_a2,
                  rework['mo_code'], rework['sort_seq'], rework['seq']))
        labels.append({
            "source_type": "rework_completion",
            "source_id": rework_completion_id,
        })
        write_operation_log(
            cur,
            event_key=f"completion:{completion_id}",
            event_type="complete",
            event_name=(
                "组合完工（追加接收）"
                if normal_type == "receive"
                else "组合完工（正常工序）"
            ),
            occurred_at=now,
            operator_id=user_id,
            operator_name=operator_name,
            mo_code=execution["mo_code"],
            sort_seq=execution["sort_seq"],
            route_id=execution["route_id"],
            seq=execution["seq"],
            process_name=execution.get("process_name"),
            station_id=execution.get("station_id"),
            station_name=execution.get("station_name"),
            qty=normal_total,
            qty_a=normal_a,
            qty_a1=normal_a1,
            qty_a2=normal_a2,
            qty_c=normal_c,
            reason=normal_log_reason,
            photo_urls=_merge_photo_lists(
                normal_completion_photos,
                quality_report_photos if not normal_pure_a else [],
            ),
            source_type="completion",
            source_id=completion_id,
            details={"combined": True, "normal_type": normal_type},
        )
        write_operation_log(
            cur,
            event_key=f"rework_completion:{rework_completion_id}",
            event_type="rework_complete",
            event_name="组合完工（返工）",
            occurred_at=now,
            operator_id=user_id,
            operator_name=operator_name,
            mo_code=rework["mo_code"],
            sort_seq=rework["sort_seq"],
            route_id=rework["route_id"],
            seq=rework["seq"],
            process_name=rework.get("process_name"),
            station_id=execution.get("station_id"),
            station_name=execution.get("station_name"),
            qty=rework_total,
            qty_a=rework_a,
            qty_a1=rework_a1,
            qty_a2=rework_a2,
            qty_c=rework_c,
            reason=rework_remark,
            photo_urls=_merge_photo_lists(
                rework_completion_photos,
                quality_report_photos if not rework_pure_a else [],
            ),
            source_type="rework_completion",
            source_id=rework_completion_id,
            details={
                "combined": True,
                "rework_id": rework_id,
                "is_final": rework_is_final,
            },
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({
            "code": 0,
            "msg": "正常工序和本批返工已同时完工",
            "data": {
                "exec_id": exec_id,
                "labels": labels,
                "rework_is_final": rework_is_final,
                "rework_completed_qty": rework_completed_after,
                "rework_remaining_qty": rework_remaining_after,
                **normal_result,
            }
        })
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
