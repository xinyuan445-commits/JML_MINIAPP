"""
webapi — 本地 API 服务，专供 jml_admin 网页管理后台使用
端口: 5001
启动: python app.py
"""
import os
import json
import re
from copy import deepcopy
from datetime import datetime, date, timedelta
from decimal import Decimal

import requests as http
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request, session
from flask_cors import CORS
import mysql.connector
from mysql.connector import pooling
from werkzeug.security import check_password_hash

try:
    import pyodbc
except ImportError:
    pyodbc = None

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_BASE_DIR, ".env"))
load_dotenv(os.path.join(_BASE_DIR, ".env.admin"), override=True)

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY")
if not app.secret_key:
    raise RuntimeError("FLASK_SECRET_KEY 未配置，管理后台不能启动")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("SESSION_COOKIE_SECURE", "0") == "1",
    PERMANENT_SESSION_LIFETIME=60 * 60 * 8,
)
_allowed_origins = [
    value.strip()
    for value in os.getenv(
        "ADMIN_ALLOWED_ORIGINS",
        "http://127.0.0.1:8886,http://localhost:8886",
    ).split(",")
    if value.strip()
]
CORS(
    app,
    resources={r"/api/*": {"origins": _allowed_origins}},
    supports_credentials=True,
)

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
_workorder_cache = {"expires_at": None, "rows": []}

U8_DB_CONFIG = {
    "driver": os.getenv("U8_DB_DRIVER", "ODBC Driver 17 for SQL Server"),
    "server": os.getenv("U8_DB_SERVER", "172.16.1.159"),
    "port": os.getenv("U8_DB_PORT", "1433").strip(),
    "database": os.getenv("U8_DB_NAME", "UFDATA_008_2021"),
    "uid": os.getenv("U8_DB_USER", "sa"),
    "pwd": os.getenv("U8_DB_PASSWORD", "r7B3LshWfs4.JH.F5f8Xpc+R"),
    "timeout": max(1, int(os.getenv("U8_DB_TIMEOUT", "5"))),
}


def db():
    return _pool.get_connection()


_AUDIT_ACTIONS = {
    "/api/login/account": "登录后台",
    "/api/login/outLogin": "退出后台",
    "/api/mo/process/add": "新增工序",
    "/api/mo/process/update": "修改工序",
    "/api/mo/process/toggle": "启用或禁用工序",
    "/api/mo/product-category/add": "新增报工产品类别",
    "/api/mo/product-category/update": "修改报工产品类别",
    "/api/mo/product-category/toggle": "启用或禁用报工产品类别",
    "/api/mo/workstation/add": "新增工站",
    "/api/mo/workstation/update": "修改工站",
    "/api/mo/workstation/toggle": "启用或禁用工站",
    "/api/mo/route/add": "新增工艺路线",
    "/api/mo/route/update": "修改工艺路线",
    "/api/mo/route/toggle": "启用或禁用工艺路线",
    "/api/mo/route/set-categories": "修改路线适用产品",
    "/api/mo/route/set-processes": "修改路线工序",
    "/api/mo/route/delete": "删除工艺路线",
    "/api/mo/route/version/create": "创建工艺路线新版本",
    "/api/mo/route/version/restore": "恢复工艺路线历史版本",
    "/api/mo/wo-route/set": "指定工单路线",
    "/api/mo/wo-route/remove": "恢复工单默认路线",
    "/api/mo/wo-route/set-batch": "批量指定工单路线",
}
_SENSITIVE_KEYS = {"password", "token", "secret", "app_secret"}


def _safe_request_data():
    data = deepcopy(request.get_json(silent=True) or {})

    def redact(value):
        if isinstance(value, dict):
            return {
                key: "***" if key.lower() in _SENSITIVE_KEYS else redact(item)
                for key, item in value.items()
            }
        if isinstance(value, list):
            return [redact(item) for item in value]
        return value

    return redact(data)


def _write_audit(response):
    if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return
    if request.path not in _AUDIT_ACTIONS:
        return
    request_data = _safe_request_data()
    body = response.get_json(silent=True) or {}
    username = getattr(g, "audit_username", "") or request_data.get("username") or "unknown"
    result_code = body.get("code")
    if result_code is None:
        result_code = 0 if body.get("status") == "ok" and response.status_code < 400 else 1
    target_id = (
        request_data.get("id")
        or request_data.get("route_id")
        or request_data.get("mo_code")
    )
    conn = None
    try:
        conn = db()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO mo_admin_audit_log_yx
                (username,action_name,request_method,request_path,target_id,
                 request_data,result_code,result_message,ip_address)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                str(username),
                _AUDIT_ACTIONS[request.path],
                request.method,
                request.path,
                str(target_id) if target_id is not None else None,
                json.dumps(request_data, ensure_ascii=False, default=str)[:10000],
                int(result_code or 0),
                str(body.get("msg") or body.get("errorMessage") or "")[:500],
                request.headers.get("X-Forwarded-For", request.remote_addr or "").split(",")[0].strip(),
            ),
        )
        conn.commit()
        cur.close(); conn.close()
    except Exception:
        if conn:
            try:
                conn.rollback(); conn.close()
            except Exception:
                pass


@app.before_request
def require_admin_session():
    g.audit_username = session.get("admin_username", "")
    if request.method == "OPTIONS":
        return None
    if request.path in {"/api/login/account", "/api/currentUser"}:
        return None
    if request.path.startswith("/api/mo") and not session.get("admin_username"):
        return jsonify({
            "success": False,
            "code": 401,
            "errorCode": 401,
            "errorMessage": "登录已失效，请重新登录",
            "msg": "登录已失效，请重新登录",
        }), 401
    if (
        request.path.startswith("/api/mo")
        and request.method in {"POST", "PUT", "PATCH", "DELETE"}
        and session.get("admin_role") != "admin"
    ):
        return jsonify({"code": 403, "msg": "当前账号没有管理权限"}), 403
    return None


@app.after_request
def audit_admin_write(response):
    _write_audit(response)
    return response


@app.post("/api/login/account")
def admin_login():
    body = request.get_json(silent=True) or {}
    username = str(body.get("username") or "").strip()
    password = str(body.get("password") or "")
    conn = None
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """
            SELECT id,username,password_hash,display_name,role,is_active
            FROM mo_admin_user_yx WHERE username=%s LIMIT 1
            """,
            (username,),
        )
        user = cur.fetchone()
        if not user or not user["is_active"] or not check_password_hash(user["password_hash"], password):
            cur.close(); conn.close()
            return jsonify({"status": "error", "type": "account", "currentAuthority": "guest"})
        cur.execute("UPDATE mo_admin_user_yx SET last_login_time=NOW() WHERE id=%s", (user["id"],))
        conn.commit(); cur.close(); conn.close()
        session.clear()
        session.permanent = True
        session["admin_user_id"] = user["id"]
        session["admin_username"] = user["username"]
        session["admin_display_name"] = user["display_name"] or user["username"]
        session["admin_role"] = user["role"]
        g.audit_username = user["username"]
        return jsonify({"status": "ok", "type": "account", "currentAuthority": user["role"]})
    except Exception:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        return jsonify({"status": "error", "type": "account", "currentAuthority": "guest"}), 500


@app.get("/api/currentUser")
def admin_current_user():
    username = session.get("admin_username")
    if not username:
        return jsonify({
            "success": False,
            "errorCode": 401,
            "errorMessage": "请先登录",
            "data": {"isLogin": False},
        }), 401
    return jsonify({
        "success": True,
        "data": {
            "name": session.get("admin_display_name") or username,
            "userid": str(session.get("admin_user_id") or ""),
            "access": session.get("admin_role") or "viewer",
        },
    })


@app.post("/api/login/outLogin")
def admin_logout():
    g.audit_username = session.get("admin_username", "")
    session.clear()
    return jsonify({"success": True, "data": {}})


def u8_db():
    if pyodbc is None:
        raise RuntimeError("缺少 pyodbc，请先安装 webapi/requirements.txt 中的依赖")
    server = U8_DB_CONFIG["server"]
    if U8_DB_CONFIG["port"] and "," not in server and "\\" not in server:
        server = f"{server},{U8_DB_CONFIG['port']}"
    conn_str = (
        f"DRIVER={{{U8_DB_CONFIG['driver']}}};"
        f"SERVER={server};"
        f"DATABASE={U8_DB_CONFIG['database']};"
        f"UID={U8_DB_CONFIG['uid']};"
        f"PWD={U8_DB_CONFIG['pwd']};"
        f"Connection Timeout={U8_DB_CONFIG['timeout']};"
    )
    if U8_DB_CONFIG["driver"].lower().startswith("odbc driver"):
        conn_str += "Encrypt=no;TrustServerCertificate=yes;"
    return pyodbc.connect(conn_str, timeout=U8_DB_CONFIG["timeout"])


def _u8_error_message(exc, action="连接"):
    message = str(exc)
    endpoint = U8_DB_CONFIG["server"]
    if U8_DB_CONFIG["port"]:
        endpoint = f"{endpoint}:{U8_DB_CONFIG['port']}"
    if any(code in message for code in ("HYT00", "HYT01", "08001")) or "timeout" in message.lower():
        if action == "查询":
            return "已连接U8，但生产标签SQL查询超时"
        return f"U8 SQL Server连接超时（{endpoint}），服务器未完成登录握手，请检查SQL Server实例和端口"
    if "28000" in message or "18456" in message:
        return "U8数据库账号或密码错误"
    if "4060" in message or "Cannot open database" in message:
        return f"U8账套数据库不存在或无权访问：{U8_DB_CONFIG['database']}"
    if action == "查询":
        return "已连接U8，但生产标签SQL查询失败，请查看webapi日志中的具体SQL错误"
    return "U8数据库连接失败，请查看webapi日志中的具体错误"


def _ser(row):
    if row is None:
        return None
    return {k: (v.strftime('%Y-%m-%d %H:%M:%S') if isinstance(v, (datetime, date)) else v)
            for k, v in row.items()}


def _u8_value(val):
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(val, date):
        return val.strftime("%Y-%m-%d")
    return val


def _u8_rows(cursor):
    columns = [col[0] for col in cursor.description]
    return [{k: _u8_value(v) for k, v in zip(columns, row)} for row in cursor.fetchall()]


def _workorder_info_map():
    now = datetime.now()
    expires_at = _workorder_cache["expires_at"]
    if expires_at and expires_at > now:
        rows = _workorder_cache["rows"]
        return {
            (str(row.get("MoCode_a") or ""), int(row.get("SortSeq_b") or 0)): row
            for row in rows
        }, True

    try:
        response = http.get(f"{MOAPI}/workorder/list", timeout=5)
        body = response.json()
        rows = body.get("data", []) if response.status_code == 200 and body.get("code") == 0 else []
        if rows:
            _workorder_cache["rows"] = rows
            _workorder_cache["expires_at"] = now + timedelta(minutes=2)
            return {
                (str(row.get("MoCode_a") or ""), int(row.get("SortSeq_b") or 0)): row
                for row in rows
            }, True
    except Exception:
        pass

    rows = _workorder_cache["rows"]
    return {
        (str(row.get("MoCode_a") or ""), int(row.get("SortSeq_b") or 0)): row
        for row in rows
    }, False


def _photo_urls(value):
    return [item.strip() for item in str(value or "").split(",") if item.strip()]


def _duration_seconds(start_time, end_time):
    if not start_time or not end_time:
        return None
    return max(0, int((end_time - start_time).total_seconds()))


def _product_info(row):
    if not row:
        return {
            "inv_code": "",
            "inv_name": "",
            "plan_qty": None,
            "product_category": "",
            "production_department": "",
            "plan_start_date": None,
            "plan_due_date": None,
        }
    return {
        "inv_code": row.get("InvCode_b") or "",
        "inv_name": row.get("cInvName") or "",
        "plan_qty": row.get("Qty_b"),
        "product_category": row.get("CategoryName") or "",
        "production_department": row.get("cDepName") or "",
        "plan_start_date": row.get("StartDate_c"),
        "plan_due_date": row.get("DueDate_c"),
    }


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
        r = http.get(f"{MOAPI}/workorder/list", timeout=10)
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


# ================================================================
# 生产标签打印（查询 U8 工单明细）
# ================================================================
PRODUCTION_LABEL_SQL = """
SELECT
    a.MoCode AS mo_code,
    dp.cDepName AS dept_name,
    inv.cInvCode AS inv_code,
    inv.cInvName AS inv_name,
    inv.cInvStd AS inv_std,
    b.Qty AS qty,
    c.StartDate AS start_date,
    c.DueDate AS due_date,
    a.CreateTime AS create_time,
    bom.Version AS bom_version,
    b.OrderCode AS order_code,
    b.OrderSeq AS order_seq,
    u2.cUser_Name AS audit_user,
    u1.cUser_Name AS create_user,
    b.RelsTime AS audit_time,
    b.SortSeq AS line_no,
    CASE
        WHEN LEFT(b.InvCode, 1) = '1' THEN N'成品'
        WHEN LEFT(b.InvCode, 1) = '2' THEN N'半成品'
        ELSE N''
    END AS product_category,
    u4.cVoucherNo AS source_voucher_no,
    u8.cSOCode AS so_code,
    u8.cCusName AS customer_name,
    u7.iRowNo AS so_row_no,
    u7.dPreDate AS delivery_date,
    b.Remark AS remark,
    dp.cDepMemo AS route_memo,
    b.MoLotCode AS lot_code
FROM mom_order a
LEFT JOIN mom_orderdetail b ON a.MoId = b.MoId
LEFT JOIN mom_morder c ON b.ModId = c.MoDId
LEFT JOIN Inventory inv ON inv.cInvCode = b.InvCode
LEFT JOIN Department dp ON b.MDeptCode = dp.cDepCode
LEFT JOIN (
    SELECT bb.Version, bp2.InvCode, bb.BomId
    FROM bom_bom bb
    LEFT JOIN bom_parent bp ON bb.BomId = bp.BomId
    LEFT JOIN bas_part bp2 ON bp.ParentId = bp2.PartId
    WHERE bb.CloseUser IS NULL AND bp2.InvCode IS NOT NULL
) bom ON bom.InvCode = b.InvCode AND b.BomId = bom.BomId
LEFT JOIN UFSystem..UA_User u1 ON a.CreateUser = u1.cUser_Id
LEFT JOIN UFSystem..UA_User u2 ON u2.cUser_Id = b.RelsUser
LEFT JOIN UFSystem..GC_SynergismTaskLog u3 ON b.OrderCode = u3.cVoucherNo
LEFT JOIN UFSystem..GC_SynergismTaskLog u4 ON u3.FatherId = u4.AutoId AND u4.bMainTask = 1
LEFT JOIN UFDATA_001_2021..SO_SOMain u8 ON u4.cVoucherNo = u8.cSOCode
LEFT JOIN UFDATA_001_2021..SO_SODetails u7 ON u8.ID = u7.ID
    AND u7.iRowNo = b.OrderSeq
    AND u7.cInvCode = inv.cInvCode
WHERE a.MoCode = ?
ORDER BY b.SortSeq ASC
"""


@app.get("/api/mo/production-label")
def production_label():
    mo_code = (request.args.get("mo_code") or "").strip()
    if not mo_code:
        return jsonify({"code": 1, "msg": "工单号不能为空"})
    conn = None
    cur = None
    try:
        conn = u8_db()
        conn.timeout = 20
        cur = conn.cursor()
        cur.execute(PRODUCTION_LABEL_SQL, (mo_code,))
        rows = _u8_rows(cur)
        if not rows:
            return jsonify({"code": 1, "msg": "未找到生产订单", "data": None})

        first = rows[0]
        approved = any(str(r.get("audit_time") or "").strip() for r in rows)
        total_qty = sum(float(r.get("qty") or 0) for r in rows)
        header = {
            "mo_code": first.get("mo_code"),
            "dept_name": first.get("dept_name"),
            "product_category": first.get("product_category"),
            "start_date": first.get("start_date"),
            "due_date": first.get("due_date"),
            "create_user": first.get("create_user"),
            "audit_user": first.get("audit_user"),
            "audit_time": first.get("audit_time"),
            "approved": approved,
            "total_qty": total_qty,
        }
        lines = []
        for r in rows:
            line_no = r.get("line_no")
            lines.append({
                "line_no": line_no,
                "inv_code": r.get("inv_code"),
                "inv_name": r.get("inv_name"),
                "inv_std": r.get("inv_std"),
                "qty": r.get("qty"),
                "lot_code": r.get("lot_code"),
                "bom_version": r.get("bom_version"),
                "order_code": r.get("order_code"),
                "order_seq": r.get("order_seq"),
                "customer_name": r.get("customer_name"),
                "delivery_date": r.get("delivery_date"),
                "route_memo": r.get("route_memo"),
                "remark": r.get("remark"),
                "qr_value": json.dumps({"mocode": mo_code, "sortseq": line_no}, ensure_ascii=False),
            })
        return jsonify({"code": 0, "data": {"header": header, "lines": lines}})
    except Exception as e:
        action = "查询" if conn is not None else "连接"
        app.logger.exception("production label U8 %s failed for %s", action, mo_code)
        return jsonify({"code": 1, "msg": _u8_error_message(e, action), "data": None})
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


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
def _route_usage_count(cur, route_id):
    cur.execute("""
        SELECT COUNT(DISTINCT CONCAT(mo_code, '#', sort_seq)) AS cnt
        FROM (
            SELECT mo_code,sort_seq FROM mo_execution_yx WHERE route_id=%s
            UNION ALL
            SELECT mo_code,sort_seq FROM mo_wo_state_yx WHERE route_id=%s
            UNION ALL
            SELECT mo_code,sort_seq FROM mo_handover_yx WHERE route_id=%s
            UNION ALL
            SELECT mo_code,sort_seq FROM mo_wo_route_yx WHERE route_id=%s
        ) used
    """, (route_id, route_id, route_id, route_id))
    row = cur.fetchone()
    value = row["cnt"] if isinstance(row, dict) else row[0]
    return int(value or 0)


def _route_version_name(name, version_no):
    base = re.sub(r"V\d+$", "", (name or "").strip(), flags=re.IGNORECASE).rstrip(" -")
    return f"{base}V{version_no}"


def _sync_route_categories(cur, route_id, version_group):
    cur.execute(
        "DELETE FROM mo_product_route_yx WHERE route_id IN "
        "(SELECT id FROM mo_route_yx WHERE version_group=%s)",
        (version_group,),
    )
    cur.execute("""
        INSERT INTO mo_product_route_yx (product_code, route_id)
        SELECT product_code, route_id
        FROM mo_route_version_category_yx
        WHERE route_id=%s
        ON DUPLICATE KEY UPDATE route_id=VALUES(route_id)
    """, (route_id,))


@app.get("/api/mo/product-category/list")
def product_category_list():
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT code,name FROM bj_product_cost_yx WHERE is_enabled=1 ORDER BY code")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": rows})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@app.post("/api/mo/route/set-categories")
def route_set_categories():
    d = request.get_json() or {}
    route_id = d.get("route_id")
    product_codes = [str(v).strip() for v in d.get("product_codes", []) if str(v).strip()]
    if not route_id:
        return jsonify({"code": 1, "msg": "route_id不能为空"})
    try:
        conn = db()
        cur = conn.cursor()
        cur.execute("SELECT version_group,is_current FROM mo_route_yx WHERE id=%s", (route_id,))
        route = cur.fetchone()
        if not route or not route[1]:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "只能修改当前路线版本的适用产品"})
        if _route_usage_count(cur, route_id) > 0:
            cur.close(); conn.close()
            return jsonify({"code": 2, "msg": "路线已使用，请创建新版本后修改适用产品", "require_new_version": True})
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


@app.get("/api/mo/route/list")
def route_list():
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT r.*,
                   COALESCE(u.usage_count,0) AS usage_count,
                   GROUP_CONCAT(vc.product_code ORDER BY vc.product_code) AS product_codes,
                   GROUP_CONCAT(pc.name ORDER BY vc.product_code SEPARATOR '、') AS product_names
            FROM mo_route_yx r
            LEFT JOIN mo_route_version_category_yx vc ON vc.route_id=r.id
            LEFT JOIN bj_product_cost_yx pc ON pc.code=vc.product_code
            LEFT JOIN (
                SELECT route_id,COUNT(DISTINCT CONCAT(mo_code,'#',sort_seq)) AS usage_count
                FROM (
                    SELECT route_id,mo_code,sort_seq FROM mo_execution_yx
                    UNION ALL SELECT route_id,mo_code,sort_seq FROM mo_wo_state_yx
                    UNION ALL SELECT route_id,mo_code,sort_seq FROM mo_handover_yx
                    UNION ALL SELECT route_id,mo_code,sort_seq FROM mo_wo_route_yx
                ) all_usage
                GROUP BY route_id
            ) u ON u.route_id=r.id
            WHERE r.is_current=1
            GROUP BY r.id
            ORDER BY r.dept_code ASC,r.route_name ASC
        """)
        rows = cur.fetchall()
        for row in rows:
            row['product_codes'] = row['product_codes'].split(',') if row['product_codes'] else []
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
        route["usage_count"] = _route_usage_count(cur, route_id)
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
        version_match = re.search(r"V(\d+)$", name, flags=re.IGNORECASE)
        version_no = int(version_match.group(1)) if version_match else 1
        if is_default:
            cur.execute("UPDATE mo_route_yx SET is_default=0 WHERE dept_code=%s", (dept_code,))
        cur.execute(
            """INSERT INTO mo_route_yx
               (route_code,version_group,version_no,parent_route_id,route_name,dept_code,
                description,version_note,is_active,is_default,is_current,create_time,update_time)
               VALUES (%s,%s,%s,NULL,%s,%s,%s,%s,1,%s,1,NOW(),NOW())""",
            (code, code, version_no, name, dept_code, d.get("description", ""),
             d.get("version_note", ""), is_default)
        )
        new_id = cur.lastrowid
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "添加成功", "data": {
            "id": new_id, "route_code": code, "route_name": name,
            "dept_code": dept_code, "is_active": 1, "is_default": is_default,
            "version_group": code, "version_no": version_no, "is_current": 1,
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
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT id,is_current FROM mo_route_yx WHERE id=%s", (d["id"],))
        route = cur.fetchone()
        if not route or not route["is_current"]:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "只能编辑当前路线版本"})
        if _route_usage_count(cur, d["id"]) > 0:
            cur.close(); conn.close()
            return jsonify({"code": 2, "msg": "路线已使用，请创建新版本后修改", "require_new_version": True})
        cur.close()
        cur = conn.cursor()
        if is_default:
            cur.execute("UPDATE mo_route_yx SET is_default=0 WHERE dept_code=%s AND id!=%s", (dept_code, d["id"]))
        cur.execute(
            """UPDATE mo_route_yx
               SET route_name=%s,dept_code=%s,is_default=%s,description=%s,
                   version_note=%s,update_time=NOW()
               WHERE id=%s""",
            (d.get("route_name", ""), dept_code, is_default, d.get("description", ""),
             d.get("version_note", ""), d["id"])
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "更新成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@app.post("/api/mo/route/version/create")
def route_version_create():
    d = request.get_json() or {}
    source_id = d.get("source_route_id")
    if not source_id:
        return jsonify({"code": 1, "msg": "source_route_id不能为空"})
    conn = None
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM mo_route_yx WHERE id=%s FOR UPDATE", (source_id,))
        source = cur.fetchone()
        if not source:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "来源路线不存在"})
        version_group = source["version_group"] or source["route_code"]
        cur.execute("SELECT COALESCE(MAX(version_no),0)+1 AS next_version FROM mo_route_yx WHERE version_group=%s", (version_group,))
        version_no = int(cur.fetchone()["next_version"])
        suffix = f"-V{version_no}"
        route_code = f"{version_group[:50-len(suffix)]}{suffix}"
        route_name = _route_version_name(source["route_name"], version_no)
        was_default = int(source.get("is_default") or 0)

        cur.execute("UPDATE mo_route_yx SET is_current=0,is_default=0 WHERE version_group=%s", (version_group,))
        cur.execute("""
            INSERT INTO mo_route_yx
              (route_code,version_group,version_no,parent_route_id,route_name,dept_code,
               dept_name,is_default,is_current,description,version_note,is_active,create_time,update_time)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,1,%s,%s,1,NOW(),NOW())
        """, (
            route_code, version_group, version_no, source_id, route_name,
            source.get("dept_code"), source.get("dept_name"), was_default,
            source.get("description"), d.get("version_note") or "由历史路线创建新版本",
        ))
        new_id = cur.lastrowid
        cur.execute("""
            INSERT INTO mo_route_version_category_yx (route_id,product_code)
            SELECT %s,product_code FROM mo_route_version_category_yx WHERE route_id=%s
        """, (new_id, source_id))
        cur.execute("SELECT product_code FROM mo_route_version_category_yx WHERE route_id=%s ORDER BY product_code", (new_id,))
        copied_product_codes = [row["product_code"] for row in cur.fetchall()]

        cur.execute("SELECT id,seq,process_id FROM mo_route_step_yx WHERE route_id=%s ORDER BY seq", (source_id,))
        source_steps = cur.fetchall()
        for step in source_steps:
            cur.execute(
                "INSERT INTO mo_route_step_yx (route_id,seq,process_id) VALUES (%s,%s,%s)",
                (new_id, step["seq"], step["process_id"]),
            )
            new_step_id = cur.lastrowid
            cur.execute("SELECT station_id FROM mo_step_station_yx WHERE step_id=%s", (step["id"],))
            for station in cur.fetchall():
                cur.execute(
                    "INSERT INTO mo_step_station_yx (step_id,station_id) VALUES (%s,%s)",
                    (new_step_id, station["station_id"]),
                )

        _sync_route_categories(cur, new_id, version_group)
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": f"已创建V{version_no}", "data": {
            "id": new_id, "route_code": route_code, "route_name": route_name,
            "version_group": version_group, "version_no": version_no,
            "is_current": 1, "is_active": 1, "is_default": was_default,
            "dept_code": source.get("dept_code"), "product_codes": copied_product_codes, "usage_count": 0,
        }})
    except Exception as e:
        if conn:
            try:
                conn.rollback(); conn.close()
            except Exception:
                pass
        return jsonify({"code": 1, "msg": str(e)})


@app.get("/api/mo/route/version/history")
def route_version_history():
    route_id = request.args.get("id", type=int)
    if not route_id:
        return jsonify({"code": 1, "msg": "id不能为空", "data": []})
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT version_group FROM mo_route_yx WHERE id=%s", (route_id,))
        route = cur.fetchone()
        if not route:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "路线不存在", "data": []})
        cur.execute("""
            SELECT r.*,
                   GROUP_CONCAT(vc.product_code ORDER BY vc.product_code) AS product_codes,
                   GROUP_CONCAT(pc.name ORDER BY vc.product_code SEPARATOR '、') AS product_names
            FROM mo_route_yx r
            LEFT JOIN mo_route_version_category_yx vc ON vc.route_id=r.id
            LEFT JOIN bj_product_cost_yx pc ON pc.code=vc.product_code
            WHERE r.version_group=%s
            GROUP BY r.id
            ORDER BY r.version_no DESC,r.id DESC
        """, (route["version_group"],))
        rows = cur.fetchall()
        for row in rows:
            row["product_codes"] = row["product_codes"].split(",") if row["product_codes"] else []
            row["usage_count"] = _route_usage_count(cur, row["id"])
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": [_ser(row) for row in rows]})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@app.get("/api/mo/product-category/manage-list")
def product_category_manage_list():
    try:
        conn = db()
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


@app.post("/api/mo/product-category/add")
def product_category_add():
    name = str((request.get_json() or {}).get("name") or "").strip()
    if not name:
        return jsonify({"code": 1, "msg": "产品类别名称不能为空"})
    try:
        conn = db()
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


@app.post("/api/mo/product-category/update")
def product_category_update():
    body = request.get_json() or {}
    code = str(body.get("code") or "").strip()
    name = str(body.get("name") or "").strip()
    if not code or not name:
        return jsonify({"code": 1, "msg": "产品类别编码和名称不能为空"})
    try:
        conn = db()
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


@app.post("/api/mo/product-category/toggle")
def product_category_toggle():
    code = str((request.get_json() or {}).get("code") or "").strip()
    if not code:
        return jsonify({"code": 1, "msg": "产品类别编码不能为空"})
    try:
        conn = db()
        cur = conn.cursor()
        cur.execute("UPDATE bj_product_cost_yx SET is_enabled=1-is_enabled WHERE code=%s", (code,))
        if cur.rowcount == 0:
            conn.rollback(); cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "产品类别不存在"})
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "操作成功"})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


@app.post("/api/mo/route/version/restore")
def route_version_restore():
    route_id = (request.get_json() or {}).get("id")
    if not route_id:
        return jsonify({"code": 1, "msg": "id不能为空"})
    conn = None
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM mo_route_yx WHERE id=%s FOR UPDATE", (route_id,))
        route = cur.fetchone()
        if not route:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "路线不存在"})
        group = route["version_group"]
        cur.execute("SELECT MAX(is_default) AS was_default FROM mo_route_yx WHERE version_group=%s", (group,))
        was_default = int(cur.fetchone()["was_default"] or 0)
        cur.execute("UPDATE mo_route_yx SET is_current=0,is_default=0 WHERE version_group=%s", (group,))
        cur.execute(
            "UPDATE mo_route_yx SET is_current=1,is_default=%s,is_active=1,update_time=NOW() WHERE id=%s",
            (was_default, route_id),
        )
        _sync_route_categories(cur, route_id, group)
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": f"已恢复为V{route['version_no']}"})
    except Exception as e:
        if conn:
            try:
                conn.rollback(); conn.close()
            except Exception:
                pass
        return jsonify({"code": 1, "msg": str(e)})


@app.post("/api/mo/route/admin-authorize")
def route_admin_authorize():
    if session.get("admin_role") != "admin":
        return jsonify({"code": 1, "msg": "管理员验证失败"}), 403
    return jsonify({"code": 0, "msg": "管理员验证成功"})


@app.post("/api/mo/route/delete")
def route_delete():
    d = request.get_json() or {}
    route_id = d.get("id")
    if not route_id:
        return jsonify({"code": 1, "msg": "id不能为空"})
    conn = None
    try:
        conn = db()
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
            fmt = ','.join(['%s'] * len(step_ids))
            cur.execute(f"DELETE FROM mo_step_station_yx WHERE step_id IN ({fmt})", step_ids)
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
    conn = None
    try:
        conn = db()
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
        # 先删旧步骤的工站关联
        cur.execute("SELECT id FROM mo_route_step_yx WHERE route_id=%s", (route_id,))
        old_ids = [row["id"] for row in cur.fetchall()]
        cur.close()
        cur = conn.cursor()
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
        if conn:
            try:
                conn.rollback(); conn.close()
            except Exception:
                pass
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
# 已完工工单记录
# ================================================================
_COMPLETED_WORKORDER_FROM = """
    FROM mo_wo_state_yx ws
    JOIN mo_route_yx r ON r.id=ws.route_id
    JOIN (
        SELECT
            mo_code, sort_seq, route_id,
            MIN(start_time) AS start_time,
            MAX(end_time) AS end_time,
            COUNT(*) AS process_count,
            SUM(status='done') AS done_process_count,
            GROUP_CONCAT(
                DISTINCT NULLIF(operator_name, '')
                ORDER BY seq SEPARATOR '、'
            ) AS operator_names,
            SUM(
                CASE
                    WHEN complete_reason IS NOT NULL AND complete_reason!='' THEN 1
                    ELSE 0
                END
            ) AS reason_count,
            MAX(qty_c) AS max_qty_c
        FROM mo_execution_yx
        GROUP BY mo_code, sort_seq, route_id
    ) summary
      ON summary.mo_code=ws.mo_code
     AND summary.sort_seq=ws.sort_seq
     AND summary.route_id=ws.route_id
    JOIN mo_execution_yx final_exec
      ON final_exec.mo_code=ws.mo_code
     AND final_exec.sort_seq=ws.sort_seq
     AND final_exec.route_id=ws.route_id
     AND final_exec.seq=ws.current_seq
    WHERE ws.status='done' AND final_exec.status='done'
"""


def _completed_filters():
    today = date.today()
    start_date = (request.args.get("start_date") or "").strip()
    end_date = (request.args.get("end_date") or "").strip()
    keyword = (request.args.get("keyword") or "").strip()
    route_id = request.args.get("route_id", type=int)

    if not start_date:
        start_date = (today - timedelta(days=29)).isoformat()
    if not end_date:
        end_date = today.isoformat()

    where = ["DATE(summary.end_time) >= %s", "DATE(summary.end_time) <= %s"]
    params = [start_date, end_date]
    if keyword:
        like = f"%{keyword}%"
        where.append(
            """(
                ws.mo_code LIKE %s
                OR r.route_name LIKE %s
                OR summary.operator_names LIKE %s
                OR final_exec.process_name LIKE %s
            )"""
        )
        params.extend([like, like, like, like])
    if route_id:
        where.append("ws.route_id=%s")
        params.append(route_id)
    return where, params, start_date, end_date


def _completed_row(row, workorder_map):
    item = _ser(row)
    for field in ("qty_done", "qty_a", "qty_a1", "qty_a2", "qty_c"):
        item[field] = float(item.get(field) or 0)
    for field in ("process_count", "done_process_count", "reason_count", "print_count"):
        item[field] = int(item.get(field) or 0)
    item["duration_seconds"] = (
        int(item["duration_seconds"]) if item.get("duration_seconds") is not None else None
    )
    item["has_exception"] = bool(
        item["reason_count"] or float(row.get("max_qty_c") or 0) > 0
    )
    item.update(
        _product_info(
            workorder_map.get((str(row["mo_code"]), int(row["sort_seq"])))
        )
    )
    item.pop("max_qty_c", None)
    return item


@app.get("/api/mo/completed-workorder/list")
def completed_workorder_list():
    page = max(1, request.args.get("current", 1, type=int))
    page_size = min(100, max(10, request.args.get("pageSize", 20, type=int)))
    where, params, start_date, end_date = _completed_filters()
    extra_where = " AND " + " AND ".join(where)
    conn = None
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            f"SELECT COUNT(*) AS total {_COMPLETED_WORKORDER_FROM}{extra_where}",
            params,
        )
        total = int(cur.fetchone()["total"] or 0)
        cur.execute(
            f"""
            SELECT
                ws.mo_code, ws.sort_seq, ws.route_id, r.route_name, r.dept_name,
                summary.start_time, summary.end_time,
                TIMESTAMPDIFF(
                    SECOND, summary.start_time, summary.end_time
                ) AS duration_seconds,
                summary.process_count, summary.done_process_count,
                COALESCE(summary.operator_names, '') AS operator_names,
                summary.reason_count, summary.max_qty_c,
                final_exec.id AS final_execution_id,
                final_exec.process_name AS final_process_name,
                final_exec.qty_done, final_exec.qty_a, final_exec.qty_a1,
                final_exec.qty_a2, final_exec.qty_c,
                (
                    SELECT COUNT(*)
                    FROM mo_execution_print_log_yx print_log
                    WHERE print_log.execution_id=final_exec.id
                ) AS print_count
            {_COMPLETED_WORKORDER_FROM}
            {extra_where}
            ORDER BY summary.end_time DESC, ws.mo_code DESC, ws.sort_seq ASC
            LIMIT %s OFFSET %s
            """,
            params + [page_size, (page - 1) * page_size],
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        conn = None

        workorder_map, product_data_available = _workorder_info_map()
        return jsonify({
            "code": 0,
            "data": [_completed_row(row, workorder_map) for row in rows],
            "total": total,
            "current": page,
            "pageSize": page_size,
            "meta": {
                "start_date": start_date,
                "end_date": end_date,
                "product_data_available": product_data_available,
            },
        })
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": [], "total": 0})
    finally:
        if conn:
            conn.close()


@app.get("/api/mo/completed-workorder/detail")
def completed_workorder_detail():
    mo_code = (request.args.get("mo_code") or "").strip()
    sort_seq = request.args.get("sort_seq", type=int)
    if not mo_code or sort_seq is None:
        return jsonify({"code": 1, "msg": "工单号和行号不能为空"})

    conn = None
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            f"""
            SELECT
                ws.mo_code, ws.sort_seq, ws.route_id, r.route_name, r.dept_name,
                summary.start_time, summary.end_time,
                TIMESTAMPDIFF(
                    SECOND, summary.start_time, summary.end_time
                ) AS duration_seconds,
                summary.process_count, summary.done_process_count,
                COALESCE(summary.operator_names, '') AS operator_names,
                summary.reason_count, summary.max_qty_c,
                final_exec.id AS final_execution_id,
                final_exec.process_name AS final_process_name,
                final_exec.qty_done, final_exec.qty_a, final_exec.qty_a1,
                final_exec.qty_a2, final_exec.qty_c,
                (
                    SELECT COUNT(*)
                    FROM mo_execution_print_log_yx print_log
                    WHERE print_log.execution_id=final_exec.id
                ) AS print_count
            {_COMPLETED_WORKORDER_FROM}
              AND ws.mo_code=%s AND ws.sort_seq=%s
            LIMIT 1
            """,
            (mo_code, sort_seq),
        )
        summary = cur.fetchone()
        if not summary:
            cur.close()
            conn.close()
            conn = None
            return jsonify({"code": 1, "msg": "未找到已完工工单记录"})

        route_id = summary["route_id"]
        cur.execute(
            """
            SELECT
                execution.id, execution.seq, execution.process_name,
                execution.station_name, execution.operator_name,
                execution.complete_operator_name,
                execution.start_time, execution.end_time, execution.status,
                execution.qty_done, execution.qty_a, execution.qty_a1,
                execution.qty_a2, execution.qty_c,
                execution.complete_reason,
                execution.start_photo_url, execution.complete_photo_url,
                (
                    SELECT COUNT(*)
                    FROM mo_execution_print_log_yx print_log
                    WHERE print_log.execution_id=execution.id
                ) AS print_count
            FROM mo_execution_yx execution
            WHERE execution.mo_code=%s
              AND execution.sort_seq=%s
              AND execution.route_id=%s
            ORDER BY execution.seq ASC, execution.id ASC
            """,
            (mo_code, sort_seq, route_id),
        )
        executions = cur.fetchall()
        execution_ids = [row["id"] for row in executions]

        worker_map = {}
        receive_map = {}
        rework_map = {}
        if execution_ids:
            marks = ",".join(["%s"] * len(execution_ids))
            cur.execute(
                f"""
                SELECT execution_id, ding_user_id AS user_id,
                       user_name_snapshot AS user_name,
                       dept_path_snapshot AS dept_path
                FROM mo_execution_worker_yx
                WHERE execution_id IN ({marks})
                ORDER BY id
                """,
                execution_ids,
            )
            for worker in cur.fetchall():
                worker_map.setdefault(worker["execution_id"], []).append(_ser(worker))

            cur.execute(
                f"""
                SELECT
                    id, execution_id, process_name, qty_input,
                    qty_input_a, qty_input_a1, qty_input_a2,
                    qty_a, qty_a1, qty_a2, qty_c,
                    reason, operator_name, photo_url, complete_photo_url,
                    status, start_time, end_time
                FROM mo_receive_work_yx
                WHERE execution_id IN ({marks})
                ORDER BY start_time ASC, id ASC
                """,
                execution_ids,
            )
            receive_rows = cur.fetchall()
            receive_ids = [row["id"] for row in receive_rows]
            receive_worker_map = {}
            if receive_ids:
                receive_marks = ",".join(["%s"] * len(receive_ids))
                cur.execute(
                    f"""
                    SELECT receive_id, ding_user_id AS user_id,
                           user_name_snapshot AS user_name
                    FROM mo_receive_worker_yx
                    WHERE receive_id IN ({receive_marks})
                    ORDER BY id
                    """,
                    receive_ids,
                )
                for worker in cur.fetchall():
                    receive_worker_map.setdefault(worker["receive_id"], []).append(
                        _ser(worker)
                    )
            for row in receive_rows:
                item = _ser(row)
                for field in (
                    "qty_input", "qty_input_a", "qty_input_a1", "qty_input_a2",
                    "qty_a", "qty_a1", "qty_a2", "qty_c",
                ):
                    item[field] = float(item.get(field) or 0)
                item["workers"] = receive_worker_map.get(row["id"], [])
                item["photos"] = _photo_urls(row["photo_url"])
                item["complete_photos"] = _photo_urls(row["complete_photo_url"])
                item["duration_seconds"] = _duration_seconds(
                    row["start_time"], row["end_time"]
                )
                item.pop("photo_url", None)
                item.pop("complete_photo_url", None)
                receive_map.setdefault(row["execution_id"], []).append(item)

            cur.execute(
                f"""
                SELECT
                    id, source_execution_id AS execution_id, process_name,
                    qty_input, qty_a, qty_a1, qty_a2, qty_c,
                    reason, complete_remark, operator_name,
                    photo_url, complete_photo_url,
                    status, start_time, end_time
                FROM mo_rework_yx
                WHERE source_execution_id IN ({marks})
                ORDER BY start_time ASC, id ASC
                """,
                execution_ids,
            )
            rework_rows = cur.fetchall()
            rework_ids = [row["id"] for row in rework_rows]
            rework_worker_map = {}
            if rework_ids:
                rework_marks = ",".join(["%s"] * len(rework_ids))
                cur.execute(
                    f"""
                    SELECT rework_id, ding_user_id AS user_id,
                           user_name_snapshot AS user_name
                    FROM mo_rework_worker_yx
                    WHERE rework_id IN ({rework_marks})
                    ORDER BY id
                    """,
                    rework_ids,
                )
                for worker in cur.fetchall():
                    rework_worker_map.setdefault(worker["rework_id"], []).append(
                        _ser(worker)
                    )
            for row in rework_rows:
                item = _ser(row)
                for field in ("qty_input", "qty_a", "qty_a1", "qty_a2", "qty_c"):
                    item[field] = float(item.get(field) or 0)
                item["workers"] = rework_worker_map.get(row["id"], [])
                item["photos"] = _photo_urls(row["photo_url"])
                item["complete_photos"] = _photo_urls(row["complete_photo_url"])
                item["duration_seconds"] = _duration_seconds(
                    row["start_time"], row["end_time"]
                )
                item.pop("photo_url", None)
                item.pop("complete_photo_url", None)
                rework_map.setdefault(row["execution_id"], []).append(item)

        cur.close()
        conn.close()
        conn = None

        process_rows = []
        for row in executions:
            item = _ser(row)
            for field in ("qty_done", "qty_a", "qty_a1", "qty_a2", "qty_c"):
                item[field] = float(item.get(field) or 0)
            item["print_count"] = int(item.get("print_count") or 0)
            item["workers"] = worker_map.get(row["id"], [])
            item["start_photos"] = _photo_urls(row["start_photo_url"])
            item["complete_photos"] = _photo_urls(row["complete_photo_url"])
            item["duration_seconds"] = _duration_seconds(
                row["start_time"], row["end_time"]
            )
            item["receive_records"] = receive_map.get(row["id"], [])
            item["rework_records"] = rework_map.get(row["id"], [])
            item.pop("start_photo_url", None)
            item.pop("complete_photo_url", None)
            process_rows.append(item)

        workorder_map, product_data_available = _workorder_info_map()
        result = _completed_row(summary, workorder_map)
        result["processes"] = process_rows
        return jsonify({
            "code": 0,
            "data": result,
            "meta": {"product_data_available": product_data_available},
        })
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})
    finally:
        if conn:
            conn.close()


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
        resp    = http.get(f"{MOAPI}/workorder/list", timeout=10)
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
                'range_source': 'plan',
            }

    # 3. 按工单聚合执行记录
    exec_by_wo = {}
    for r in exec_rows:
        key = (str(r['mo_code']), str(r['sort_seq']))
        exec_by_wo.setdefault(key, []).append(r)

    # U8 暂时取不到计划时，仍按真实报工时间展示，避免整张图空白。
    fallback_count = 0
    for key, execs in exec_by_wo.items():
        if key in wo_map:
            continue
        starts = [r['start_time'] for r in execs if r['start_time'] is not None]
        if not starts:
            continue
        ends = [
            r['end_time'] if r['end_time'] is not None else today
            for r in execs
            if r['start_time'] is not None
        ]
        actual_start = min(
            v.date() if hasattr(v, 'date') else date.fromisoformat(str(v)[:10])
            for v in starts
        )
        actual_end = max(
            v.date() if hasattr(v, 'date') else date.fromisoformat(str(v)[:10])
            for v in ends
        )
        if actual_start.isoformat() > end_str or actual_end.isoformat() < start_str:
            continue
        wo_map[key] = {
            'start': actual_start.isoformat(),
            'end': actual_end.isoformat(),
            'inv_name': '',
            'dept_name': '',
            'qty': 0,
            'range_source': 'execution',
        }
        fallback_count += 1

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
            'name':      '计划' if w['range_source'] == 'plan' else '执行范围',
            'start':     w['start'],
            'end':       w['end'],
            'inv_name':  w['inv_name'],
            'dept_name': w['dept_name'],
            'qty':       w['qty'],
            'range_source': w['range_source'],
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
        "meta":       {
            "start": start_str,
            "end": end_str,
            "fallback_count": fallback_count,
        },
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


@app.get("/api/mo/audit/list")
def admin_audit_list():
    page = max(1, request.args.get("current", 1, type=int))
    page_size = min(100, max(10, request.args.get("pageSize", 20, type=int)))
    username = (request.args.get("username") or "").strip()
    action_name = (request.args.get("action_name") or "").strip()
    start_date = (request.args.get("start_date") or "").strip()
    end_date = (request.args.get("end_date") or "").strip()
    where = []
    params = []
    if username:
        where.append("username LIKE %s")
        params.append(f"%{username}%")
    if action_name:
        where.append("action_name LIKE %s")
        params.append(f"%{action_name}%")
    if start_date:
        where.append("create_time >= %s")
        params.append(f"{start_date} 00:00:00")
    if end_date:
        where.append("create_time < DATE_ADD(%s, INTERVAL 1 DAY)")
        params.append(end_date)
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute(f"SELECT COUNT(*) AS cnt FROM mo_admin_audit_log_yx {where_sql}", tuple(params))
        total = int(cur.fetchone()["cnt"] or 0)
        cur.execute(
            f"""
            SELECT id,username,action_name,request_method,request_path,target_id,
                   request_data,result_code,result_message,ip_address,create_time
            FROM mo_admin_audit_log_yx
            {where_sql}
            ORDER BY id DESC
            LIMIT %s OFFSET %s
            """,
            tuple(params + [page_size, (page - 1) * page_size]),
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": [_ser(row) for row in rows], "total": total})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": [], "total": 0})


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5001,
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
        use_reloader=False,
    )
