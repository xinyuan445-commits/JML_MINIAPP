"""
webapi — 本地 API 服务，专供 jml_admin 网页管理后台使用
端口: 5001
启动: python app.py
"""
import os
from datetime import datetime, date

import requests as http
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector
from mysql.connector import pooling

load_dotenv()

app = Flask(__name__)
CORS(app)

# ----------------------------------------------------------------
# 数据库连接（连接到 wecom-db，与 pthonapi 相同的库）
# ----------------------------------------------------------------
_pool = mysql.connector.pooling.MySQLConnectionPool(
    pool_name="webapi_pool",
    pool_size=5,
    pool_reset_session=True,
    host=os.getenv("DB2_HOST"),
    user=os.getenv("DB2_USER"),
    password=os.getenv("DB2_PASSWORD"),
    database=os.getenv("DB2_NAME"),
    charset="utf8mb4",
)

MOAPI = os.getenv("MOAPI_URL", "https://api.jinmilong.cn/api/mo")
MOAPI_TOKEN = os.getenv("MOAPI_TOKEN", "123")


def db():
    return _pool.get_connection()


def _ser(row):
    if row is None:
        return None
    return {k: (v.strftime('%Y-%m-%d %H:%M:%S') if isinstance(v, (datetime, date)) else v)
            for k, v in row.items()}


# ================================================================
# 工单列表（代理到 moapi，避免前端跨域）
# ================================================================
@app.get("/api/mo/departments")
def departments():
    try:
        r = http.get(f"{MOAPI}/departments", timeout=10)
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@app.get("/api/mo/workorder/list")
def workorder_list():
    try:
        token = request.args.get("token", MOAPI_TOKEN)
        r = http.get(f"{MOAPI}/workorder/list", params={"token": token}, timeout=10)
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


# ================================================================
# 工序管理
# ================================================================
@app.get("/api/mo/process/list")
def process_list():
    keyword = request.args.get("keyword", "").strip()
    try:
        conn = db()
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


@app.post("/api/mo/process/add")
def process_add():
    d = request.get_json() or {}
    code = (d.get("process_code") or "").strip()
    name = (d.get("process_name") or "").strip()
    if not code or not name:
        return jsonify({"code": 1, "msg": "工序编码和名称不能为空"})
    try:
        conn = db()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO mo_process_yx (process_code, process_name, description, sort) VALUES (%s,%s,%s,%s)",
            (code, name, d.get("description", "") or None, int(d.get("sort", 0) or 0))
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "新增成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@app.post("/api/mo/process/update")
def process_update():
    d = request.get_json() or {}
    if not d.get("id"):
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = db()
        cur = conn.cursor()
        cur.execute(
            "UPDATE mo_process_yx SET process_name=%s, description=%s, sort=%s WHERE id=%s",
            (d.get("process_name", ""), d.get("description", "") or None,
             int(d.get("sort", 0) or 0), d["id"])
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "更新成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@app.post("/api/mo/process/toggle")
def process_toggle():
    d = request.get_json() or {}
    if not d.get("id"):
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = db()
        cur = conn.cursor()
        cur.execute("UPDATE mo_process_yx SET is_active=1-is_active WHERE id=%s", (d["id"],))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "操作成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


# ================================================================
# 工站管理
# ================================================================
@app.get("/api/mo/workstation/list")
def workstation_list():
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM mo_workstation_yx ORDER BY id ASC")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": [_ser(r) for r in rows]})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@app.post("/api/mo/workstation/add")
def workstation_add():
    d = request.get_json() or {}
    code = (d.get("station_code") or "").strip()
    name = (d.get("station_name") or "").strip()
    if not code or not name:
        return jsonify({"code": 1, "msg": "编码和名称不能为空"})
    try:
        conn = db()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO mo_workstation_yx (station_code,station_name,description,is_active,create_time,update_time) VALUES (%s,%s,%s,1,NOW(),NOW())",
            (code, name, d.get("description", ""))
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "添加成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@app.post("/api/mo/workstation/update")
def workstation_update():
    d = request.get_json() or {}
    if not d.get("id"):
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = db()
        cur = conn.cursor()
        cur.execute(
            "UPDATE mo_workstation_yx SET station_name=%s,description=%s,update_time=NOW() WHERE id=%s",
            (d.get("station_name", ""), d.get("description", ""), d["id"])
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "更新成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@app.post("/api/mo/workstation/toggle")
def workstation_toggle():
    d = request.get_json() or {}
    if not d.get("id"):
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = db()
        cur = conn.cursor()
        cur.execute("UPDATE mo_workstation_yx SET is_active=%s,update_time=NOW() WHERE id=%s",
                    (d.get("is_active", 0), d["id"]))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "操作成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


# ================================================================
# 工艺路线
# ================================================================
@app.get("/api/mo/route/list")
def route_list():
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM mo_route_yx ORDER BY id ASC")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": [_ser(r) for r in rows]})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@app.get("/api/mo/route/detail")
def route_detail():
    route_id = request.args.get("id", type=int)
    if not route_id:
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM mo_route_yx WHERE id=%s", (route_id,))
        route = cur.fetchone()
        if not route:
            return jsonify({"code": 1, "msg": "路线不存在"})
        # station_id 存在 mo_step_station_yx 关联表，取每步的第一个工站
        cur.execute("""
            SELECT s.seq, s.process_id, p.process_name,
                   MIN(ss.station_id) AS station_id,
                   COALESCE(MIN(w.station_name), '') AS station_name
            FROM mo_route_step_yx s
            LEFT JOIN mo_process_yx      p  ON p.id  = s.process_id
            LEFT JOIN mo_step_station_yx ss ON ss.step_id = s.id
            LEFT JOIN mo_workstation_yx  w  ON w.id  = ss.station_id
            WHERE s.route_id=%s
            GROUP BY s.seq, s.process_id, p.process_name
            ORDER BY s.seq ASC
        """, (route_id,))
        steps = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": {**_ser(route), "steps": [_ser(s) for s in steps]}})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@app.get("/api/mo/route/next-code")
def route_next_code():
    dept_code = request.args.get("dept_code", "").strip()
    if not dept_code:
        return jsonify({"code": 1, "msg": "dept_code不能为空"})
    try:
        conn = db()
        cur = conn.cursor()
        cur.execute("""
            SELECT MAX(CAST(SUBSTRING_INDEX(route_code, '-', -1) AS UNSIGNED))
            FROM mo_route_yx
            WHERE route_code REGEXP %s
        """, (f'^RT-{dept_code}-[0-9]+$',))
        row = cur.fetchone()
        cur.close(); conn.close()
        max_seq = row[0] or 0
        return jsonify({"code": 0, "data": f"RT-{dept_code}-{str(max_seq + 1).zfill(3)}"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@app.post("/api/mo/route/add")
def route_add():
    d = request.get_json() or {}
    code       = (d.get("route_code") or "").strip()
    name       = (d.get("route_name") or "").strip()
    dept_code  = (d.get("dept_code") or "").strip()
    is_default = 1 if d.get("is_default") else 0
    if not code or not name or not dept_code:
        return jsonify({"code": 1, "msg": "编码、名称、部门代码不能为空"})
    try:
        conn = db()
        cur = conn.cursor()
        if is_default:
            cur.execute("UPDATE mo_route_yx SET is_default=0 WHERE dept_code=%s", (dept_code,))
        cur.execute(
            "INSERT INTO mo_route_yx (route_code,route_name,dept_code,description,is_active,is_default,create_time,update_time) VALUES (%s,%s,%s,%s,1,%s,NOW(),NOW())",
            (code, name, dept_code, d.get("description", ""), is_default)
        )
        new_id = cur.lastrowid
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "添加成功", "data": {
            "id": new_id, "route_code": code, "route_name": name,
            "dept_code": dept_code, "is_active": 1, "is_default": is_default,
        }})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@app.post("/api/mo/route/update")
def route_update():
    d = request.get_json() or {}
    if not d.get("id"):
        return jsonify({"code": 1, "msg": "id不能为空"})
    dept_code  = (d.get("dept_code") or "").strip()
    is_default = 1 if d.get("is_default") else 0
    try:
        conn = db()
        cur = conn.cursor()
        if is_default:
            cur.execute("UPDATE mo_route_yx SET is_default=0 WHERE dept_code=%s AND id!=%s", (dept_code, d["id"]))
        cur.execute(
            "UPDATE mo_route_yx SET route_name=%s,dept_code=%s,is_default=%s,description=%s,update_time=NOW() WHERE id=%s",
            (d.get("route_name", ""), dept_code, is_default, d.get("description", ""), d["id"])
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "更新成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@app.post("/api/mo/route/delete")
def route_delete():
    d = request.get_json() or {}
    route_id = d.get("id")
    if not route_id:
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM mo_route_step_yx WHERE route_id=%s", (route_id,))
        step_ids = [r[0] for r in cur.fetchall()]
        if step_ids:
            fmt = ','.join(['%s'] * len(step_ids))
            cur.execute(f"DELETE FROM mo_step_station_yx WHERE step_id IN ({fmt})", step_ids)
        cur.execute("DELETE FROM mo_route_step_yx WHERE route_id=%s", (route_id,))
        cur.execute("DELETE FROM mo_wo_route_yx WHERE route_id=%s", (route_id,))
        cur.execute("DELETE FROM mo_route_yx WHERE id=%s", (route_id,))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "删除成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@app.post("/api/mo/route/toggle")
def route_toggle():
    d = request.get_json() or {}
    if not d.get("id"):
        return jsonify({"code": 1, "msg": "id不能为空"})
    try:
        conn = db()
        cur = conn.cursor()
        cur.execute("UPDATE mo_route_yx SET is_active=%s,update_time=NOW() WHERE id=%s",
                    (d.get("is_active", 0), d["id"]))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "操作成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@app.post("/api/mo/route/set-processes")
def route_set_processes():
    d = request.get_json() or {}
    route_id = d.get("route_id")
    steps = d.get("steps", [])
    if not route_id:
        return jsonify({"code": 1, "msg": "route_id不能为空"})
    try:
        conn = db()
        cur = conn.cursor()
        # 先删旧步骤的工站关联
        cur.execute("SELECT id FROM mo_route_step_yx WHERE route_id=%s", (route_id,))
        old_ids = [r[0] for r in cur.fetchall()]
        if old_ids:
            fmt = ','.join(['%s'] * len(old_ids))
            cur.execute(f"DELETE FROM mo_step_station_yx WHERE step_id IN ({fmt})", old_ids)
        cur.execute("DELETE FROM mo_route_step_yx WHERE route_id=%s", (route_id,))
        # 插入新步骤及工站
        for s in steps:
            cur.execute(
                "INSERT INTO mo_route_step_yx (route_id,seq,process_id) VALUES (%s,%s,%s)",
                (route_id, s["seq"], s["process_id"])
            )
            step_id = cur.lastrowid
            if s.get("station_id"):
                cur.execute(
                    "INSERT INTO mo_step_station_yx (step_id,station_id) VALUES (%s,%s)",
                    (step_id, s["station_id"])
                )
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "保存成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


# ================================================================
# 工单路线绑定
# ================================================================
@app.get("/api/mo/wo-state/started")
def wo_state_started():
    """返回已有执行记录的工单 key 集合，供前端过滤"""
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT DISTINCT mo_code, sort_seq FROM mo_execution_yx")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": [f"{r['mo_code']}__{r['sort_seq']}" for r in rows]})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@app.get("/api/mo/wo-route/list")
def wo_route_list():
    try:
        conn = db()
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


@app.post("/api/mo/wo-route/set")
def wo_route_set():
    d = request.get_json() or {}
    mo_code  = (d.get("mo_code") or "").strip()
    sort_seq = d.get("sort_seq")
    route_id = d.get("route_id")
    if not mo_code or sort_seq is None or not route_id:
        return jsonify({"code": 1, "msg": "参数不完整"})
    try:
        conn = db()
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


@app.post("/api/mo/wo-route/remove")
def wo_route_remove():
    d = request.get_json() or {}
    mo_code  = (d.get("mo_code") or "").strip()
    sort_seq = d.get("sort_seq")
    if not mo_code or sort_seq is None:
        return jsonify({"code": 1, "msg": "参数不完整"})
    try:
        conn = db()
        cur = conn.cursor()
        cur.execute("DELETE FROM mo_wo_route_yx WHERE mo_code=%s AND sort_seq=%s", (mo_code, sort_seq))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "已取消指定"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@app.post("/api/mo/wo-route/set-batch")
def wo_route_set_batch():
    d = request.get_json() or {}
    route_id = d.get("route_id")
    items = d.get("items", [])
    if not route_id or not items:
        return jsonify({"code": 1, "msg": "参数不完整"})
    try:
        conn = db()
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


# ================================================================
# Dashboard 分析
# ================================================================
@app.get("/api/mo/dashboard/gantt-data")
def dashboard_gantt_data():
    """甘特图数据：以计划日期为基准，每条工单 2 行（计划 + 工序）"""
    from datetime import timedelta

    today = date.today()

    start_str = request.args.get('start')
    end_str   = request.args.get('end')
    if not start_str:
        start_str = (today - timedelta(days=today.weekday() + 7)).isoformat()
    if not end_str:
        end_str = (today + timedelta(days=6 - today.weekday() + 7)).isoformat()

    # 1. 执行记录（不限日期过滤，按工单取全量，前端按计划日期筛工单后自然过滤）
    try:
        conn = db()
        cur  = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT mo_code, sort_seq, seq, process_name, start_time, end_time, status
            FROM mo_execution_yx
            ORDER BY mo_code, sort_seq, seq
        """)
        exec_rows = cur.fetchall()
        cur.close(); conn.close()
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})

    # 2. 计划日期（MOAPI）—— 以计划日期落在筛选范围内为准
    try:
        resp    = http.get(f"{MOAPI}/workorder/list", params={"token": MOAPI_TOKEN}, timeout=10)
        wo_list = resp.json().get('data', []) if resp.status_code == 200 else []
    except Exception:
        wo_list = []

    wo_map = {}
    for wo in wo_list:
        s = str(wo.get('StartDate_c') or '')[:10]
        d = str(wo.get('DueDate_c')   or '')[:10]
        if not s or not d:
            continue
        if s <= end_str and d >= start_str:
            key = (str(wo['MoCode_a']), str(wo['SortSeq_b']))
            wo_map[key] = {
                'start':     s,
                'end':       d,
                'inv_name':  wo.get('cInvName', ''),
                'dept_name': wo.get('cDepName', ''),
                'qty':       wo.get('Qty_b', 0),
            }

    # 3. 按工单聚合执行记录
    exec_by_wo = {}
    for r in exec_rows:
        key = (str(r['mo_code']), str(r['sort_seq']))
        exec_by_wo.setdefault(key, []).append(r)

    # 只展示有计划日期的工单（以计划日期为基准）
    all_keys = sorted(wo_map.keys())

    rows       = []
    wo_options = []   # 供前端筛选下拉

    for key in all_keys:
        mo_code, sort_seq = key
        wo_id = f"{mo_code}-{sort_seq}"
        w     = wo_map[key]

        wo_options.append({'value': wo_id, 'label': wo_id})

        # 计划行（y 以 |p 结尾，排序靠前）
        rows.append({
            'y':         f"{wo_id}|p",
            'type':      'planned',
            'name':      '计划',
            'start':     w['start'],
            'end':       w['end'],
            'inv_name':  w['inv_name'],
            'dept_name': w['dept_name'],
            'qty':       w['qty'],
        })

        # 工序行（y 以 |e 结尾，多条同 y 各为一段）
        execs = exec_by_wo.get(key, [])
        if not execs:
            # 无执行记录 → 灰色未开工条，范围与计划一致
            rows.append({
                'y':         f"{wo_id}|e",
                'type':      'unstarted',
                'name':      '未开工',
                'start':     w['start'],
                'end':       w['end'],
                'inv_name':  w['inv_name'],
                'dept_name': w['dept_name'],
                'qty':       w['qty'],
            })
        else:
            for r in execs:
                if r['start_time'] is None:
                    # queued but not started yet: use plan dates as placeholder
                    rows.append({
                        'y':    f"{wo_id}|e",
                        'type': r['status'],
                        'name': r['process_name'],
                        'start': w['start'],
                        'end':   w['end'],
                        'seq':  r['seq'],
                    })
                    continue
                end_t   = r['end_time'] if r['end_time'] else today
                start_d = r['start_time'].date() if hasattr(r['start_time'], 'date') else date.fromisoformat(str(r['start_time'])[:10])
                end_d   = end_t.date()            if hasattr(end_t,           'date') else date.fromisoformat(str(end_t)[:10])
                rows.append({
                    'y':     f"{wo_id}|e",
                    'type':  r['status'],
                    'name':  r['process_name'],
                    'start': start_d.isoformat(),
                    'end':   end_d.isoformat(),
                    'seq':   r['seq'],
                })

    return jsonify({
        "code":       0,
        "data":       rows,
        "wo_options": wo_options,
        "meta":       {"start": start_str, "end": end_str},
    })


@app.get("/api/mo/dashboard/process-gantt")
def dashboard_process_gantt():
    """工序甘特图：近30天，每条执行记录一根条，进行中延伸到今天"""
    from datetime import timedelta

    today          = date.today()
    thirty_ago     = today - timedelta(days=29)

    try:
        conn = db()
        cur  = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT process_name, start_time, end_time, qty_done, status,
                   mo_code, sort_seq, seq
            FROM mo_execution_yx
            WHERE start_time IS NOT NULL
              AND (
                status = 'processing'
                OR (status = 'done' AND end_time >= %s)
              )
            ORDER BY process_name, start_time, seq
        """, (thirty_ago,))
        rows = cur.fetchall()
        cur.close(); conn.close()
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})

    def to_date(v):
        return v.date() if hasattr(v, 'date') else date.fromisoformat(str(v)[:10])

    result = []
    for r in rows:
        start_d = to_date(r['start_time'])
        end_d   = today if r['status'] == 'processing' else to_date(r['end_time'])
        result.append({
            'y':        r['process_name'],
            'type':     r['status'],
            'start':    start_d.isoformat(),
            'end':      end_d.isoformat(),
            'qty':      r['qty_done'] or 0,
            'mo_code':  r['mo_code'],
            'sort_seq': r['sort_seq'],
            'seq':      r['seq'],
        })

    return jsonify({"code": 0, "data": result})


@app.get("/api/mo/dashboard/summary")
def dashboard_summary():
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)

        # 完工记录数量
        cur.execute("SELECT COUNT(*) AS cnt FROM mo_wo_state_yx WHERE status='done'")
        done_count = cur.fetchone()['cnt']

        # 完工数量：已完工工单最后一道工序的 qty_done 求和
        cur.execute("""
            SELECT COALESCE(SUM(e.qty_done), 0) AS cnt
            FROM mo_execution_yx e
            JOIN mo_wo_state_yx ws
                ON ws.mo_code=e.mo_code AND ws.sort_seq=e.sort_seq AND ws.route_id=e.route_id
            JOIN (
                SELECT route_id, MAX(seq) AS last_seq FROM mo_route_step_yx GROUP BY route_id
            ) ls ON ls.route_id=ws.route_id AND ls.last_seq=e.seq
            WHERE ws.status='done' AND e.status='done'
        """)
        done_qty = cur.fetchone()['cnt']

        # 在制工单记录数量
        cur.execute("SELECT COUNT(*) AS cnt FROM mo_wo_state_yx WHERE status != 'done'")
        wip_count = cur.fetchone()['cnt']

        # 在制数量：在制工单中最近一次已确认交接的 qty_out 求和
        cur.execute("""
            SELECT COALESCE(SUM(h.qty_out), 0) AS cnt
            FROM mo_handover_yx h
            JOIN (
                SELECT mo_code, sort_seq, MAX(id) AS max_id
                FROM mo_handover_yx WHERE status='confirmed'
                GROUP BY mo_code, sort_seq
            ) latest ON latest.max_id=h.id
            JOIN mo_wo_state_yx ws ON ws.mo_code=h.mo_code AND ws.sort_seq=h.sort_seq
            WHERE ws.status != 'done'
        """)
        wip_qty = cur.fetchone()['cnt']

        cur.close(); conn.close()
        return jsonify({"code": 0, "data": {
            "done_count": done_count,
            "done_qty": int(done_qty),
            "wip_count": wip_count,
            "wip_qty": int(wip_qty),
        }})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@app.get("/api/mo/dashboard/capacity")
def dashboard_capacity():
    """近7天每日工序完工数量（按工序分组）"""
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT DATE(end_time) AS dt, process_name, SUM(qty_done) AS qty
            FROM mo_execution_yx
            WHERE status='done' AND end_time IS NOT NULL
              AND DATE(end_time) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            GROUP BY DATE(end_time), process_name
            ORDER BY dt ASC, process_name ASC
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": [_ser(r) for r in rows]})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@app.get("/api/mo/dashboard/wip")
def dashboard_wip():
    """当前在制工单列表"""
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT
                ws.mo_code, ws.sort_seq, r.route_name,
                CONCAT(ws.current_seq, ' / ', ts.total) AS step_progress,
                p.process_name AS current_process,
                ws.status,
                COALESCE(ce.operator_name, '') AS operator_name,
                COALESCE(ce.qty_done, 0) AS qty_done,
                ce.start_time,
                CASE WHEN ce.start_time IS NOT NULL
                     THEN ROUND(TIMESTAMPDIFF(MINUTE, ce.start_time, NOW()) / 60.0, 1)
                     ELSE NULL
                END AS hours_elapsed
            FROM mo_wo_state_yx ws
            JOIN mo_route_yx r ON r.id = ws.route_id
            JOIN mo_route_step_yx rs ON rs.route_id = ws.route_id AND rs.seq = ws.current_seq
            JOIN mo_process_yx p ON p.id = rs.process_id
            JOIN (SELECT route_id, COUNT(*) AS total FROM mo_route_step_yx GROUP BY route_id) ts ON ts.route_id = ws.route_id
            LEFT JOIN mo_execution_yx ce ON ce.mo_code=ws.mo_code AND ce.sort_seq=ws.sort_seq
                AND ce.route_id=ws.route_id AND ce.seq=ws.current_seq
            WHERE ws.status != 'done'
            ORDER BY ws.status ASC, ce.start_time ASC
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": [_ser(r) for r in rows]})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@app.get("/api/mo/dashboard/anomalies")
def dashboard_anomalies():
    """近7天完工异常记录"""
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT mo_code, sort_seq, seq, process_name, operator_name,
                   qty_done, complete_reason, end_time
            FROM mo_execution_yx
            WHERE status='done' AND complete_reason IS NOT NULL AND complete_reason!=''
              AND end_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            ORDER BY end_time DESC
            LIMIT 50
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": [_ser(r) for r in rows]})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
