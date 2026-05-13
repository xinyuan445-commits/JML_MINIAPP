from datetime import datetime, date
from flask import Blueprint, jsonify, request
from models.db2 import get_db2


def _ser(row):
    if row is None:
        return None
    return {k: (v.strftime('%Y-%m-%d %H:%M:%S') if isinstance(v, (datetime, date)) else v)
            for k, v in row.items()}


mo_bp = Blueprint("mo", __name__)


def _find_route(cur, mo_code, sort_seq, dept_code=''):
    """显式绑定 > 已开工状态记录 > 部门默认，返回 route_id 或 None"""
    cur.execute("SELECT route_id FROM mo_wo_route_yx WHERE mo_code=%s AND sort_seq=%s", (mo_code, sort_seq))
    b = cur.fetchone()
    if b:
        return b['route_id']
    cur.execute("SELECT route_id FROM mo_wo_state_yx WHERE mo_code=%s AND sort_seq=%s", (mo_code, sort_seq))
    s = cur.fetchone()
    if s:
        return s['route_id']
    if dept_code:
        cur.execute(
            "SELECT id FROM mo_route_yx WHERE dept_code=%s AND is_default=1 AND is_active=1 LIMIT 1",
            (dept_code,)
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
    dept_code = request.args.get("dept_code", "").strip()
    if not mo_code or not sort_seq:
        return jsonify({"code": 1, "msg": "参数不完整"})
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        route_id = _find_route(cur, mo_code, sort_seq, dept_code)
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
        if current_status == 'processing':
            cur.execute("""
                SELECT station_name FROM mo_execution_yx
                WHERE mo_code=%s AND sort_seq=%s AND route_id=%s AND seq=%s AND status='processing'
                LIMIT 1
            """, (mo_code, sort_seq, route_id, current_seq))
            ex = cur.fetchone()
            if ex:
                active_station = ex['station_name'] or ''

        # 接收状态：当前步骤是否有待确认的交接单
        needs_receipt = False
        handover_info = None
        if current_status == 'pending' and current_seq > 1:
            cur.execute("""
                SELECT h.id, h.qty_out, h.status, e.complete_reason,
                       p.process_name AS prev_process_name
                FROM mo_handover_yx h
                LEFT JOIN mo_execution_yx e
                       ON e.mo_code=h.mo_code AND e.sort_seq=h.sort_seq AND e.seq=h.from_seq
                LEFT JOIN mo_route_step_yx rs ON rs.route_id=%s AND rs.seq=h.from_seq
                LEFT JOIN mo_process_yx p ON p.id=rs.process_id
                WHERE h.mo_code=%s AND h.sort_seq=%s AND h.to_seq=%s
                LIMIT 1
            """, (route_id, mo_code, sort_seq, current_seq))
            handover = cur.fetchone()
            if handover and handover['status'] == 'pending':
                needs_receipt = True
                handover_info = {
                    "id":               handover['id'],
                    "qty_out":          float(handover['qty_out']),
                    "complete_reason":  handover['complete_reason'],
                    "prev_process_name": handover['prev_process_name'] or ''
                }

        # 最近一条已完工的执行记录（供补工使用）
        cur.execute("""
            SELECT id, seq, qty_done, complete_reason
            FROM mo_execution_yx
            WHERE mo_code=%s AND sort_seq=%s AND status='done'
            ORDER BY seq DESC, id DESC LIMIT 1
        """, (mo_code, sort_seq))
        ex_done = cur.fetchone()
        latest_exec = None
        if ex_done:
            latest_exec = {
                "id":              ex_done['id'],
                "seq":             ex_done['seq'],
                "qty_done":        float(ex_done['qty_done']),
                "complete_reason": ex_done['complete_reason']
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
            "needs_receipt":  needs_receipt,
            "handover":       handover_info
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
    dept_code = body.get("dept_code", "").strip()
    if not mo_code or sort_seq is None:
        return jsonify({"code": 1, "msg": "参数不完整"})
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        operator_name = _get_operator(cur, user_id)
        route_id = _find_route(cur, mo_code, sort_seq, dept_code)
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

        now = datetime.now()
        cur.close()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO mo_execution_yx
              (mo_code, sort_seq, route_id, seq, process_id, station_id,
               process_name, station_name, operator_id, operator_name, start_time, status)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'processing')
        """, (mo_code, sort_seq, route_id, current_seq,
              step['process_id'], station_id or None,
              step['process_name'], station_name or None,
              user_id or None, operator_name or None, now))

        cur.execute("""
            INSERT INTO mo_wo_state_yx (mo_code, sort_seq, route_id, current_seq, status)
            VALUES (%s,%s,%s,%s,'processing')
            ON DUPLICATE KEY UPDATE status='processing', route_id=%s, current_seq=%s
        """, (mo_code, sort_seq, route_id, current_seq, route_id, current_seq))

        conn.commit()
        cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "开工成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


# ----------------------------------------------------------------
# 完工
# ----------------------------------------------------------------
@mo_bp.post("/complete")
def complete_work():
    body            = request.get_json() or {}
    mo_code         = body.get("mo_code", "").strip()
    sort_seq        = body.get("sort_seq")
    qty_done        = body.get("qty_done")
    complete_reason = (body.get("complete_reason") or "").strip() or None
    user_id         = body.get("user_id", "").strip()
    if not mo_code or sort_seq is None or qty_done is None:
        return jsonify({"code": 1, "msg": "参数不完整"})
    try:
        qty_done = float(qty_done)
        if qty_done <= 0:
            return jsonify({"code": 1, "msg": "完工数量必须大于0"})
    except (ValueError, TypeError):
        return jsonify({"code": 1, "msg": "数量格式错误"})
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
            SET status='done', qty_done=%s, complete_reason=%s, end_time=%s
            WHERE id=%s
        """, (qty_done, complete_reason, now, exec_rec['id']))

        if next_step:
            next_seq = next_step['seq']
            cur.execute("""
                UPDATE mo_wo_state_yx SET status='pending', current_seq=%s
                WHERE mo_code=%s AND sort_seq=%s
            """, (next_seq, mo_code, sort_seq))
            # 创建交接单（幂等：有唯一键则更新）
            cur.execute("""
                INSERT INTO mo_handover_yx
                  (mo_code, sort_seq, route_id, from_seq, to_seq, qty_out, operator_out, status)
                VALUES (%s,%s,%s,%s,%s,%s,%s,'pending')
                ON DUPLICATE KEY UPDATE
                  qty_out=%s, operator_out=%s, status='pending', confirm_time=NULL, receipt_reason=NULL
            """, (mo_code, sort_seq, route_id, current_seq, next_seq,
                  qty_done, operator_name, qty_done, operator_name))
        else:
            cur.execute("""
                UPDATE mo_wo_state_yx SET status='done'
                WHERE mo_code=%s AND sort_seq=%s
            """, (mo_code, sort_seq))

        conn.commit()
        cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "完工成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


# ----------------------------------------------------------------
# 补工
# ----------------------------------------------------------------
@mo_bp.post("/makeup")
def makeup_work():
    body     = request.get_json() or {}
    mo_code  = body.get("mo_code", "").strip()
    sort_seq = body.get("sort_seq")
    exec_id  = body.get("exec_id")
    qty_add  = body.get("qty_add")
    if not mo_code or sort_seq is None or not exec_id or qty_add is None:
        return jsonify({"code": 1, "msg": "参数不完整"})
    try:
        qty_add = float(qty_add)
        if qty_add <= 0:
            return jsonify({"code": 1, "msg": "补工数量必须大于0"})
    except (ValueError, TypeError):
        return jsonify({"code": 1, "msg": "数量格式错误"})
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        cur.execute(
            "SELECT id, seq FROM mo_execution_yx WHERE id=%s AND status='done'",
            (exec_id,)
        )
        exec_rec = cur.fetchone()
        if not exec_rec:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "执行记录不存在或状态不正确"})

        now = datetime.now()
        cur.close()
        cur = conn.cursor()

        cur.execute("""
            UPDATE mo_execution_yx
            SET qty_done = qty_done + %s, end_time = %s
            WHERE id = %s
        """, (qty_add, now, exec_id))

        # 同步更新对应交接单的 qty_out（如果还未确认接收）
        cur.execute("""
            UPDATE mo_handover_yx
            SET qty_out = qty_out + %s
            WHERE mo_code=%s AND sort_seq=%s AND from_seq=%s AND status='pending'
        """, (qty_add, mo_code, sort_seq, exec_rec['seq']))

        conn.commit()
        cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "补工成功"})
    except Exception as e:
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
    qty_in         = body.get("qty_in")
    receipt_reason = (body.get("receipt_reason") or "").strip() or None
    user_id        = body.get("user_id", "").strip()
    if not mo_code or sort_seq is None or not handover_id or qty_in is None:
        return jsonify({"code": 1, "msg": "参数不完整"})
    try:
        qty_in = float(qty_in)
        if qty_in <= 0:
            return jsonify({"code": 1, "msg": "接收数量必须大于0"})
    except (ValueError, TypeError):
        return jsonify({"code": 1, "msg": "数量格式错误"})
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        operator_name = _get_operator(cur, user_id)
        now = datetime.now()

        cur.close()
        cur = conn.cursor()
        cur.execute("""
            UPDATE mo_handover_yx
            SET qty_in=%s, receipt_reason=%s, operator_in=%s,
                status='confirmed', confirm_time=%s
            WHERE id=%s AND mo_code=%s AND sort_seq=%s AND status='pending'
        """, (qty_in, receipt_reason, operator_name, now,
              handover_id, mo_code, sort_seq))

        if cur.rowcount == 0:
            conn.rollback()
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "交接单不存在或已接收"})

        conn.commit()
        cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "接收成功"})
    except Exception as e:
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
            dept_code = str(item.get("dept_code", "")).strip()
            if not mo_code or sort_seq is None:
                continue
            try:
                # buffered=True：execute 后立即把所有行缓冲到内存，
                # 避免 fetchone() 提前 return 后 cursor 还有未读结果
                # 导致下一次 execute 抛 InternalError: Unread result found
                cur = conn.cursor(dictionary=True, buffered=True)
                route_id = _find_route(cur, mo_code, sort_seq, dept_code)
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
@mo_bp.get("/route/list")
def route_list():
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM mo_route_yx ORDER BY id ASC")
        rows = cur.fetchall()
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
            SELECT s.seq, s.process_id, p.process_name, s.station_id,
                   COALESCE(w.station_name,'') AS station_name
            FROM mo_route_step_yx s
            LEFT JOIN mo_process_yx   p ON p.id = s.process_id
            LEFT JOIN mo_workstation_yx w ON w.id = s.station_id
            WHERE s.route_id=%s ORDER BY s.seq ASC
        """, (route_id,))
        steps = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": {**_ser(route), "steps": [_ser(s) for s in steps]}})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/route/add")
def route_add():
    d = request.json or {}
    code = (d.get("route_code") or "").strip()
    name = (d.get("route_name") or "").strip()
    if not code or not name:
        return jsonify({"code": 1, "msg": "编码和名称不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO mo_route_yx (route_code,route_name,dept_code,description,is_active,is_default,create_time,update_time) VALUES (%s,%s,%s,%s,1,0,NOW(),NOW())",
            (code, name, d.get("dept_code",""), d.get("description",""))
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "添加成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/route/update")
def route_update():
    d = request.json or {}
    if not d.get("id"):
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        cur.execute(
            "UPDATE mo_route_yx SET route_name=%s,dept_code=%s,description=%s,update_time=NOW() WHERE id=%s",
            (d.get("route_name",""), d.get("dept_code",""), d.get("description",""), d["id"])
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "更新成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@mo_bp.post("/route/toggle")
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
def route_set_processes():
    d = request.json or {}
    route_id = d.get("route_id")
    steps = d.get("steps", [])
    if not route_id:
        return jsonify({"code": 1, "msg": "route_id不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor()
        cur.execute("DELETE FROM mo_route_step_yx WHERE route_id=%s", (route_id,))
        for s in steps:
            cur.execute(
                "INSERT INTO mo_route_step_yx (route_id,seq,process_id,station_id) VALUES (%s,%s,%s,%s)",
                (route_id, s["seq"], s["process_id"], s.get("station_id") or None)
            )
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "保存成功"})
    except Exception as e:
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
