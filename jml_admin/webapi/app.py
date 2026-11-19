"""
webapi — 本地 API 服务，专供 jml_admin 网页管理后台使用
端口: 5001
启动: python app.py
"""
import os
import json
import re
import base64
from io import BytesIO
from copy import deepcopy
from datetime import datetime, date, timedelta
from decimal import Decimal
from time import monotonic, sleep
from zoneinfo import ZoneInfo

import requests as http
import qrcode
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request, send_file, session
from flask_cors import CORS
import mysql.connector
from mysql.connector import pooling
from mysql.connector.errors import PoolError
from werkzeug.security import check_password_hash
from admin_permissions import account_permissions, load_account, page_request_enabled, permits
from admin_security_api import security_blueprint
from nonorder_api import nonorder_blueprint, binding_blueprint
from approval_email import approval_email_blueprint, enqueue_approval_email
from archive_email import archive_email_blueprint
from config_approvals import config_approval_blueprint
from demand_calculation import demand_blueprint
from equipment import equipment_blueprint
from inventory_route_report import inventory_route_report_blueprint
from material_coding_category import material_coding_category_blueprint
from material_coding_cover import material_coding_cover_blueprint
from material_coding_export import material_coding_attachment, material_coding_export_blueprint
from material_coding_product_models import product_models_blueprint
from report_email_settings import report_email_settings_blueprint
from report_email_sender import check_smtp_connection, send_configured_report
from quantity_rules import quantity_rules_blueprint
from production_scheduling import build_schedule_preview, production_scheduling_blueprint
from process_archive_export import process_archive_attachment
from daily_station_tasks import daily_tasks_blueprint
from process_labor_report import build_process_labor_report
from completion_flow_report import (
    completed_order_lines,
    completed_order_options,
    completion_flow_report as read_completion_flow_report,
)

from dashboard_operations import (
    build_operations_snapshot,
    include_unreported_orders,
    load_operation_rows,
    tracked_order_rows,
)

from oidc_auth import (
    OidcAuthenticationError,
    OidcAuthenticator,
    OidcConfigurationError,
    OidcSettings,
)

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
_oidc_authenticator = OidcAuthenticator(OidcSettings.from_env())
_PUBLIC_GET_APIS = {
    "/api/mo/dashboard/operations",
}

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
    deadline = monotonic() + 5
    while True:
        try:
            return _pool.get_connection()
        except PoolError:
            remaining = deadline - monotonic()
            if remaining <= 0:
                raise
            sleep(min(0.05, remaining))


def _execution_qr_code(execution_id):
    target = (
        "https://api.quanshenghuoqin.com/jml/process/"
        f"?exec_id={execution_id}"
    )
    code = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=4,
    )
    code.add_data(target)
    code.make(fit=True)
    image = code.make_image(fill_color="black", back_color="white")
    output = BytesIO()
    image.save(output, format="PNG")
    return "image/png", output.getvalue()


app.register_blueprint(security_blueprint(lambda: db()))
app.register_blueprint(nonorder_blueprint(lambda: db()))
app.register_blueprint(binding_blueprint(lambda: db()))
app.register_blueprint(equipment_blueprint(lambda: db()))
app.register_blueprint(material_coding_category_blueprint(lambda: db()))
app.register_blueprint(material_coding_cover_blueprint(lambda: db()))
app.register_blueprint(material_coding_export_blueprint(lambda: db()))
app.register_blueprint(product_models_blueprint())
app.register_blueprint(quantity_rules_blueprint(lambda: db()))
app.register_blueprint(production_scheduling_blueprint(lambda: db()))
app.register_blueprint(daily_tasks_blueprint(
    lambda: db(),
    lambda now: _current_operations_snapshot(now, open_orders_loader=_daily_task_open_order_map),
))
app.register_blueprint(report_email_settings_blueprint(
    lambda: db(),
    app.secret_key,
    lambda report_key: send_configured_report(
        db, app.secret_key, build_report_attachment, report_key
    ),
    lambda: check_smtp_connection(db, app.secret_key),
))
app.register_blueprint(approval_email_blueprint(lambda: db(), app.secret_key))
app.register_blueprint(archive_email_blueprint(lambda: db(), app.secret_key, lambda key: build_archive_attachment(key)))


def _resolve_admin_access():
    """Reload status and grants on each request, not from cached Flask role values."""
    conn = db()
    cur = conn.cursor(dictionary=True)
    try:
        identity = g.oidc_identity
        if identity:
            account = load_account(cur, "oidc", identity.subject,
                issuer=_oidc_authenticator.settings.issuer_url,
                username=identity.username, display_name=identity.display_name,
                default_role="production-manager" if _oidc_authenticator.can_write(identity) else "viewer")
            g.admin_display_name = identity.display_name
        else:
            cur.execute("SELECT id,username,display_name,role,is_active FROM mo_admin_user_yx WHERE username=%s",
                (session.get("admin_username"),))
            user = cur.fetchone()
            if not user or not user["is_active"] or user["id"] != session.get("admin_user_id"):
                session.clear()
                return False
            account = load_account(cur, "session", user["id"], username=user["username"],
                display_name=user["display_name"] or user["username"],
                default_role="system-admin" if user["role"] == "admin" else "viewer")
            g.admin_display_name = user["display_name"] or user["username"]
            if account["session_version"] != session.get("admin_auth_version", 0):
                session.clear()
                return False
        g.admin_account = account
        g.admin_permissions, g.admin_roles = account_permissions(cur, account,
            platform_roles=identity.roles if identity else (),
            platform_can_write=_oidc_authenticator.can_write(identity) if identity else True)
        cur.execute("SELECT page_key FROM mo_admin_page_setting_yx WHERE is_enabled=0")
        g.disabled_pages = {row["page_key"] for row in cur.fetchall()}
        conn.commit()
        if not account["is_active"] and not identity:
            session.clear()
        return bool(account["is_active"])
    finally:
        cur.close()
        conn.close()


_DEFAULT_WORKER_DEPARTMENT_SCOPE = {661823215, 594600049}
_WORKER_DEPARTMENT_SCOPE_DDL = """
CREATE TABLE IF NOT EXISTS mo_worker_department_scope_yx (
    dept_id BIGINT NOT NULL,
    updated_by VARCHAR(100) DEFAULT NULL,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
"""


_AUDIT_ACTIONS = {
    "/api/admin/accounts/save": "配置后台账号失败",
    "/api/admin/accounts/password": "重置后台密码失败",
    "/api/admin/roles/save": "配置后台角色失败",
    "/api/admin/station-permissions/save": "配置工站人员失败",
    "/api/admin/station-permissions/settings/save": "设置工站权限开关失败",
    "/api/admin/station-permissions/exemptions/save": "配置工站豁免人员失败",
    "/api/admin/station-permissions/proxies/save": "配置工站代理人失败",
    "/api/admin/page-settings/save": "设置后台页面开关失败",
    "/api/admin/basic-settings/email-service/save": "设置邮件服务失败",
    "/api/admin/basic-settings/email-service/test": "测试邮件服务失败",
    "/api/admin/basic-settings/approval-email/save": "设置审批邮件失败",
    "/api/admin/basic-settings/approval-email/send-latest": "发送最近审批邮件失败",
    "/api/admin/basic-settings/approval-email/send-weekly": "发送审批每周清单失败",
    "/api/admin/report-email-settings/smtp/save": "设置报表SMTP失败",
    "/api/admin/report-email-settings/smtp/test": "测试报表SMTP失败",
    "/api/admin/report-email-settings/report/save": "设置报表发送规则失败",
    "/api/admin/report-email-settings/send": "手动发送报表邮件失败",
    "/api/admin/production-scheduling/calendar/save": "设置生产日历失败",
    "/api/admin/production-scheduling/calendar/import-holidays": "导入生产日历节假日失败",
    "/api/admin/production-scheduling/policy/save": "设置排程策略失败",
    "/api/admin/production-scheduling/handover/save": "设置工序交割失败",
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
    "/api/mo/production-label/print-log": "打印生产标签",
    "/api/mo/completion-flow-report/print-authorize": "打印工序完工报表",
    "/api/outsource/document-print/print-log": "打印委外单据",
    "/api/mo/worker-department-scope": "修改报工人员部门范围",
}
_SENSITIVE_KEY_PARTS = ("password", "token", "secret", "credential")


def _safe_request_data():
    data = deepcopy(request.get_json(silent=True) or {})

    def redact(value):
        if isinstance(value, dict):
            return {
                key: "***"
                if any(part in key.lower() for part in _SENSITIVE_KEY_PARTS)
                else redact(item)
                for key, item in value.items()
            }
        if isinstance(value, list):
            return [redact(item) for item in value]
        return value

    return redact(data)


def _audit_request_ip():
    remote_addr = request.remote_addr or ""
    if _oidc_authenticator.is_trusted_proxy(remote_addr):
        forwarded_for = request.headers.get("X-Forwarded-For", "")
        if forwarded_for:
            return forwarded_for.split(",", 1)[0].strip() or remote_addr
    return remote_addr


def _write_audit(response):
    if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return
    if request.path not in _AUDIT_ACTIONS:
        return
    security_request = request.path.startswith("/api/admin/")
    if security_request and response.status_code < 400:
        return  # Successful security changes are audited in their transaction.
    request_data = _safe_request_data()
    if security_request:
        allowed = {"id", "username", "display_name", "role_ids", "is_active", "code", "name", "permissions", "station_id", "leader_staff_id", "scanner_staff_ids", "staff_ids", "page_key", "is_enabled", "report_access_mode", "revision", "proxies", "version"}
        request_data = {key: value for key, value in request_data.items() if key in allowed} if isinstance(request_data, dict) else {}
    body = response.get_json(silent=True) or {}
    username = getattr(g, "audit_username", "") or request_data.get("username") or "unknown"
    result_code = body.get("code")
    if result_code is None:
        result_code = 0 if body.get("status") == "ok" and response.status_code < 400 else 1
    target_id = (
        request_data.get("id")
        or request_data.get("station_id")
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
                _audit_request_ip(),
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
    g.auth_source = "session" if session.get("admin_username") else ""
    g.oidc_identity = None
    g.audit_username = session.get("admin_username", "")
    if request.path in {"/healthz", "/readyz"}:
        return None
    if request.method == "OPTIONS":
        return None
    if request.method == "GET" and request.path in _PUBLIC_GET_APIS:
        return None

    if _oidc_authenticator.is_platform_request(request.remote_addr):
        try:
            identity = _oidc_authenticator.authenticate(
                request.remote_addr,
                request.headers,
            )
        except OidcConfigurationError:
            return jsonify({
                "success": False,
                "code": 503,
                "errorCode": 503,
                "errorMessage": "统一认证配置不完整",
                "msg": "统一认证配置不完整",
            }), 503
        except OidcAuthenticationError:
            return jsonify({
                "success": False,
                "code": 401,
                "errorCode": 401,
                "errorMessage": "统一认证校验失败",
                "msg": "统一认证校验失败",
            }), 401
        g.auth_source = "oidc"
        g.oidc_identity = identity
        g.audit_username = identity.username
        if request.path == "/api/login/account":
            return jsonify({"code": 409, "msg": "统一平台访问无需本地账号登录"}), 409
        if request.path == "/api/login/outLogin":
            return None
        if request.path.startswith("/api/") and not _oidc_authenticator.can_view(identity):
            return jsonify({"code": 403, "msg": "当前域账号没有生产系统访问权限"}), 403
        if (
            request.path.startswith("/api/")
            and request.method in {"POST", "PUT", "PATCH", "DELETE"}
            and not _oidc_authenticator.can_write(identity)
        ):
            return jsonify({"code": 403, "msg": "当前域账号只有查看权限"}), 403
    if request.path in {"/api/login/account", "/api/login/outLogin"}:
        return None
    protected_api = request.path.startswith("/api/")
    if protected_api and not g.oidc_identity and not session.get("admin_username"):
        return jsonify({
            "success": False,
            "code": 401,
            "errorCode": 401,
            "errorMessage": "登录已失效，请重新登录",
            "msg": "登录已失效，请重新登录",
        }), 401
    if protected_api:
        try:
            if not _resolve_admin_access():
                status = 403 if g.oidc_identity else 401
                return jsonify({"code": status, "msg": "账号已停用或登录已失效，请重新登录"}), status
        except Exception:
            app.logger.exception("Admin permission lookup failed for %s", request.path)
            return jsonify({"code": 503, "msg": "权限数据暂不可用，请先初始化后台权限表并检查数据库"}), 503
        if (
            request.path == "/api/mo/dashboard/schedule-preview"
            and getattr(g, "audit_username", "") != "admin"
        ):
            return jsonify({"code": 403, "msg": "工序进度暂仅限admin用户查看"}), 403
        if request.path != "/api/currentUser" and not permits(g.admin_permissions, request.path, request.method):
            return jsonify({"code": 403, "msg": "当前账号没有此功能的操作权限"}), 403
        if request.path != "/api/currentUser" and not page_request_enabled(
            getattr(g, "disabled_pages", set()),
            request.path,
            request.method,
            request.get_json(silent=True),
        ):
            return jsonify({"code": 403, "msg": "该页面已停用"}), 403
    return None


_APPROVAL_ONLY_PATHS = {
    "/api/mo/process/add",
    "/api/mo/process/update",
    "/api/mo/process/toggle",
    "/api/mo/workstation/add",
    "/api/mo/workstation/update",
    "/api/mo/workstation/toggle",
    "/api/mo/product-category/add",
    "/api/mo/product-category/update",
    "/api/mo/product-category/toggle",
    "/api/mo/route/add",
    "/api/mo/route/update",
    "/api/mo/route/toggle",
    "/api/mo/route/set-categories",
    "/api/mo/route/set-processes",
    "/api/mo/route/version/create",
    "/api/mo/route/version/restore",
}
_DISABLED_DELETE_PATHS = {
    "/api/mo/route/delete",
    "/api/mo/route/admin-authorize",
}


@app.before_request
def require_config_approval():
    if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return None
    if request.path in _DISABLED_DELETE_PATHS:
        return jsonify({"code": 409, "msg": "删除功能已停用"}), 409
    if request.path in _APPROVAL_ONLY_PATHS:
        return jsonify({"code": 409, "msg": "请通过审批中心提交变更申请"}), 409
    return None


@app.after_request
def audit_admin_write(response):
    _write_audit(response)
    return response


@app.get("/healthz")
def healthz():
    return jsonify({
        "status": "ok",
        "oidc_enabled": _oidc_authenticator.settings.enabled,
    })


@app.get("/readyz")
def readyz():
    if _oidc_authenticator.settings.validation_errors():
        return jsonify({"status": "not_ready", "check": "oidc_config"}), 503
    conn = None
    try:
        conn = db()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.fetchone()
        cur.close(); conn.close()
        conn = None
        return jsonify({"status": "ready"})
    except Exception:
        return jsonify({"status": "not_ready", "check": "database"}), 503
    finally:
        if conn:
            conn.close()


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
        account = load_account(cur, "session", user["id"], username=user["username"],
            display_name=user["display_name"] or user["username"],
            default_role="system-admin" if user["role"] == "admin" else "viewer")
        if not account["is_active"]:
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
        session["admin_auth_version"] = account["session_version"]
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
    if g.auth_source == "oidc" and g.oidc_identity:
        identity = g.oidc_identity
        return jsonify({
            "success": True,
            "data": {
                "name": identity.display_name,
                "username": identity.username,
                "userid": identity.subject,
                "access": "admin"
                if _oidc_authenticator.can_write(identity)
                else "viewer",
                "roles": sorted(identity.roles),
                "authSource": "oidc",
                "permissions": sorted(g.admin_permissions),
                "adminRoles": g.admin_roles,
                "adminAccountId": g.admin_account["id"],
                "disabledPages": sorted(getattr(g, "disabled_pages", set())),
            },
        })
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
            "name": g.admin_display_name,
            "username": username,
            "userid": str(session.get("admin_user_id") or ""),
            "access": "admin" if any(not p.endswith(".view") for p in g.admin_permissions) else "viewer",
            "roles": g.admin_roles,
            "authSource": "session",
            "permissions": sorted(g.admin_permissions),
            "adminRoles": g.admin_roles,
            "adminAccountId": g.admin_account["id"],
            "disabledPages": sorted(getattr(g, "disabled_pages", set())),
        },
    })


@app.post("/api/login/outLogin")
def admin_logout():
    if g.auth_source == "oidc" and g.oidc_identity:
        g.audit_username = g.oidc_identity.username
        return jsonify({
            "success": True,
            "data": {
                "redirectUrl": _oidc_authenticator.settings.platform_url,
                "authSource": "oidc",
            },
        })
    g.audit_username = session.get("admin_username", "")
    session.clear()
    return jsonify({"success": True, "data": {}})


@app.post("/api/mo/production-label/print-log")
def production_label_print_log():
    body = request.get_json(silent=True) or {}
    mo_code = str(body.get("mo_code") or "").strip()
    if not mo_code:
        return jsonify({"code": 1, "msg": "生产订单号不能为空"}), 400
    return jsonify({"code": 0, "msg": "打印操作已记录"})


@app.post("/api/mo/completion-flow-report/print-authorize")
def completion_flow_report_print_authorize():
    body = request.get_json(silent=True) or {}
    mo_code = str(body.get("mo_code") or "").strip()
    if not mo_code:
        return jsonify({"code": 1, "msg": "生产订单号不能为空"}), 400
    return jsonify({"code": 0, "msg": "允许打印"})


@app.post("/api/outsource/document-print/print-log")
def outsource_document_print_log():
    body = request.get_json(silent=True) or {}
    mo_code = str(body.get("mo_code") or "").strip()
    if not mo_code:
        return jsonify({"code": 1, "msg": "委外订单号不能为空"}), 400
    return jsonify({"code": 0, "msg": "打印操作已记录"})


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


app.register_blueprint(demand_blueprint(lambda: db(), lambda: u8_db()))
app.register_blueprint(inventory_route_report_blueprint(lambda: db(), lambda: u8_db()))


def _u8_error_message(exc, action="连接", document_name="生产标签"):
    message = str(exc)
    endpoint = U8_DB_CONFIG["server"]
    if U8_DB_CONFIG["port"]:
        endpoint = f"{endpoint}:{U8_DB_CONFIG['port']}"
    if any(code in message for code in ("HYT00", "HYT01", "08001")) or "timeout" in message.lower():
        if action == "查询":
            return f"已连接U8，但{document_name}SQL查询超时"
        return f"U8 SQL Server连接超时（{endpoint}），服务器未完成登录握手，请检查SQL Server实例和端口"
    if "28000" in message or "18456" in message:
        return "U8数据库账号或密码错误"
    if "4060" in message or "Cannot open database" in message:
        return f"U8账套数据库不存在或无权访问：{U8_DB_CONFIG['database']}"
    if action == "查询":
        return f"已连接U8，但{document_name}SQL查询失败，请查看webapi日志中的具体SQL错误"
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
    if isinstance(value, (list, tuple)):
        return [str(item).strip() for item in value if str(item or "").strip()]
    text = str(value or "").strip()
    if not text:
        return []
    if text.startswith("["):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [
                    str(item).strip()
                    for item in parsed
                    if str(item or "").strip()
                ]
        except (TypeError, ValueError):
            pass
    return [item.strip() for item in text.split(",") if item.strip()]


def _duration_seconds(start_time, end_time):
    if not start_time or not end_time:
        return None
    return max(0, int((end_time - start_time).total_seconds()))


def _product_info(row):
    if not row:
        return {
            "inv_code": "",
            "inv_name": "",
            "inv_std": "",
            "plan_qty": None,
            "product_category": "",
            "production_department": "",
            "plan_start_date": None,
            "plan_due_date": None,
            "original_start_date": None,
            "original_due_date": None,
            "so_code_008": "",
            "so_row_008": None,
            "source_account": "",
            "source_so_code": "",
            "customer_code": "",
            "customer_name": "",
            "is_closed": False,
        }
    return {
        "inv_code": row.get("InvCode_b") or row.get("inv_code") or "",
        "inv_name": row.get("cInvName") or row.get("inv_name") or "",
        "inv_std": row.get("cInvStd") or row.get("inv_std") or "",
        "plan_qty": row.get("Qty_b") if row.get("Qty_b") is not None else row.get("plan_qty"),
        "product_category": row.get("CategoryName") or "",
        "production_department": row.get("cDepName") or "",
        "plan_start_date": row.get("StartDate_c"),
        "plan_due_date": row.get("DueDate_c"),
        "original_start_date": row.get("OriginalStartDate") or row.get("original_start_date"),
        "original_due_date": row.get("OriginalDueDate") or row.get("original_due_date"),
        "so_code_008": row.get("SOCode008") or row.get("so_code_008") or "",
        "so_row_008": row.get("SORow008") if row.get("SORow008") is not None else row.get("so_row_008"),
        "source_account": row.get("SourceAccount") or row.get("source_account") or "",
        "source_so_code": row.get("SourceSOCode") or row.get("source_so_code") or "",
        "customer_code": row.get("CustomerCode") or row.get("customer_code") or "",
        "customer_name": row.get("CustomerName") or row.get("customer_name") or "",
        "is_closed": bool(row.get("CloseDate_b") or row.get("is_closed")),
    }


def _report_workorder_context(rows):
    """Read synchronized ERP context without making reporting depend on U8 availability."""
    keys = sorted({
        (str(row["mo_code"]), int(row["sort_seq"]))
        for row in rows
        if row.get("mo_code") is not None and row.get("sort_seq") is not None
    })
    if not keys:
        return {}

    conn = None
    cur = None
    result = {}
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        for offset in range(0, len(keys), 300):
            chunk = keys[offset:offset + 300]
            conditions = " OR ".join(
                ["(mo_code=%s AND sort_seq=%s)"] * len(chunk)
            )
            cur.execute(
                f"""
                SELECT mo_code,sort_seq,inv_code,inv_name,inv_std,plan_qty,
                       so_code_008,so_row_008,source_account,source_so_code,
                       customer_code,customer_name
                FROM mo_workorder_context_yx
                WHERE {conditions}
                """,
                [value for key in chunk for value in key],
            )
            for row in cur.fetchall():
                result[(str(row["mo_code"]), int(row["sort_seq"]))] = row
    except Exception:
        # Migration can be rolled out independently; reports keep their old behavior until then.
        app.logger.warning("work-order context table is not available", exc_info=True)
        return {}
    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()
    return result


def _merge_report_workorder_context(workorder_map, rows):
    context_map = _report_workorder_context(rows)
    for key, context in context_map.items():
        target = workorder_map.setdefault(key, {})
        for field, alias in (
            ("inv_code", "InvCode_b"),
            ("inv_name", "cInvName"),
            ("inv_std", "cInvStd"),
            ("plan_qty", "Qty_b"),
            ("so_code_008", "SOCode008"),
            ("so_row_008", "SORow008"),
            ("source_account", "SourceAccount"),
            ("source_so_code", "SourceSOCode"),
            ("customer_code", "CustomerCode"),
            ("customer_name", "CustomerName"),
        ):
            if context.get(field) is not None:
                target[alias] = context[field]
    return bool(context_map)


def _supplement_historical_workorder_info(workorder_map, rows):
    missing_keys = sorted({
        (str(row["mo_code"]), int(row["sort_seq"]))
        for row in rows
        if (str(row["mo_code"]), int(row["sort_seq"])) not in workorder_map
    })
    if not missing_keys:
        return True

    conn = None
    cur = None
    try:
        conn = u8_db()
        conn.timeout = 20
        cur = conn.cursor()
        conditions = " OR ".join(
            ["(a.MoCode_a=? AND a.SortSeq_b=?)"] * len(missing_keys)
        )
        params = [value for key in missing_keys for value in key]
        cur.execute(
            f"""
            SELECT
                a.MoCode_a, a.SortSeq_b,
                a.MDeptCode_b AS DeptCode, dp.cDepName,
                a.InvCode_b, inv.cInvName,
                LTRIM(RTRIM(inv.cInvDefine7)) AS CategoryName,
                a.Qty_b, a.MoDId_b, a.StartDate_c, a.DueDate_c
            FROM momlist_yx a
            LEFT JOIN Inventory inv ON a.InvCode_b=inv.cInvCode
            LEFT JOIN Department dp ON a.MDeptCode_b=dp.cDepCode
            WHERE a.RelsDate_b IS NOT NULL
              AND ({conditions})
            """,
            params,
        )
        for row in _u8_rows(cur):
            key = (str(row.get("MoCode_a") or ""), int(row.get("SortSeq_b") or 0))
            workorder_map[key] = row
        return True
    except Exception:
        app.logger.exception("historical workorder U8 query failed")
        return False
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
# 工单列表（代理到 moapi，避免前端跨域）
# ================================================================
@app.get("/api/mo/departments")
def departments():
    try:
        r = http.get(f"{MOAPI}/departments", timeout=10)
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []})


@app.get("/api/mo/worker-department-scope")
def worker_department_scope_get():
    conn = None
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute(_WORKER_DEPARTMENT_SCOPE_DDL)
        cur.execute("""
            SELECT dept_id,parent_dept_id,dept_name,dept_level,dept_path
            FROM ding_department_yx
            WHERE is_active=1
            ORDER BY dept_path
        """)
        departments = cur.fetchall()
        cur.execute("SELECT dept_id FROM mo_worker_department_scope_yx ORDER BY dept_id")
        selected = [int(row["dept_id"]) for row in cur.fetchall()]
        configured = bool(selected)
        if not configured:
            active_ids = {int(row["dept_id"]) for row in departments}
            selected = sorted(_DEFAULT_WORKER_DEPARTMENT_SCOPE & active_ids)
        conn.commit()
        cur.close(); conn.close()
        conn = None
        return jsonify({
            "code": 0,
            "data": {
                "departments": [_ser(row) for row in departments],
                "selected_dept_ids": selected,
                "configured": configured,
            },
        })
    except Exception:
        return jsonify({"code": 1, "msg": str(exc), "data": None})
    finally:
        if conn:
            conn.close()


@app.post("/api/mo/worker-department-scope")
def worker_department_scope_save():
    data = request.get_json(silent=True) or {}
    raw_ids = data.get("dept_ids")
    if not isinstance(raw_ids, list):
        return jsonify({"code": 1, "msg": "dept_ids必须是数组"})
    try:
        dept_ids = sorted({int(value) for value in raw_ids})
    except (TypeError, ValueError):
        return jsonify({"code": 1, "msg": "部门ID格式不正确"})
    if not dept_ids:
        return jsonify({"code": 1, "msg": "请至少选择一个部门"})
    if any(dept_id <= 1 for dept_id in dept_ids):
        return jsonify({"code": 1, "msg": "不能选择通讯录根部门"})

    conn = None
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute(_WORKER_DEPARTMENT_SCOPE_DDL)
        placeholders = ",".join(["%s"] * len(dept_ids))
        cur.execute(
            f"SELECT dept_id FROM ding_department_yx "
            f"WHERE is_active=1 AND dept_id IN ({placeholders})",
            tuple(dept_ids),
        )
        active_ids = {int(row["dept_id"]) for row in cur.fetchall()}
        missing = [dept_id for dept_id in dept_ids if dept_id not in active_ids]
        if missing:
            cur.close(); conn.close()
            conn = None
            return jsonify({"code": 1, "msg": "所选部门不存在或已停用，请刷新后重试"})

        cur.execute("DELETE FROM mo_worker_department_scope_yx")
        cur.executemany(
            "INSERT INTO mo_worker_department_scope_yx (dept_id,updated_by) VALUES (%s,%s)",
            [(dept_id, g.audit_username or "unknown") for dept_id in dept_ids],
        )
        conn.commit()
        cur.close(); conn.close()
        conn = None
        return jsonify({"code": 0, "msg": "保存成功", "data": {"selected_dept_ids": dept_ids}})
    except Exception as exc:
        if conn:
            conn.rollback()
        return jsonify({"code": 1, "msg": str(exc)})
    finally:
        if conn:
            conn.close()


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
    b.Remark AS remark,
    b.MoLotCode AS lot_code
FROM mom_order a
LEFT JOIN mom_orderdetail b ON a.MoId = b.MoId
LEFT JOIN mom_morder c ON b.ModId = c.MoDId
LEFT JOIN Inventory inv ON inv.cInvCode = b.InvCode
LEFT JOIN Department dp ON b.MDeptCode = dp.cDepCode
LEFT JOIN UFSystem..UA_User u1 ON a.CreateUser = u1.cUser_Id
LEFT JOIN UFSystem..UA_User u2 ON u2.cUser_Id = b.RelsUser
LEFT JOIN UFSystem..GC_SynergismTaskLog u3 ON b.OrderCode = u3.cVoucherNo
LEFT JOIN UFSystem..GC_SynergismTaskLog u4 ON u3.FatherId = u4.AutoId AND u4.bMainTask = 1
LEFT JOIN UFDATA_001_2021..SO_SOMain u8 ON u4.cVoucherNo = u8.cSOCode
WHERE a.MoCode = ?
  AND b.RelsTime IS NOT NULL
ORDER BY b.SortSeq ASC
"""


PRODUCTION_MATERIAL_SQL = """
SELECT
    b.SortSeq AS order_line_no,
    ma.SortSeq AS material_line_no,
    ma.InvCode AS material_code,
    inv.cInvName AS material_name,
    inv.cInvStd AS material_std,
    unit.cComUnitName AS unit_name,
    wh.cWhName AS warehouse_name,
    ma.LotNo AS lot_no,
    ma.Qty AS qty_required
FROM mom_order a
JOIN mom_orderdetail b ON a.MoId = b.MoId
JOIN mom_moallocate ma ON b.MoDId = ma.MoDId
LEFT JOIN Inventory inv ON inv.cInvCode = ma.InvCode
LEFT JOIN ComputationUnit unit ON unit.cComunitCode = inv.cComUnitCode
LEFT JOIN Warehouse wh ON wh.cWhCode = ma.WhCode
WHERE a.MoCode = ?
  AND b.RelsTime IS NOT NULL
ORDER BY b.SortSeq ASC, ma.SortSeq ASC
"""


@app.get("/api/mo/production-label/options")
def production_label_options():
    keyword = (request.args.get("keyword") or "").strip()
    if not keyword:
        return jsonify({"code": 0, "data": []})
    conn = None
    cur = None
    try:
        conn = u8_db()
        conn.timeout = 20
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT TOP 20 a.MoCode AS mo_code
            FROM mom_order a
            JOIN mom_orderdetail b ON a.MoId = b.MoId
            WHERE a.MoCode LIKE ?
              AND b.RelsTime IS NOT NULL
            ORDER BY a.MoCode DESC
        """, (f"%{keyword}%",))
        rows = _u8_rows(cur)
        return jsonify({"code": 0, "data": [row["mo_code"] for row in rows]})
    except Exception as e:
        action = "查询" if conn is not None else "连接"
        app.logger.exception("production label option U8 %s failed for %s", action, keyword)
        return jsonify({"code": 1, "msg": _u8_error_message(e, action), "data": []})
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


@app.get("/api/mo/completion-flow-report/options")
def completion_flow_report_options():
    keyword = str(request.args.get("keyword") or "").strip()
    if not keyword:
        return jsonify({"code": 0, "data": []})
    conn = None
    try:
        conn = db()
        return jsonify({"code": 0, "data": completed_order_options(conn, keyword)})
    except Exception:
        app.logger.exception("completion flow report options failed for %s", keyword)
        return jsonify({"code": 1, "msg": "生产订单查询失败", "data": []}), 500
    finally:
        if conn is not None:
            conn.close()


@app.get("/api/mo/completion-flow-report/lines")
def completion_flow_report_lines():
    mo_code = str(request.args.get("mo_code") or "").strip()
    if not mo_code:
        return jsonify({"code": 1, "msg": "生产订单号不能为空", "data": []}), 400
    conn = None
    try:
        conn = db()
        return jsonify({"code": 0, "data": completed_order_lines(conn, mo_code)})
    except Exception:
        app.logger.exception("completion flow report lines failed for %s", mo_code)
        return jsonify({"code": 1, "msg": "生产订单行查询失败", "data": []}), 500
    finally:
        if conn is not None:
            conn.close()


@app.get("/api/mo/completion-flow-report")
def completion_flow_report():
    mo_code = str(request.args.get("mo_code") or "").strip()
    sort_seq_value = request.args.get("sort_seq")
    sort_seq = None
    if sort_seq_value not in (None, ""):
        try:
            sort_seq = int(sort_seq_value)
        except (TypeError, ValueError):
            return jsonify({"code": 1, "msg": "生产订单行号格式错误"}), 400
        if sort_seq <= 0:
            return jsonify({"code": 1, "msg": "生产订单行号格式错误"}), 400
    if not mo_code:
        return jsonify({"code": 1, "msg": "生产订单号不能为空"}), 400
    conn = None
    try:
        conn = db()
        line_numbers = (
            [sort_seq]
            if sort_seq is not None
            else [row["sort_seq"] for row in completed_order_lines(conn, mo_code)]
        )
        data = [
            report
            for line_no in line_numbers
            for report in [read_completion_flow_report(conn, mo_code, line_no)]
            if report is not None
        ]
        if not data:
            return jsonify({
                "code": 0,
                "msg": "该生产订单暂无末工序已完成的工单行",
                "data": [],
            })
        return jsonify({"code": 0, "data": data})
    except Exception:
        app.logger.exception("completion flow report failed for %s/%s", mo_code, sort_seq)
        return jsonify({"code": 1, "msg": "工序完工报表读取失败"}), 500
    finally:
        if conn is not None:
            conn.close()


def _production_label_process_routes(mo_code, line_nos):
    workorder_info, _ = _workorder_info_map()
    conn = db()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT b.sort_seq, b.route_id
            FROM mo_wo_route_yx b
            WHERE b.mo_code=%s
        """, (mo_code,))
        bound_routes = {
            str(row["sort_seq"]): row["route_id"]
            for row in cur.fetchall()
        }

        cur.execute("""
            SELECT TRIM(pc.name) AS category_name, r.id AS route_id
            FROM bj_product_cost_yx pc
            JOIN mo_product_route_yx pr ON pr.product_code=pc.code
            JOIN mo_route_yx r ON r.id=pr.route_id
            WHERE pc.is_enabled=1 AND r.is_active=1
        """)
        category_routes = {
            (row["category_name"] or "").strip(): row["route_id"]
            for row in cur.fetchall()
        }

        line_routes = {}
        for line_no in line_nos:
            line_key = str(line_no)
            workorder = workorder_info.get((mo_code, int(line_no or 0))) or {}
            category_name = (workorder.get("CategoryName") or "").strip()
            line_routes[line_key] = bound_routes.get(line_key) or category_routes.get(
                category_name
            )

        route_ids = sorted({route_id for route_id in line_routes.values() if route_id})
        route_processes = {}
        if route_ids:
            placeholders = ",".join(["%s"] * len(route_ids))
            cur.execute(f"""
                SELECT s.route_id, p.process_name
                FROM mo_route_step_yx s
                JOIN mo_process_yx p ON p.id=s.process_id
                WHERE s.route_id IN ({placeholders})
                ORDER BY s.route_id, s.seq
            """, route_ids)
            for row in cur.fetchall():
                route_processes.setdefault(row["route_id"], []).append(
                    row["process_name"]
                )

        return {
            line_key: " → ".join(route_processes.get(route_id, []))
            for line_key, route_id in line_routes.items()
        }
    finally:
        cur.close()
        conn.close()


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
        cur.execute(PRODUCTION_MATERIAL_SQL, (mo_code,))
        material_rows = _u8_rows(cur)

        try:
            process_routes = _production_label_process_routes(
                mo_code, [row.get("line_no") for row in rows]
            )
        except Exception:
            app.logger.exception("production label route query failed for %s", mo_code)
            return jsonify({"code": 1, "msg": "工艺路线查询失败", "data": None})

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
                "customer_name": r.get("customer_name"),
                "process_route": process_routes.get(str(line_no)),
                "remark": r.get("remark"),
                "qr_value": json.dumps({"mocode": mo_code, "sortseq": line_no}, ensure_ascii=False),
            })
        materials = [
            {
                "order_line_no": row.get("order_line_no"),
                "material_line_no": row.get("material_line_no"),
                "material_code": row.get("material_code"),
                "material_name": row.get("material_name"),
                "material_std": row.get("material_std"),
                "unit_name": row.get("unit_name"),
                "warehouse_name": row.get("warehouse_name"),
                "lot_no": row.get("lot_no"),
                "qty_required": row.get("qty_required"),
            }
            for row in material_rows
        ]
        return jsonify({
            "code": 0,
            "data": {"header": header, "lines": lines, "materials": materials},
        })
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
# 委外单据打印（只读 U8 委外订单与用料清单，包含未审核及已关闭单据）
# ================================================================
OUTSOURCE_ORDER_SQL = """
SELECT
    h.cCode AS mo_code,
    h.MODetailsID AS detail_id,
    h.iVouchRowNo AS line_no,
    m.dDate AS order_date,
    dp.cDepName AS dept_name,
    ven.cVenName AS vendor_name,
    h.cInvCode AS inv_code,
    h.cInvName AS inv_name,
    h.cInvStd AS inv_std,
    h.cInvM_Unit AS unit_name,
    h.iQuantity AS qty,
    h.dStartDate AS start_date,
    h.dArriveDate AS due_date,
    CASE
        WHEN LEFT(h.cInvCode, 1) = N'1' THEN N'成品'
        WHEN LEFT(h.cInvCode, 1) = N'2' THEN N'半成品'
        ELSE N''
    END AS product_category,
    h.cbMemo AS remark,
    m.cMaker AS create_user,
    m.cVerifier AS audit_user,
    m.dVerifyDate AS audit_time
FROM dbo.om_momaterialshead AS h
JOIN dbo.OM_MOMain AS m ON m.MOID = h.MOID
LEFT JOIN dbo.Department AS dp ON dp.cDepCode = m.cDepCode
LEFT JOIN dbo.Vendor AS ven ON ven.cVenCode = m.cVenCode
WHERE h.cCode = ?
ORDER BY h.iVouchRowNo, h.MODetailsID
"""


OUTSOURCE_MATERIAL_SQL = """
SELECT
    h.MODetailsID AS detail_id,
    h.iVouchRowNo AS order_line_no,
    ma.MOMaterialsID AS material_id,
    ROW_NUMBER() OVER (
        PARTITION BY h.MODetailsID ORDER BY ma.MOMaterialsID
    ) AS material_line_no,
    ma.cInvCode AS material_code,
    inv.cInvName AS material_name,
    inv.cInvStd AS material_std,
    unit.cComUnitName AS unit_name,
    wh.cWhName AS warehouse_name,
    ma.cBatch AS lot_no,
    ma.iQuantity AS qty_required
FROM dbo.om_momaterialshead AS h
JOIN dbo.OM_MOMain AS m ON m.MOID = h.MOID
JOIN dbo.OM_MOMaterials AS ma
    ON ma.MoDetailsID = h.MODetailsID AND ma.MOID = h.MOID
LEFT JOIN dbo.Inventory AS inv ON inv.cInvCode = ma.cInvCode
LEFT JOIN dbo.ComputationUnit AS unit ON unit.cComunitCode = inv.cComUnitCode
LEFT JOIN dbo.Warehouse AS wh ON wh.cWhCode = ma.cWhCode
WHERE h.cCode = ?
ORDER BY h.iVouchRowNo, h.MODetailsID, ma.MOMaterialsID
"""


@app.get("/api/outsource/document-print/options")
def outsource_document_print_options():
    keyword = (request.args.get("keyword") or "").strip()
    if not keyword:
        return jsonify({"code": 0, "data": []})
    conn = None
    cur = None
    try:
        conn = u8_db()
        conn.timeout = 20
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT TOP 20 h.cCode AS mo_code
            FROM dbo.om_momaterialshead AS h
            JOIN dbo.OM_MOMain AS m ON m.MOID = h.MOID
            WHERE h.cCode LIKE ?
            ORDER BY h.cCode DESC
        """, (f"%{keyword}%",))
        return jsonify({"code": 0, "data": [row["mo_code"] for row in _u8_rows(cur)]})
    except Exception as e:
        action = "查询" if conn is not None else "连接"
        app.logger.exception("outsource document option U8 %s failed for %s", action, keyword)
        return jsonify({"code": 1, "msg": _u8_error_message(e, action, "委外单据"), "data": []})
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


@app.get("/api/outsource/document-print")
def outsource_document_print():
    mo_code = (request.args.get("mo_code") or "").strip()
    if not mo_code:
        return jsonify({"code": 1, "msg": "委外订单号不能为空", "data": None})
    conn = None
    cur = None
    try:
        conn = u8_db()
        conn.timeout = 20
        cur = conn.cursor()
        cur.execute(OUTSOURCE_ORDER_SQL, (mo_code,))
        rows = _u8_rows(cur)
        if not rows:
            return jsonify({"code": 1, "msg": "未找到委外订单", "data": None})
        cur.execute(OUTSOURCE_MATERIAL_SQL, (mo_code,))
        materials = _u8_rows(cur)

        first = rows[0]
        start_dates = [row["start_date"] for row in rows if row.get("start_date")]
        due_dates = [row["due_date"] for row in rows if row.get("due_date")]
        categories = list(dict.fromkeys(
            row["product_category"] for row in rows if row.get("product_category")
        ))
        header = {
            "mo_code": first.get("mo_code"),
            "dept_name": first.get("dept_name"),
            "vendor_name": first.get("vendor_name"),
            "order_date": first.get("order_date"),
            "product_category": "、".join(categories),
            "start_date": min(start_dates) if start_dates else None,
            "due_date": max(due_dates) if due_dates else None,
            "create_user": first.get("create_user"),
            "audit_user": first.get("audit_user"),
            "audit_time": first.get("audit_time"),
            "approved": bool(first.get("audit_time")),
            "total_qty": sum(float(row.get("qty") or 0) for row in rows),
        }
        line_fields = (
            "line_no", "detail_id", "inv_code", "inv_name", "inv_std", "qty",
            "unit_name", "start_date", "due_date", "remark",
        )
        lines = [{key: row.get(key) for key in line_fields} for row in rows]
        return jsonify({
            "code": 0,
            "data": {"header": header, "lines": lines, "materials": materials},
        })
    except Exception as e:
        action = "查询" if conn is not None else "连接"
        app.logger.exception("outsource document U8 %s failed for %s", action, mo_code)
        return jsonify({"code": 1, "msg": _u8_error_message(e, action, "委外单据"), "data": None})
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
def _include_pending_config(cur, module, rows, keyword=""):
    if request.args.get("include_pending") != "1":
        return rows
    cur.execute("""SELECT id,request_no,action_type,target_key,after_data,status,
               applicant_account_id,applicant_name,apply_time,revision
        FROM mo_config_approval_yx
        WHERE module_type=%s AND (
            status='pending' OR (
                status='rejected' AND applicant_account_id=%s
                AND action_type IN ('create','edit')
            )
        )
        ORDER BY id DESC""", (module, g.admin_account["id"]))
    pending_rows = cur.fetchall()
    key_field = "code" if module == "category" else "id"
    existing = {str(row[key_field]): row for row in rows}
    for approval in pending_rows:
        payload = approval["after_data"]
        if isinstance(payload, str):
            payload = json.loads(payload)
        marker = {
            "approval_status": approval["status"],
            "approval_id": approval["id"],
            "approval_request_no": approval["request_no"],
            "approval_action": approval["action_type"],
            "approval_applicant": approval["applicant_name"],
            "approval_payload": payload,
            "approval_revision": approval["revision"],
            "approval_can_edit": approval["applicant_account_id"] == g.admin_account["id"],
        }
        if approval["action_type"] != "create":
            target = existing.get(str(approval["target_key"]))
            if target:
                target.update(marker)
            continue
        if module == "process":
            row = {
                "id": -approval["id"],
                "process_code": payload.get("process_code", ""),
                "process_name": payload.get("process_name", ""),
                "description": payload.get("description") or "",
                "sort": int(payload.get("sort") or 0),
                "is_active": 0,
                "create_time": approval["apply_time"],
                **marker,
            }
            if keyword and keyword.lower() not in f"{row['process_code']} {row['process_name']}".lower():
                continue
        elif module == "workstation":
            row = {
                "id": -approval["id"],
                "station_code": payload.get("station_code", ""),
                "station_name": payload.get("station_name", ""),
                "description": payload.get("description") or "",
                "is_active": 0,
                "create_time": approval["apply_time"],
                "update_time": approval["apply_time"],
                **marker,
            }
        elif module == "category":
            row = {
                "code": "待分配",
                "name": payload.get("name", ""),
                "is_enabled": 0,
                "created_at": approval["apply_time"],
                "updated_at": approval["apply_time"],
                **marker,
            }
        else:
            product_codes = payload.get("product_codes") or []
            row = {
                "id": -approval["id"],
                "route_code": payload.get("route_code", ""),
                "route_name": payload.get("route_name", ""),
                "dept_code": payload.get("dept_code", ""),
                "description": payload.get("description") or "",
                "version_note": payload.get("version_note") or "",
                "version_no": 1,
                "product_codes": product_codes,
                "product_names": "、".join(product_codes),
                "is_active": 0,
                "is_default": int(bool(payload.get("is_default"))),
                "is_current": 0,
                "usage_count": 0,
                **marker,
            }
        rows.append(row)
    return rows


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
        rows = _include_pending_config(cur, "process", cur.fetchall(), keyword)
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
        rows = _include_pending_config(cur, "workstation", cur.fetchall())
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
        version_filter = "1=1" if request.args.get("all_versions") == "1" else "r.is_current=1"
        cur.execute(f"""
            SELECT r.*,
                   (SELECT GROUP_CONCAT(pr.product_code ORDER BY pr.product_code)
                    FROM mo_product_route_yx pr WHERE pr.route_id=r.id) AS default_product_codes,
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
            WHERE {version_filter}
            GROUP BY r.id
            ORDER BY r.dept_code ASC,r.version_group ASC,r.version_no DESC,r.id DESC
        """)
        rows = cur.fetchall()
        for row in rows:
            row['product_codes'] = row['product_codes'].split(',') if row['product_codes'] else []
            row['default_product_codes'] = row['default_product_codes'].split(',') if row['default_product_codes'] else []
        rows = _include_pending_config(cur, "route", rows)
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


# 工艺档案沿用 2026-10-13「整行停用标记」版 Excel 的序号，按编码对应。
_ARCHIVE_STATION_CODES = (
    "1", "2", "9.4", "12",
    "WS-AUTO-0C523AD3CCE0", "WS-AUTO-2B683A82CAAF", "WS-AUTO-4DD58CF6477C",
    "WS-AUTO-8A3E8C40A9F5", "WS-AUTO-8FA2A49DB531", "WS-AUTO-9F117BABB8E5",
    "WS-AUTO-38DEFCE627D2", "WS-AUTO-58DD04512980", "WS-AUTO-69F294392BE1",
    "WS-AUTO-235CDF45B97F", "WS-AUTO-307BACFEE3E8", "WS-AUTO-583A487D2FAD",
    "WS-AUTO-634DEE972B8A", "WS-AUTO-34969B779A8C", "WS-AUTO-5534865DF031",
    "WS-AUTO-570326491E58", "WS-AUTO-983736934A4A", "WS-AUTO-B9FA9727B450",
    "WS-AUTO-B337AFF57C1F", "WS-AUTO-C0C9706CE92A", "WS-AUTO-C07575FC5164",
    "WS-AUTO-EB0D16D442B0", "WS-AUTO-F7E004BCD0EE",
    "WS-DJJ", "WS-XBQ", "WS-xxiubian", "WS-YJ",
)
_ARCHIVE_PROCESS_CODES = (
    "d", "tuihong", "1", "122", "9.4", "11", "12", "YT-01",
    "AUTO-8A3E8C40A9F5", "AUTO-235CDF45B97F", "AUTO-5534865DF031",
    "DJ-01", "AUTO-C07575FC5164", "XB-01", "AUTO-B337AFF57C1F",
    "AUTO-EB0D16D442B0", "AUTO-9F117BABB8E5", "AUTO-38DEFCE627D2",
    "AUTO-F7E004BCD0EE", "xiubian-01", "AUTO-69F294392BE1",
    "AUTO-307BACFEE3E8", "MPXB", "AUTO-583A487D2FAD", "AUTO-8FA2A49DB531",
    "AUTO-B9FA9727B450", "AUTO-570326491E58", "AUTO-2B683A82CAAF",
    "AUTO-4DD58CF6477C", "BMYCL", "CYBBDY", "AUTO-634DEE972B8A",
    "AUTO-983736934A4A", "AUTO-0C523AD3CCE0", "AUTO-34969B779A8C",
)


def _number_archive_rows(rows, legacy_codes):
    legacy_numbers = {code.casefold(): number for number, code in enumerate(legacy_codes, 1)}
    next_number = len(legacy_codes) + 1
    for row in rows:
        number = legacy_numbers.get(row.pop("code").casefold())
        if number is None:
            number = next_number
            next_number += 1
        row["sequence"] = number
    return sorted(rows, key=lambda row: (not row["active"], row["sequence"]))


def _read_process_archive():
    permissions = g.admin_permissions
    disabled = g.disabled_pages
    sections = [module for module in ("route", "workstation", "process")
                if f"{module}.view" in permissions and module not in disabled]
    if not sections:
        return None
    with db() as conn:
        conn.start_transaction(consistent_snapshot=True, isolation_level="REPEATABLE READ", readonly=True)
        with conn.cursor(dictionary=True) as cur:
            data = {}
            if "route" in sections:
                cur.execute("""SELECT code,name,is_enabled AS active FROM bj_product_cost_yx
                    ORDER BY CAST(code AS UNSIGNED),code""")
                categories = {row["code"]: {**row, "versions": {}} for row in cur.fetchall()}
                cur.execute("""WITH category_routes AS (
                        SELECT category.code AS product_code, version.route_id
                        FROM mo_route_version_category_yx version
                        JOIN bj_product_cost_yx category ON category.code=version.product_code
                        UNION
                        SELECT category.code, binding.route_id
                        FROM mo_product_route_yx binding
                        JOIN bj_product_cost_yx category ON category.code=binding.product_code
                    )
                    SELECT links.product_code, route.id, route.route_name AS name,
                        COALESCE(route.version_no,1) AS version_no, route.is_active AS active,
                        binding.route_id IS NOT NULL AS is_default, operation.process_name
                    FROM mo_route_yx route
                    LEFT JOIN category_routes links ON links.route_id=route.id
                    LEFT JOIN mo_product_route_yx binding
                        ON binding.product_code=links.product_code AND binding.route_id=route.id
                    LEFT JOIN mo_route_step_yx step ON step.route_id=route.id
                    LEFT JOIN mo_process_yx operation ON operation.id=step.process_id
                    ORDER BY route.is_active DESC, route.version_group, route.version_no, route.id, step.seq, step.id""")
                for row in cur.fetchall():
                    code = row["product_code"]
                    if code is None:
                        categories.setdefault(None, {"code": None, "name": "未关联产品类别",
                                                     "active": True, "versions": {}})
                    versions = categories[code]["versions"]
                    route_id = row["id"]
                    if route_id not in versions:
                        versions[route_id] = {key: row[key] for key in ("id", "name", "version_no", "active", "is_default")}
                        versions[route_id]["steps"] = []
                    if row["process_name"]:
                        versions[route_id]["steps"].append(row["process_name"])
                data["route"] = sorted(
                    ({**row, "versions": list(row["versions"].values())} for row in categories.values()),
                    key=lambda row: not row["active"],
                )
            if "workstation" in sections:
                cur.execute("""SELECT id,station_code AS code,station_name AS name,is_active AS active
                    FROM mo_workstation_yx ORDER BY id""")
                data["workstation"] = _number_archive_rows(cur.fetchall(), _ARCHIVE_STATION_CODES)
            if "process" in sections:
                cur.execute("""SELECT id,process_code AS code,process_name AS name,is_active AS active,description
                    FROM mo_process_yx ORDER BY id""")
                data["process"] = _number_archive_rows(cur.fetchall(), _ARCHIVE_PROCESS_CODES)

            data["last_modified_date"] = "2026-10-13"
            data["approvals"] = None
            if sections:
                marks = ",".join(["%s"] * len(sections))
                approved = f"status='approved' AND review_time IS NOT NULL AND module_type IN ({marks})"
                cur.execute(f"SELECT DATE(MAX(review_time)) AS last_modified FROM mo_config_approval_yx WHERE {approved}", sections)
                latest = cur.fetchone()["last_modified"]
                if latest:
                    data["last_modified_date"] = latest.isoformat()

                approvable = [module for module in sections if f"{module}.approve" in permissions]
                access_checks, params = [], list(sections)
                if approvable:
                    module_marks = ",".join(["%s"] * len(approvable))
                    access_checks.append(f"module_type IN ({module_marks})")
                    params.extend(approvable)
                if "approval.mine" in permissions:
                    access_checks.append("applicant_account_id=%s")
                    params.append(g.admin_account["id"])
                if access_checks and "approval" not in disabled:
                    cur.execute(f"""SELECT request_no,module_type,action_type,applicant_name,reviewer_name,review_time,
                            COALESCE(
                              NULLIF(after_data->>'$.route_name',''), NULLIF(after_data->>'$.station_name',''),
                              NULLIF(after_data->>'$.process_name',''), NULLIF(before_data->>'$.route_name',''),
                              NULLIF(before_data->>'$.station_name',''), NULLIF(before_data->>'$.process_name',''),
                              target_key) AS target_name,
                            after_data->>'$.is_active' AS target_active
                        FROM mo_config_approval_yx WHERE {approved} AND ({' OR '.join(access_checks)})
                        ORDER BY review_time DESC,id DESC""", params)
                    data["approvals"] = [_ser(row) for row in cur.fetchall()]
        conn.rollback()
    return data


@app.get("/api/mo/process-archive")
def process_archive():
    data = _read_process_archive()
    if data is None:
        return jsonify({"code": 403, "msg": "当前账号没有可查看的工艺档案"}), 403
    return jsonify({"code": 0, "data": data})


def build_archive_attachment(key):
    if key == "archive-material-coding":
        return material_coding_attachment(db)
    data = _read_process_archive()
    if data is None:
        raise ValueError("当前账号没有可查看的工艺档案")
    return process_archive_attachment(data)


@app.get("/api/mo/process-archive/export")
def export_process_archive():
    try:
        filename, content = build_archive_attachment("archive-process")
    except ValueError as error:
        return jsonify({"code": 403, "msg": str(error)}), 403
    response = send_file(BytesIO(content), as_attachment=True, download_name=filename,
                         mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", max_age=0)
    response.cache_control.private = True
    return response


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
        rows = _include_pending_config(cur, "category", cur.fetchall())
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
    return jsonify({"code": 409, "msg": "删除功能已停用"}), 409


@app.post("/api/mo/route/delete")
def route_delete():
    return jsonify({"code": 409, "msg": "删除功能已停用"}), 409


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
        cur.execute("""SELECT mo_code,sort_seq FROM mo_execution_yx
            UNION SELECT mo_code,sort_seq FROM mo_wo_state_yx
            UNION SELECT mo_code,sort_seq FROM mo_handover_yx""")
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


def _build_workorder_trace_rows(
    workorders, bindings, states, executions, category_routes, routes, route_steps
):
    """Combine ERP order lines with the route actually selected by reporting."""
    binding_map = {
        int(row["sort_seq"]): int(row["route_id"])
        for row in bindings
        if row.get("route_id") is not None
    }
    state_map = {int(row["sort_seq"]): row for row in states}
    executions_by_line = {}
    for row in executions:
        executions_by_line.setdefault(int(row["sort_seq"]), []).append(row)

    result = []
    for workorder in workorders:
        sort_seq = int(workorder.get("SortSeq_b") or 0)
        state = state_map.get(sort_seq)
        line_executions = executions_by_line.get(sort_seq, [])
        latest_execution = max(
            line_executions,
            key=lambda row: int(row.get("id") or 0),
            default=None,
        )
        category_name = (workorder.get("CategoryName") or "").strip()

        route_id = None
        route_source = ""
        if state and state.get("route_id") is not None:
            route_id = int(state["route_id"])
            route_source = "actual"
        elif latest_execution and latest_execution.get("route_id") is not None:
            route_id = int(latest_execution["route_id"])
            route_source = "actual"
        elif sort_seq in binding_map:
            route_id = binding_map[sort_seq]
            route_source = "manual"
        elif category_name in category_routes:
            route_id = int(category_routes[category_name])
            route_source = "category"

        route = routes.get(route_id, {}) if route_id else {}
        steps = route_steps.get(route_id, []) if route_id else []
        route_executions = [
            row for row in line_executions
            if not route_id or int(row.get("route_id") or 0) == route_id
        ]
        done_sequences = {
            int(row["seq"])
            for row in route_executions
            if row.get("status") == "done" and row.get("seq") is not None
        }
        processing_sequences = [
            int(row["seq"])
            for row in route_executions
            if row.get("status") == "processing" and row.get("seq") is not None
        ]

        if not route_id:
            status = "unassigned"
        elif state and state.get("status") == "done":
            status = "done"
        elif processing_sequences:
            status = "processing"
        elif state or route_executions:
            status = "pending"
        else:
            status = "not_started"

        current_seq = None
        if status not in {"done", "unassigned"}:
            if state and state.get("current_seq") is not None:
                current_seq = int(state["current_seq"])
            elif processing_sequences:
                current_seq = processing_sequences[0]
            elif done_sequences:
                remaining = [
                    int(step["seq"])
                    for step in steps
                    if int(step["seq"]) not in done_sequences
                ]
                current_seq = remaining[0] if remaining else None
            elif steps:
                current_seq = int(steps[0]["seq"])

        trace_steps = []
        for step in steps:
            seq = int(step["seq"])
            if status == "done" or seq in done_sequences:
                step_state = "done"
            elif current_seq == seq:
                step_state = "current"
            else:
                step_state = "pending"
            trace_steps.append({
                "seq": seq,
                "process_name": step.get("process_name") or "",
                "station_name": step.get("station_name") or "",
                "state": step_state,
            })

        current_index = next(
            (index for index, step in enumerate(trace_steps) if step["seq"] == current_seq),
            None,
        )
        current_process = (
            trace_steps[current_index]["process_name"]
            if current_index is not None else ""
        )
        next_process = (
            trace_steps[current_index + 1]["process_name"]
            if current_index is not None and current_index + 1 < len(trace_steps)
            else ""
        )
        result.append({
            "mo_code": str(workorder.get("MoCode_a") or ""),
            "sort_seq": sort_seq,
            "dept_code": workorder.get("DeptCode") or "",
            "production_department": workorder.get("cDepName") or "",
            "inv_code": workorder.get("InvCode_b") or "",
            "inv_name": workorder.get("cInvName") or "",
            "product_category": category_name,
            "plan_qty": float(workorder.get("Qty_b") or 0),
            "plan_start_date": workorder.get("StartDate_c"),
            "plan_due_date": workorder.get("DueDate_c"),
            "route_id": route_id,
            "route_name": route.get("route_name") or "",
            "route_source": route_source,
            "status": status,
            "current_seq": current_seq,
            "current_process": current_process,
            "next_process": next_process,
            "done_process_count": len({step["seq"] for step in trace_steps if step["state"] == "done"}),
            "process_count": len(trace_steps),
            "steps": trace_steps,
        })
    return result


@app.get("/api/mo/workorder-trace/search")
def workorder_trace_search():
    mo_code = (request.args.get("mo_code") or "").strip().upper()
    if not mo_code:
        return jsonify({"code": 1, "msg": "请输入生产订单号", "data": []})
    if len(mo_code) > 60 or not re.fullmatch(r"[A-Z0-9_-]+", mo_code):
        return jsonify({"code": 1, "msg": "生产订单号格式不正确", "data": []})

    u8_conn = None
    u8_cur = None
    try:
        u8_conn = u8_db()
        u8_conn.timeout = 20
        u8_cur = u8_conn.cursor()
        u8_cur.execute("""
            SELECT
                a.MoCode_a, a.SortSeq_b,
                a.MDeptCode_b AS DeptCode, dp.cDepName,
                a.InvCode_b, inv.cInvName,
                LTRIM(RTRIM(inv.cInvDefine7)) AS CategoryName,
                a.Qty_b, a.MoDId_b, a.StartDate_c, a.DueDate_c
            FROM momlist_yx a
            LEFT JOIN Inventory inv ON a.InvCode_b=inv.cInvCode
            LEFT JOIN Department dp ON a.MDeptCode_b=dp.cDepCode
            WHERE a.RelsDate_b IS NOT NULL AND a.MoCode_a=?
            ORDER BY a.SortSeq_b
        """, (mo_code,))
        workorders = _u8_rows(u8_cur)
    except Exception as exc:
        action = "查询" if u8_conn is not None else "连接"
        app.logger.exception("workorder trace U8 %s failed for %s", action, mo_code)
        return jsonify({
            "code": 1,
            "msg": _u8_error_message(exc, action, "工单路线"),
            "data": [],
        })
    finally:
        if u8_cur is not None:
            try:
                u8_cur.close()
            except Exception:
                pass
        if u8_conn is not None:
            try:
                u8_conn.close()
            except Exception:
                pass

    if not workorders:
        return jsonify({"code": 1, "msg": "未找到已审核生产订单", "data": []})

    conn = None
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT sort_seq,route_id FROM mo_wo_route_yx WHERE mo_code=%s
        """, (mo_code,))
        bindings = cur.fetchall()
        cur.execute("""
            SELECT sort_seq,route_id,current_seq,status
            FROM mo_wo_state_yx WHERE mo_code=%s
        """, (mo_code,))
        states = cur.fetchall()
        cur.execute("""
            SELECT id,sort_seq,route_id,seq,status,start_time,end_time
            FROM mo_execution_yx WHERE mo_code=%s ORDER BY id
        """, (mo_code,))
        executions = cur.fetchall()
        cur.execute("""
            SELECT TRIM(pc.name) AS category_name,r.id AS route_id
            FROM bj_product_cost_yx pc
            JOIN mo_product_route_yx pr ON pr.product_code=pc.code
            JOIN mo_route_yx r ON r.id=pr.route_id
            WHERE pc.is_enabled=1 AND r.is_active=1
        """)
        category_routes = {
            (row["category_name"] or "").strip(): int(row["route_id"])
            for row in cur.fetchall()
            if (row["category_name"] or "").strip()
        }

        route_ids = {
            int(row["route_id"])
            for rows in (bindings, states, executions)
            for row in rows
            if row.get("route_id") is not None
        }
        route_ids.update(category_routes.values())
        routes = {}
        route_steps = {}
        if route_ids:
            marks = ",".join(["%s"] * len(route_ids))
            params = sorted(route_ids)
            cur.execute(
                f"SELECT id,route_name,dept_name FROM mo_route_yx WHERE id IN ({marks})",
                params,
            )
            routes = {int(row["id"]): row for row in cur.fetchall()}
            cur.execute(f"""
                SELECT s.route_id,s.seq,p.process_name,
                       COALESCE(MIN(w.station_name),'') AS station_name
                FROM mo_route_step_yx s
                LEFT JOIN mo_process_yx p ON p.id=s.process_id
                LEFT JOIN mo_step_station_yx ss ON ss.step_id=s.id
                LEFT JOIN mo_workstation_yx w ON w.id=ss.station_id
                WHERE s.route_id IN ({marks})
                GROUP BY s.route_id,s.seq,p.process_name
                ORDER BY s.route_id,s.seq
            """, params)
            for row in cur.fetchall():
                route_steps.setdefault(int(row["route_id"]), []).append(row)
        cur.close()
        conn.close()
        conn = None

        rows = _build_workorder_trace_rows(
            workorders, bindings, states, executions,
            category_routes, routes, route_steps,
        )
        return jsonify({"code": 0, "data": [_ser(row) for row in rows]})
    except Exception:
        app.logger.exception("workorder trace query failed for %s", mo_code)
        return jsonify({"code": 1, "msg": "工单路线查询失败", "data": []}), 500
    finally:
        if conn is not None:
            conn.close()


def _assert_selectable_route(cur, route_id):
    cur.execute("SELECT id FROM mo_route_yx WHERE id=%s AND is_active=1 FOR UPDATE", (route_id,))
    if not cur.fetchone():
        raise ValueError("路线版本不存在或已停用，请重新选择")


def _assert_workorder_route_changeable(cur, mo_code, sort_seq):
    for table in ("mo_wo_state_yx", "mo_execution_yx", "mo_handover_yx"):
        cur.execute(f"SELECT route_id FROM {table} WHERE mo_code=%s AND sort_seq=%s LIMIT 1 FOR UPDATE",
            (mo_code, sort_seq))
        if cur.fetchone():
            raise ValueError(f"{mo_code} 第{sort_seq}行已接收或开工，不能更换路线版本")


@app.post("/api/mo/wo-route/set")
def wo_route_set():
    d = request.get_json() or {}
    mo_code  = (d.get("mo_code") or "").strip()
    sort_seq = d.get("sort_seq")
    route_id = d.get("route_id")
    if not mo_code or sort_seq is None or not route_id:
        return jsonify({"code": 1, "msg": "参数不完整"})
    conn = None
    try:
        conn = db()
        cur = conn.cursor()
        _assert_selectable_route(cur, route_id)
        _assert_workorder_route_changeable(cur, mo_code, sort_seq)
        cur.execute("""
            INSERT INTO mo_wo_route_yx (mo_code, sort_seq, route_id)
            VALUES (%s,%s,%s)
            ON DUPLICATE KEY UPDATE route_id=%s
        """, (mo_code, sort_seq, route_id, route_id))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "指定成功"})
    except Exception as e:
        if conn:
            conn.rollback(); conn.close()
        return jsonify({"code": 1, "msg": str(e)})


@app.post("/api/mo/wo-route/remove")
def wo_route_remove():
    d = request.get_json() or {}
    mo_code  = (d.get("mo_code") or "").strip()
    sort_seq = d.get("sort_seq")
    if not mo_code or sort_seq is None:
        return jsonify({"code": 1, "msg": "参数不完整"})
    conn = None
    try:
        conn = db()
        cur = conn.cursor()
        _assert_workorder_route_changeable(cur, mo_code, sort_seq)
        cur.execute("DELETE FROM mo_wo_route_yx WHERE mo_code=%s AND sort_seq=%s", (mo_code, sort_seq))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "已取消指定"})
    except Exception as e:
        if conn:
            conn.rollback(); conn.close()
        return jsonify({"code": 1, "msg": str(e)})


@app.post("/api/mo/wo-route/set-batch")
def wo_route_set_batch():
    d = request.get_json() or {}
    route_id = d.get("route_id")
    items = d.get("items", [])
    if not route_id or not items:
        return jsonify({"code": 1, "msg": "参数不完整"})
    conn = None
    try:
        conn = db()
        cur = conn.cursor()
        _assert_selectable_route(cur, route_id)
        for item in items:
            _assert_workorder_route_changeable(cur, item["mo_code"], item["sort_seq"])
        for item in items:
            cur.execute("""
                INSERT INTO mo_wo_route_yx (mo_code, sort_seq, route_id)
                VALUES (%s,%s,%s)
                ON DUPLICATE KEY UPDATE route_id=%s
            """, (item["mo_code"], item["sort_seq"], route_id, route_id))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"code": 0, "msg": f"已批量指定 {len(items)} 条"})
    except Exception as e:
        if conn:
            conn.rollback(); conn.close()
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
            MAX(CASE WHEN status='done' THEN end_time END) AS end_time,
            SUM(status='done') AS done_process_count,
            GROUP_CONCAT(
                DISTINCT NULLIF(complete_operator_name, '')
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
    JOIN (
        SELECT route_id, COUNT(*) AS process_count
        FROM mo_route_step_yx
        GROUP BY route_id
    ) route_summary ON route_summary.route_id=ws.route_id
    JOIN mo_execution_yx final_exec
      ON final_exec.mo_code=ws.mo_code
     AND final_exec.sort_seq=ws.sort_seq
     AND final_exec.route_id=ws.route_id
     AND final_exec.status='done'
     AND final_exec.end_time=summary.end_time
     AND final_exec.id=(
         SELECT MAX(latest_exec.id)
         FROM mo_execution_yx latest_exec
         WHERE latest_exec.mo_code=ws.mo_code
           AND latest_exec.sort_seq=ws.sort_seq
           AND latest_exec.route_id=ws.route_id
           AND latest_exec.status='done'
           AND latest_exec.end_time=summary.end_time
     )
    WHERE final_exec.status='done'
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


@app.get("/api/mo/completed-workorder/qr-code")
def completed_workorder_qr_code():
    execution_id = request.args.get("execution_id", type=int)
    if not execution_id or execution_id < 1:
        return jsonify({"code": 1, "msg": "完工记录编号无效"})
    conn = None
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT id FROM mo_execution_yx WHERE id=%s", (execution_id,))
        if not cur.fetchone():
            return jsonify({"code": 1, "msg": "未找到完工记录"})
        mime_type, image = _execution_qr_code(execution_id)
        encoded = base64.b64encode(image).decode("ascii")
        return jsonify({
            "code": 0,
            "data": {"image_data_url": f"data:{mime_type};base64,{encoded}"},
        })
    except RuntimeError as exc:
        return jsonify({"code": 1, "msg": str(exc)})
    finally:
        if conn:
            conn.close()


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
                ws.mo_code, ws.sort_seq, ws.route_id, ws.status AS workorder_status,
                r.route_name, r.dept_name,
                summary.start_time, summary.end_time,
                TIMESTAMPDIFF(
                    SECOND, summary.start_time, summary.end_time
                ) AS duration_seconds,
                route_summary.process_count, summary.done_process_count,
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
        historical_data_available = _supplement_historical_workorder_info(
            workorder_map, rows
        )
        context_data_available = _merge_report_workorder_context(
            workorder_map, rows
        )
        product_data_available = (
            product_data_available
            or historical_data_available
            or context_data_available
        )
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
    include_active = request.args.get("include_active") == "1"

    conn = None
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        if include_active:
            cur.execute("""
                SELECT route_id,status FROM mo_wo_state_yx
                WHERE mo_code=%s AND sort_seq=%s
            """, (mo_code, sort_seq))
            active_state = cur.fetchone()
            if not active_state:
                cur.execute("""
                    SELECT route_id,'pending' AS status FROM mo_handover_yx
                    WHERE mo_code=%s AND sort_seq=%s ORDER BY id DESC LIMIT 1
                """, (mo_code, sort_seq))
                active_state = cur.fetchone()
            if active_state:
                cur.execute("""
                    SELECT %s AS mo_code,%s AS sort_seq,r.id AS route_id,
                           %s AS workorder_status,r.route_name,r.dept_name,
                           summary.start_time,summary.end_time,
                           TIMESTAMPDIFF(SECOND,summary.start_time,summary.end_time) AS duration_seconds,
                           (SELECT COUNT(*) FROM mo_route_step_yx s WHERE s.route_id=r.id) AS process_count,
                           summary.done_process_count,COALESCE(summary.operator_names,'') AS operator_names,
                           summary.reason_count,summary.max_qty_c,
                           final_exec.id AS final_execution_id,
                           final_exec.process_name AS final_process_name,
                           final_exec.qty_done,final_exec.qty_a,final_exec.qty_a1,
                           final_exec.qty_a2,final_exec.qty_c,
                           (SELECT COUNT(*) FROM mo_execution_print_log_yx p
                            WHERE p.execution_id=final_exec.id) AS print_count
                    FROM mo_route_yx r
                    LEFT JOIN (
                        SELECT route_id,MIN(start_time) AS start_time,MAX(end_time) AS end_time,
                               SUM(status='done') AS done_process_count,
                               GROUP_CONCAT(DISTINCT NULLIF(complete_operator_name,'') ORDER BY seq SEPARATOR '、') AS operator_names,
                               SUM(complete_reason IS NOT NULL AND complete_reason!='') AS reason_count,
                               MAX(qty_c) AS max_qty_c
                        FROM mo_execution_yx WHERE mo_code=%s AND sort_seq=%s GROUP BY route_id
                    ) summary ON summary.route_id=r.id
                    LEFT JOIN mo_execution_yx final_exec ON final_exec.id=(
                        SELECT e.id FROM mo_execution_yx e
                        WHERE e.mo_code=%s AND e.sort_seq=%s AND e.route_id=r.id
                        ORDER BY e.seq DESC,e.id DESC LIMIT 1
                    )
                    WHERE r.id=%s
                """, (mo_code, sort_seq, active_state["status"], mo_code, sort_seq,
                      mo_code, sort_seq, active_state["route_id"]))
                summary = cur.fetchone()
            else:
                summary = None
        else:
            cur.execute(
                f"""
            SELECT
                ws.mo_code, ws.sort_seq, ws.route_id, ws.status AS workorder_status,
                r.route_name, r.dept_name,
                summary.start_time, summary.end_time,
                TIMESTAMPDIFF(
                    SECOND, summary.start_time, summary.end_time
                ) AS duration_seconds,
                route_summary.process_count, summary.done_process_count,
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
            return jsonify({"code": 1, "msg": "未找到工单报工记录" if include_active else "未找到已完工工单记录"})

        route_id = summary["route_id"]
        cur.execute(
            f"""
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
              {"" if include_active else "AND execution.status='done'"}
            ORDER BY execution.seq ASC, execution.id ASC
            """,
            (mo_code, sort_seq, route_id),
        )
        executions = cur.fetchall()
        execution_ids = [row["id"] for row in executions]

        worker_map = {}
        completion_map = {}
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
                SELECT id, execution_id, qty_a, qty_a1, qty_a2, qty_c,
                       qty_done, reason, photo_url, quality_report_photo_urls,
                       operator_name, is_final, complete_time
                FROM mo_execution_completion_yx
                WHERE execution_id IN ({marks})
                ORDER BY complete_time ASC, id ASC
                """,
                execution_ids,
            )
            for row in cur.fetchall():
                item = _ser(row)
                for field in ("qty_a", "qty_a1", "qty_a2", "qty_c", "qty_done"):
                    item[field] = float(item.get(field) or 0)
                item["quality_report_photos"] = _photo_urls(
                    row.get("quality_report_photo_urls")
                )
                item["photos"] = (
                    []
                    if item["quality_report_photos"]
                    else _photo_urls(row.get("photo_url"))
                )
                item.pop("photo_url", None)
                item.pop("quality_report_photo_urls", None)
                completion_map.setdefault(row["execution_id"], []).append(item)

            cur.execute(
                f"""
                SELECT
                    id, execution_id, process_name, qty_input,
                    qty_input_a, qty_input_a1, qty_input_a2,
                    qty_a, qty_a1, qty_a2, qty_c,
                    qty_before, qty_ref, reason, operator_name,
                    photo_url, complete_photo_url,
                    status, start_time, end_time
                FROM mo_receive_work_yx
                WHERE execution_id IN ({marks})
                ORDER BY start_time ASC, id ASC
                """,
                execution_ids,
            )
            receive_rows = cur.fetchall()
            receive_rows_by_execution = {}
            for row in receive_rows:
                receive_rows_by_execution.setdefault(row["execution_id"], []).append(row)
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
                    "qty_a", "qty_a1", "qty_a2", "qty_c", "qty_before", "qty_ref",
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
                SELECT execution_id, qty_before
                FROM mo_makeup_record_yx
                WHERE execution_id IN ({marks})
                ORDER BY id ASC
                """,
                execution_ids,
            )
            first_makeup_qty = {}
            for row in cur.fetchall():
                first_makeup_qty.setdefault(
                    row["execution_id"], float(row["qty_before"] or 0)
                )

            cur.execute(
                f"""
                SELECT
                    execution.id AS execution_id,
                    handover.id, handover.qty_out,
                    handover.qty_in, handover.qty_in_a,
                    handover.qty_in_a1, handover.qty_in_a2,
                    handover.receipt_reason, handover.operator_in,
                    handover.receive_photo_url, handover.confirm_time
                FROM mo_execution_yx execution
                JOIN mo_handover_yx handover
                  ON handover.mo_code=execution.mo_code
                 AND handover.sort_seq=execution.sort_seq
                 AND handover.route_id=execution.route_id
                 AND handover.to_seq=execution.seq
                WHERE execution.id IN ({marks})
                ORDER BY handover.id DESC
                """,
                execution_ids,
            )
            initial_handover_map = {}
            for row in cur.fetchall():
                initial_handover_map.setdefault(row["execution_id"], row)

            for execution_id, handover in initial_handover_map.items():
                current_qty = float(handover.get("qty_in") or 0)
                if current_qty <= 0:
                    continue
                initial_qty = first_makeup_qty.get(execution_id, current_qty)
                completed_receives = [
                    row for row in receive_rows_by_execution.get(execution_id, [])
                    if row["status"] == "done"
                ]
                initial_a = max(0, float(handover.get("qty_in_a") or 0) - sum(
                    float(row.get("qty_input_a") or 0) for row in completed_receives
                ))
                initial_a1 = max(0, float(handover.get("qty_in_a1") or 0) - sum(
                    float(row.get("qty_input_a1") or 0) for row in completed_receives
                ))
                initial_a2 = max(0, float(handover.get("qty_in_a2") or 0) - sum(
                    float(row.get("qty_input_a2") or 0) for row in completed_receives
                ))
                if initial_a + initial_a1 + initial_a2 <= 0:
                    initial_a = initial_qty

                initial_record = {
                    "id": f"handover-{handover['id']}",
                    "status": "received",
                    "operator_name": handover.get("operator_in"),
                    "workers": worker_map.get(execution_id, []),
                    "qty_input": initial_qty,
                    "qty_input_a": initial_a,
                    "qty_input_a1": initial_a1,
                    "qty_input_a2": initial_a2,
                    "qty_a": 0,
                    "qty_a1": 0,
                    "qty_a2": 0,
                    "qty_c": 0,
                    "qty_before": 0,
                    "qty_ref": float(handover.get("qty_out") or 0),
                    "reason": handover.get("receipt_reason"),
                    "start_time": _ser(handover).get("confirm_time"),
                    "end_time": None,
                    "duration_seconds": None,
                    "photos": _photo_urls(handover.get("receive_photo_url")),
                    "complete_photos": [],
                    "is_initial": True,
                }
                receive_map[execution_id] = [
                    initial_record,
                    *receive_map.get(execution_id, []),
                ]

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
            rework_completion_map = {}
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
                cur.execute(
                    f"""
                    SELECT id, rework_id, qty_a, qty_a1, qty_a2, qty_c,
                           qty_done, remark, photo_url, quality_report_photo_urls,
                           operator_name, is_final, complete_time
                    FROM mo_rework_completion_yx
                    WHERE rework_id IN ({rework_marks})
                    ORDER BY complete_time ASC, id ASC
                    """,
                    rework_ids,
                )
                for completion in cur.fetchall():
                    completion_item = _ser(completion)
                    for field in ("qty_a", "qty_a1", "qty_a2", "qty_c", "qty_done"):
                        completion_item[field] = float(
                            completion_item.get(field) or 0
                        )
                    completion_item["quality_report_photos"] = _photo_urls(
                        completion.get("quality_report_photo_urls")
                    )
                    completion_item["photos"] = (
                        []
                        if completion_item["quality_report_photos"]
                        else _photo_urls(completion.get("photo_url"))
                    )
                    completion_item.pop("photo_url", None)
                    completion_item.pop("quality_report_photo_urls", None)
                    rework_completion_map.setdefault(
                        completion["rework_id"], []
                    ).append(completion_item)
            for row in rework_rows:
                item = _ser(row)
                for field in ("qty_input", "qty_a", "qty_a1", "qty_a2", "qty_c"):
                    item[field] = float(item.get(field) or 0)
                item["workers"] = rework_worker_map.get(row["id"], [])
                item["photos"] = _photo_urls(row["photo_url"])
                item["complete_photos"] = _photo_urls(row["complete_photo_url"])
                item["completion_records"] = rework_completion_map.get(row["id"], [])
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
            item["completion_records"] = completion_map.get(row["id"], [])
            item.pop("start_photo_url", None)
            item.pop("complete_photo_url", None)
            process_rows.append(item)

        workorder_map, product_data_available = _workorder_info_map()
        historical_data_available = _supplement_historical_workorder_info(
            workorder_map, [summary]
        )
        context_data_available = _merge_report_workorder_context(
            workorder_map, [summary]
        )
        product_data_available = (
            product_data_available
            or historical_data_available
            or context_data_available
        )
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
PANEL_SQUARE_METERS_PER_SHEET = 5.5


def _dashboard_product_context(rows):
    """Batch ERP product/issued-material lookup, including closed orders."""
    keys = sorted({(str(row["mo_code"]), int(row["sort_seq"])) for row in rows})
    if not keys:
        return {}, []
    products = {}
    conn = None
    cur = None
    warnings = []
    erp_lookup_ok = False
    erp_found_keys = set()
    try:
        conn = u8_db()
        conn.timeout = 20
        cur = conn.cursor()
        # Stay well below SQL Server's parameter limit as tracking grows.
        for offset in range(0, len(keys), 400):
            chunk = keys[offset:offset + 400]
            conditions = " OR ".join(["(a.MoCode_a=? AND a.SortSeq_b=?)"] * len(chunk))
            cur.execute(f"""
                SELECT a.MoCode_a,a.SortSeq_b,a.InvCode_b,a.CloseDate_b,inv.cInvName,
                       a.OrderCode_b AS SOCode008,a.OrderSeq_b AS SORow008,
                       inv.cInvStd,unit.cComUnitName AS unit_name,
                       a.Qty_b,a.StartDate_c,a.DueDate_c,
                       original_plan.StartDate AS OriginalStartDate,
                       original_plan.DueDate AS OriginalDueDate,dp.cDepName,
                       LTRIM(RTRIM(inv.cInvDefine7)) AS CategoryName,
                       panel_lines.material_json AS panel_material_json,
                       panel_area.required_area AS panel_required_area,
                       panel_area.issued_area AS panel_issued_area,
                       materials.issued_qty AS first_issued_qty,
                       materials.calc_mode AS first_issue_calc_mode,
                       materials.material_line_count AS first_issue_material_count,
                       bottleneck.InvCode AS first_issue_bottleneck_inv_code,
                       bottleneck.required_qty AS first_issue_bottleneck_required_qty,
                       bottleneck.issued_qty AS first_issue_bottleneck_issued_qty,
                       bottleneck.receipt_ratio AS first_issue_bottleneck_ratio
                FROM momlist_yx a
                LEFT JOIN Inventory inv ON inv.cInvCode=a.InvCode_b
                LEFT JOIN Department dp ON dp.cDepCode=a.MDeptCode_b
                LEFT JOIN ComputationUnit unit ON unit.cComunitCode=inv.cComUnitCode
                OUTER APPLY (
                    SELECT TOP 1 snapshot.StartDate,snapshot.DueDate
                    FROM YX_TEST.dbo.mom_morder snapshot
                    WHERE snapshot.MoDId=a.MoDId_b
                      AND LTRIM(RTRIM(snapshot.zt))='008'
                    ORDER BY CASE WHEN snapshot.UpdateTime IS NULL THEN 0 ELSE 1 END,
                             snapshot.UpdateTime
                ) original_plan
                OUTER APPLY (
                    SELECT CASE WHEN LTRIM(RTRIM(a.MDeptCode_b))='04125' THEN (
                        SELECT LTRIM(RTRIM(ma.InvCode)) AS sub_code, inv_mat.cInvName AS sub_name,
                               ma.Qty AS qty_plan,
                               CASE WHEN ma.IssQty>0 THEN ma.IssQty ELSE 0 END AS qty_issued
                        FROM dbo.mom_moallocate ma
                        LEFT JOIN dbo.Inventory inv_mat ON inv_mat.cInvCode=ma.InvCode
                        WHERE ma.MoDId=a.MoDId_b AND LEFT(LTRIM(RTRIM(ma.InvCode)),4)='4402'
                        ORDER BY ma.SortSeq, ma.AllocateId
                        FOR JSON PATH, INCLUDE_NULL_VALUES
                    ) END AS material_json
                ) panel_lines
                OUTER APPLY (
                    SELECT CAST(SUM(line.qty_plan) AS decimal(28,8)) AS required_area,
                           CAST(SUM(line.qty_issued) AS decimal(28,8)) AS issued_area
                    FROM OPENJSON(panel_lines.material_json)
                    WITH (qty_plan decimal(28,8), qty_issued decimal(28,8)) line
                ) panel_area
                OUTER APPLY (
                    SELECT ROUND(panel_area.issued_area / {PANEL_SQUARE_METERS_PER_SHEET},4) AS issued_qty
                ) panel_issue
                OUTER APPLY (
                    SELECT CASE
                        WHEN LTRIM(RTRIM(a.MDeptCode_b))='04125' THEN panel_issue.issued_qty
                        WHEN SUM(CASE WHEN
                            LEFT(LTRIM(RTRIM(ma.InvCode)),1) IN ('1','2')
                            OR LEFT(LTRIM(RTRIM(ma.InvCode)),2)='31'
                        THEN 1 ELSE 0 END)>0
                        THEN SUM(CASE WHEN ma.IssQty>0 AND (
                            LEFT(LTRIM(RTRIM(ma.InvCode)),1) IN ('1','2')
                            OR LEFT(LTRIM(RTRIM(ma.InvCode)),2)='31'
                        ) THEN ma.IssQty ELSE 0 END)
                        WHEN SUM(CASE WHEN ma.Qty>0 THEN 1 ELSE 0 END)>0
                             AND a.Qty_b>0
                        THEN a.Qty_b * MIN(CASE WHEN ma.Qty>0 THEN
                            CASE
                                WHEN COALESCE(ma.IssQty,0)<=0 THEN 0
                                WHEN ma.IssQty>=ma.Qty THEN 1
                                ELSE CAST(ma.IssQty AS decimal(28,10))
                                     / NULLIF(CAST(ma.Qty AS decimal(28,10)),0)
                            END
                        END)
                        ELSE NULL
                    END AS issued_qty,
                    CASE
                        WHEN LTRIM(RTRIM(a.MDeptCode_b))='04125' THEN 'panel_area'
                        WHEN SUM(CASE WHEN
                            LEFT(LTRIM(RTRIM(ma.InvCode)),1) IN ('1','2')
                            OR LEFT(LTRIM(RTRIM(ma.InvCode)),2)='31'
                        THEN 1 ELSE 0 END)>0
                        THEN 'controlled_sum'
                        WHEN SUM(CASE WHEN ma.Qty>0 THEN 1 ELSE 0 END)>0
                             AND a.Qty_b>0
                        THEN 'bom_ratio'
                        ELSE NULL
                    END AS calc_mode,
                    SUM(CASE WHEN ma.Qty>0 THEN 1 ELSE 0 END) AS material_line_count
                    FROM mom_moallocate ma
                    WHERE ma.MoDId=a.MoDId_b
                ) materials
                OUTER APPLY (
                    SELECT TOP 1
                        LTRIM(RTRIM(ma.InvCode)) AS InvCode,
                        ma.Qty AS required_qty,
                        CASE WHEN COALESCE(ma.IssQty,0)>0 THEN ma.IssQty ELSE 0 END AS issued_qty,
                        ratio.receipt_ratio
                    FROM mom_moallocate ma
                    CROSS APPLY (
                        SELECT CASE
                            WHEN COALESCE(ma.IssQty,0)<=0 THEN 0
                            WHEN ma.IssQty>=ma.Qty THEN 1
                            ELSE CAST(ma.IssQty AS decimal(28,10))
                                 / NULLIF(CAST(ma.Qty AS decimal(28,10)),0)
                        END AS receipt_ratio
                    ) ratio
                    WHERE ma.MoDId=a.MoDId_b
                      AND ma.Qty>0
                      AND materials.calc_mode='bom_ratio'
                    ORDER BY ratio.receipt_ratio, LTRIM(RTRIM(ma.InvCode))
                ) bottleneck
                WHERE a.RelsDate_b IS NOT NULL AND ({conditions})
            """, [value for key in chunk for value in key])
            for row in _u8_rows(cur):
                key = (str(row["MoCode_a"]), int(row["SortSeq_b"]))
                erp_found_keys.add(key)
                products[key] = {
                    **_product_info(row),
                    "inv_std": row.get("cInvStd") or "",
                    "unit_name": row.get("unit_name") or "未标单位",
                    "first_issued_qty": row.get("first_issued_qty"),
                    "first_issue_calculation": {
                        "mode": "bom_ratio",
                        "material_count": row.get("first_issue_material_count"),
                        "bottleneck_inv_code": row.get("first_issue_bottleneck_inv_code"),
                        "bottleneck_required_qty": row.get("first_issue_bottleneck_required_qty"),
                        "bottleneck_issued_qty": row.get("first_issue_bottleneck_issued_qty"),
                        "bottleneck_ratio": row.get("first_issue_bottleneck_ratio"),
                    } if row.get("first_issue_calc_mode") == "bom_ratio" else (
                        {
                            "mode": "panel_area",
                            "square_meters_per_sheet": PANEL_SQUARE_METERS_PER_SHEET,
                            "required_area": row.get("panel_required_area"),
                            "issued_area": row.get("panel_issued_area"),
                            "materials": json.loads(row.get("panel_material_json") or "[]"),
                        } if row.get("first_issue_calc_mode") == "panel_area" else None
                    ),
                }
        erp_lookup_ok = True
    except Exception:
        app.logger.exception("dashboard ERP context lookup failed")
        warnings.append("ERP实时资料查询未完成；未核对的首站可接收量显示为待核对，不影响查看报工记录。")
        cached, _available = _workorder_info_map()
        for key in keys:
            if key not in products and key in cached:
                products[key] = {
                    **_product_info(cached[key]),
                    "first_issued_qty": None,
                    "unit_name": "未标单位",
                }
    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()
    context_map = _report_workorder_context(rows)
    for key, context in context_map.items():
        context_product = _product_info(context)
        if key not in products:
            products[key] = {
                **context_product,
                "first_issued_qty": None,
                "unit_name": "未标单位",
            }
            continue
        for field in (
            "so_code_008", "so_row_008", "source_account", "source_so_code",
            "customer_code", "customer_name",
        ):
            if key in erp_found_keys and field in ("so_code_008", "so_row_008"):
                continue
            products[key][field] = context_product[field]
    if erp_lookup_ok:
        for key in keys:
            if key not in products:
                products[key] = {
                    **_product_info(None),
                    "first_issued_qty": None,
                    "unit_name": "未标单位",
                }
            products[key]["erp_deleted"] = key not in erp_found_keys
    return products, warnings


def _daily_task_open_order_map():
    """Only discover open lines here; the snapshot subsequently reads full ERP context."""
    conn = cur = None
    try:
        conn = u8_db()
        cur = conn.cursor()
        cur.execute('''SELECT MoCode_a,SortSeq_b FROM momlist_yx
            WHERE RelsDate_b IS NOT NULL AND CloseDate_b IS NULL''')
        return {(str(row['MoCode_a']), int(row['SortSeq_b'])): row
                for row in _u8_rows(cur)}, True
    except Exception:
        app.logger.warning('daily task open-order lookup failed; using existing workorder source')
        return _workorder_info_map()
    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()


def _current_operations_snapshot(now, open_orders_loader=None):
    conn = None
    try:
        conn = db()
        conn.start_transaction(isolation_level="REPEATABLE READ", consistent_snapshot=True, readonly=True)
        data = load_operation_rows(conn, now)
        conn.rollback()
        conn.close()
        conn = None
        open_orders, open_orders_available = (open_orders_loader or _workorder_info_map)()
        candidates = tracked_order_rows(data) + [
            {"mo_code": key[0], "sort_seq": key[1]}
            for key in open_orders
        ]
        products, warnings = _dashboard_product_context(candidates)
        for key in open_orders:
            open_product = _product_info(open_orders[key])
            product = products.setdefault(key, {
                **open_product,
                "first_issued_qty": None,
                "unit_name": "未标单位",
            })
            for field in (
                "so_code_008", "so_row_008", "source_account",
                "source_so_code", "customer_code", "customer_name",
            ):
                if product.get(field) in (None, "") and open_product.get(field) not in (None, ""):
                    product[field] = open_product[field]
            product["erp_open"] = True
        if not open_orders_available:
            warnings.append("ERP开放工单列表暂未更新，未报工工单可能显示不完整。")
        include_unreported_orders(data, products)
        return build_operations_snapshot(data, products, now, warnings)
    finally:
        if conn is not None:
            conn.rollback()
            conn.close()


@app.get("/api/mo/dashboard/operations")
def dashboard_operations():
    try:
        now = datetime.now(ZoneInfo("Asia/Shanghai")).replace(tzinfo=None)
        return jsonify({"code": 0, "data": _current_operations_snapshot(now)})
    except Exception:
        app.logger.exception("dashboard operations snapshot failed")
        return jsonify({"code": 1, "msg": "生产看板数据读取失败，请稍后重试"}), 500


@app.get("/api/mo/dashboard/schedule-preview")
def dashboard_schedule_preview():
    connection = None
    try:
        calendar_id = request.args.get("calendar_id", type=int)
        policy_id = request.args.get("policy_id", type=int)
        direction = request.args.get("direction", "forward")
        now = datetime.now()
        snapshot = _current_operations_snapshot(now)
        connection = db()
        preview = build_schedule_preview(connection, snapshot, now, calendar_id, policy_id, direction)
        return jsonify({"code": 0, "data": preview})
    except ValueError as error:
        return jsonify({"code": 400, "msg": str(error)}), 400
    except Exception:
        app.logger.exception("dashboard schedule preview failed")
        return jsonify({"code": 1, "msg": "工序排程试算失败，请稍后重试"}), 500
    finally:
        if connection is not None:
            connection.close()


@app.get("/api/mo/receipt-comparison")
def receipt_comparison():
    """Compare final-process completion with audited ERP product receipts."""
    mo_code = str(request.args.get("mo_code") or "").strip()
    sort_seq_value = request.args.get("sort_seq")
    sort_seq = None
    if sort_seq_value not in (None, ""):
        try:
            sort_seq = int(sort_seq_value)
        except (TypeError, ValueError):
            return jsonify({"code": 1, "msg": "工单行号格式错误"}), 400
        if sort_seq <= 0:
            return jsonify({"code": 1, "msg": "工单行号格式错误"}), 400

    process_conn = None
    erp_conn = None
    try:
        process_where = ["e.id IS NOT NULL"]
        process_params = []
        if mo_code:
            process_where.append("ws.mo_code=%s")
            process_params.append(mo_code)
        if sort_seq is not None:
            process_where.append("ws.sort_seq=%s")
            process_params.append(sort_seq)
        process_filter = (
            "WHERE " + " AND ".join(process_where)
            if process_where else ""
        )

        process_conn = db()
        process_cur = process_conn.cursor(dictionary=True)
        process_cur.execute(f"""
            SELECT
                ws.mo_code,
                ws.sort_seq,
                ws.status AS workorder_status,
                ctx.inv_code,
                ctx.inv_name,
                ctx.inv_std,
                ctx.plan_qty,
                COALESCE(e.process_name, p.process_name) AS last_process_name,
                e.end_time AS final_process_end_time,
                COALESCE(e.qty_done, 0) AS final_process_qty,
                CASE WHEN e.id IS NULL THEN 0 ELSE 1 END AS has_final_execution
            FROM mo_wo_state_yx ws
            JOIN (
                SELECT route_id, MAX(seq) AS last_seq
                FROM mo_route_step_yx
                GROUP BY route_id
            ) last_step
              ON last_step.route_id=ws.route_id
            JOIN mo_route_step_yx rs
              ON rs.route_id=ws.route_id AND rs.seq=last_step.last_seq
            LEFT JOIN mo_process_yx p
              ON p.id=rs.process_id
            LEFT JOIN mo_workorder_context_yx ctx
              ON ctx.mo_code=ws.mo_code
             AND ctx.sort_seq=ws.sort_seq
            LEFT JOIN mo_execution_yx e
              ON e.mo_code=ws.mo_code
             AND e.sort_seq=ws.sort_seq
             AND e.route_id=ws.route_id
             AND e.seq=last_step.last_seq
             AND e.status='done'
            {process_filter}
            ORDER BY e.end_time DESC, ws.mo_code DESC, ws.sort_seq DESC
        """, tuple(process_params))
        process_rows = process_cur.fetchall()
        process_cur.close()
        process_conn.close()
        process_conn = None

        if not process_rows:
            return jsonify({
                "code": 0,
                "data": [],
                "summary": {"total": 0, "consistent": 0, "inconsistent": 0},
            })

        erp_conn = u8_db()
        erp_conn.timeout = 20
        erp_cur = erp_conn.cursor()
        erp_rows = []
        process_keys = sorted({
            (str(row["mo_code"]), int(row["sort_seq"]))
            for row in process_rows
        })
        for offset in range(0, len(process_keys), 400):
            chunk = process_keys[offset:offset + 400]
            conditions = " OR ".join(
                ["(a.MoCode_a=? AND a.SortSeq_b=?)"] * len(chunk)
            )
            erp_cur.execute(f"""
                WITH closed_orders AS (
                    SELECT
                        LTRIM(RTRIM(a.MoCode_a)) AS mo_code,
                        CAST(a.SortSeq_b AS INT) AS sort_seq,
                        MAX(NULLIF(LTRIM(RTRIM(a.Define23_b)), N'')) AS workorder_close_reason
                    FROM dbo.momlist_yx a
                    WHERE a.CloseDate_b IS NOT NULL
                      AND ({conditions})
                    GROUP BY LTRIM(RTRIM(a.MoCode_a)), CAST(a.SortSeq_b AS INT)
                )
                SELECT
                    closed.mo_code,
                    closed.sort_seq,
                    COALESCE(SUM(receipt.iQuantity), 0) AS erp_in_qty,
                    closed.workorder_close_reason
                FROM closed_orders closed
                LEFT JOIN dbo.rdall_yx receipt
                  ON receipt.cOrderCode=closed.mo_code
                 AND receipt.orderirowno=closed.sort_seq
                 AND receipt.class='10'
                 AND receipt.bRdFlag=1
                 AND receipt.dVeriDate IS NOT NULL
                GROUP BY closed.mo_code, closed.sort_seq, closed.workorder_close_reason
            """, tuple(value for key in chunk for value in key))
            erp_rows.extend(_u8_rows(erp_cur))
        erp_cur.close()
        erp_conn.close()
        erp_conn = None
        erp_by_key = {
            (str(row["mo_code"]), int(row["sort_seq"])): row
            for row in erp_rows
        }

        rows = []
        consistent_count = 0
        tolerance = Decimal("0.0001")
        for process_row in process_rows:
            key = (str(process_row["mo_code"]), int(process_row["sort_seq"]))
            erp_row = erp_by_key.get(key)
            if erp_row is None:
                continue
            final_qty = Decimal(str(process_row.get("final_process_qty") or 0))
            erp_qty = Decimal(str(erp_row.get("erp_in_qty") or 0))
            difference = final_qty - erp_qty
            is_consistent = abs(difference) < tolerance
            if is_consistent:
                consistent_count += 1
            rows.append({
                "mo_code": key[0],
                "sort_seq": key[1],
                "workorder_status": process_row.get("workorder_status") or "",
                "workorder_close_reason": erp_row.get("workorder_close_reason") or "",
                "inv_code": process_row.get("inv_code") or "",
                "inv_name": process_row.get("inv_name") or "",
                "inv_std": process_row.get("inv_std") or "",
                "plan_qty": _u8_value(process_row.get("plan_qty")),
                "last_process_name": process_row.get("last_process_name") or "",
                "final_process_end_time": _u8_value(
                    process_row.get("final_process_end_time")
                ),
                "has_final_execution": bool(process_row.get("has_final_execution")),
                "final_process_qty": float(final_qty),
                "erp_in_qty": float(erp_qty),
                "difference": float(difference),
                "is_consistent": is_consistent,
                "compare_result": "一致" if is_consistent else "不一致",
            })

        return jsonify({
            "code": 0,
            "data": rows,
            "summary": {
                "total": len(rows),
                "consistent": consistent_count,
                "inconsistent": len(rows) - consistent_count,
            },
        })
    except Exception:
        app.logger.exception("receipt comparison failed")
        return jsonify({
            "code": 1,
            "msg": "入库数量比对失败，请稍后重试",
        }), 500
    finally:
        if process_conn is not None:
            process_conn.close()
        if erp_conn is not None:
            erp_conn.close()


@app.get("/api/mo/workorder-process-report")
def workorder_process_report():
    """Return every routed process for all workorders that have execution data."""
    conn = None
    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT
                ro.mo_code,
                ro.sort_seq,
                ctx.customer_name,
                ctx.inv_code,
                ctx.inv_name,
                ctx.inv_std,
                route.route_name,
                step.seq AS process_seq,
                process.process_name,
                execution.station_name,
                CASE
                    WHEN execution.id IS NULL THEN '未开始'
                    WHEN execution.status='done' THEN '已完成'
                    WHEN execution.status='processing' THEN '进行中'
                    WHEN execution.status='interrupted' THEN '已中断'
                    ELSE execution.status
                END AS process_status,
                COALESCE(workers.worker_names, '') AS worker_names,
                execution.start_time,
                execution.end_time,
                CASE
                    WHEN execution.start_time IS NULL THEN NULL
                    ELSE CONCAT(
                        CASE
                            WHEN TIMESTAMPDIFF(
                                SECOND, execution.start_time,
                                COALESCE(execution.end_time, NOW())
                            ) >= 86400
                            THEN CONCAT(
                                FLOOR(
                                    TIMESTAMPDIFF(
                                        SECOND, execution.start_time,
                                        COALESCE(execution.end_time, NOW())
                                    ) / 86400
                                ), '天'
                            )
                            ELSE ''
                        END,
                        CASE
                            WHEN MOD(
                                TIMESTAMPDIFF(
                                    SECOND, execution.start_time,
                                    COALESCE(execution.end_time, NOW())
                                ), 86400
                            ) >= 3600
                            THEN CONCAT(
                                FLOOR(
                                    MOD(
                                        TIMESTAMPDIFF(
                                            SECOND, execution.start_time,
                                            COALESCE(execution.end_time, NOW())
                                        ), 86400
                                    ) / 3600
                                ), '小时'
                            )
                            ELSE ''
                        END,
                        FLOOR(
                            MOD(
                                TIMESTAMPDIFF(
                                    SECOND, execution.start_time,
                                    COALESCE(execution.end_time, NOW())
                                ), 3600
                            ) / 60
                        ), '分钟'
                    )
                END AS duration_text,
                ctx.plan_qty,
                COALESCE(execution.qty_done, 0) AS qty_done,
                COALESCE(execution.qty_a, 0) AS qty_a,
                COALESCE(execution.qty_a1, 0) AS qty_a1,
                COALESCE(execution.qty_a2, 0) AS qty_a2,
                COALESCE(execution.qty_c, 0) AS qty_c,
                CASE WHEN COALESCE(prints.print_count, 0) > 0 THEN 1 ELSE 0 END
                    AS label_printed,
                COALESCE(prints.print_count, 0) AS print_count,
                COALESCE((
                    SELECT GROUP_CONCAT(
                        CASE
                            WHEN remaining_execution.id IS NULL
                              OR remaining_execution.status <> 'done'
                            THEN remaining_process.process_name
                        END
                        ORDER BY remaining_step.seq SEPARATOR ' → '
                    )
                    FROM mo_route_step_yx remaining_step
                    JOIN mo_process_yx remaining_process
                      ON remaining_process.id=remaining_step.process_id
                    LEFT JOIN mo_execution_yx remaining_execution
                      ON remaining_execution.mo_code=ro.mo_code
                     AND remaining_execution.sort_seq=ro.sort_seq
                     AND remaining_execution.route_id=ro.route_id
                     AND remaining_execution.seq=remaining_step.seq
                    WHERE remaining_step.route_id=ro.route_id
                ), '无') AS remaining_processes
            FROM (
                SELECT DISTINCT mo_code, sort_seq, route_id
                FROM mo_execution_yx
            ) ro
            JOIN mo_route_yx route
              ON route.id=ro.route_id
            JOIN mo_route_step_yx step
              ON step.route_id=ro.route_id
            JOIN mo_process_yx process
              ON process.id=step.process_id
            LEFT JOIN mo_execution_yx execution
              ON execution.mo_code=ro.mo_code
             AND execution.sort_seq=ro.sort_seq
             AND execution.route_id=ro.route_id
             AND execution.seq=step.seq
            LEFT JOIN (
                SELECT execution_id,
                       GROUP_CONCAT(
                           DISTINCT user_name_snapshot ORDER BY id SEPARATOR '、'
                       ) AS worker_names
                FROM mo_execution_worker_yx
                GROUP BY execution_id
            ) workers
              ON workers.execution_id=execution.id
            LEFT JOIN (
                SELECT execution_id, COUNT(*) AS print_count
                FROM mo_execution_print_log_yx
                GROUP BY execution_id
            ) prints
              ON prints.execution_id=execution.id
            LEFT JOIN mo_workorder_context_yx ctx
              ON ctx.mo_code=ro.mo_code
             AND ctx.sort_seq=ro.sort_seq
            ORDER BY ro.mo_code DESC, ro.sort_seq, step.seq
        """)
        rows = [
            {key: _u8_value(value) for key, value in row.items()}
            for row in cur.fetchall()
        ]
        cur.close()
        conn.close()
        conn = None
        return jsonify({"code": 0, "data": rows, "total": len(rows)})
    except Exception:
        app.logger.exception("workorder process report failed")
        return jsonify({
            "code": 1,
            "msg": "工单工序报告读取失败，请稍后重试",
            "data": [],
        }), 500
    finally:
        if conn is not None:
            conn.close()


@app.get("/api/mo/process-labor-report")
def process_labor_report():
    """Return one row per workorder process plus its completion batches."""
    now = datetime.now()
    conn = None
    try:
        conn = db()
        conn.start_transaction(
            isolation_level="REPEATABLE READ",
            consistent_snapshot=True,
            readonly=True,
        )
        data = load_operation_rows(conn, now)
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT '正常' AS kind,e.id AS record_id,e.mo_code,e.sort_seq,
                   e.route_id,e.seq AS process_seq,e.start_time,
                   c.complete_time,COALESCE(c.qty_done,0) AS qty_done,
                   COALESCE(c.qty_a,0) AS qty_a,COALESCE(c.qty_a1,0) AS qty_a1,
                   COALESCE(c.qty_a2,0) AS qty_a2,COALESCE(c.qty_c,0) AS qty_c,
                   COALESCE(w.worker_names,'') AS assigned_workers,
                   COALESCE(c.operator_name,e.operator_name,'') AS operator_name
            FROM mo_execution_yx e
            LEFT JOIN mo_execution_completion_yx c ON c.execution_id=e.id
            LEFT JOIN (
                SELECT execution_id,GROUP_CONCAT(
                    DISTINCT user_name_snapshot ORDER BY id SEPARATOR '、'
                ) AS worker_names
                FROM mo_execution_worker_yx GROUP BY execution_id
            ) w ON w.execution_id=e.id
            UNION ALL
            SELECT '返工',r.id,r.mo_code,r.sort_seq,r.route_id,r.seq,r.start_time,
                   c.complete_time,COALESCE(c.qty_done,0),COALESCE(c.qty_a,0),
                   COALESCE(c.qty_a1,0),COALESCE(c.qty_a2,0),COALESCE(c.qty_c,0),
                   COALESCE(w.worker_names,''),
                   COALESCE(c.operator_name,r.operator_name,'')
            FROM mo_rework_yx r
            LEFT JOIN mo_rework_completion_yx c ON c.rework_id=r.id
            LEFT JOIN (
                SELECT rework_id,GROUP_CONCAT(
                    DISTINCT user_name_snapshot ORDER BY id SEPARATOR '、'
                ) AS worker_names
                FROM mo_rework_worker_yx GROUP BY rework_id
            ) w ON w.rework_id=r.id
            ORDER BY mo_code DESC,sort_seq,process_seq,start_time,complete_time
        """)
        batches = cur.fetchall()
        cur.close()
        conn.rollback()
        conn.close()
        conn = None

        open_orders, open_orders_available = _workorder_info_map()
        candidates = tracked_order_rows(data) + [
            {"mo_code": key[0], "sort_seq": key[1]} for key in open_orders
        ]
        products, warnings = _dashboard_product_context(candidates)
        for key in open_orders:
            open_product = _product_info(open_orders[key])
            product = products.setdefault(key, {
                **open_product,
                "first_issued_qty": None,
                "unit_name": "未标单位",
            })
            for field in (
                "so_code_008", "so_row_008", "source_account",
                "source_so_code", "customer_code", "customer_name",
            ):
                if product.get(field) in (None, "") and open_product.get(field) not in (None, ""):
                    product[field] = open_product[field]
            product["erp_open"] = True
        if not open_orders_available:
            warnings.append("ERP开放工单列表暂未更新，未报工工单可能显示不完整。")
        include_unreported_orders(data, products)
        snapshot = build_operations_snapshot(data, products, now, warnings)
        return jsonify({
            "code": 0,
            "data": build_process_labor_report(snapshot, batches, now),
        })
    except Exception:
        app.logger.exception("process labor report failed")
        return jsonify({
            "code": 1,
            "msg": "工序工时与人员分配报表读取失败，请稍后重试",
        }), 500
    finally:
        if conn is not None:
            conn.rollback()
            conn.close()


_DASHBOARD_EMAIL_EPSILON = Decimal("0.0001")
_DASHBOARD_EMAIL_STATE_FILLS = {
    "已完成": "CFEADE",
    "生产中": "F7E2A7",
    "待开工": "CFE3F6",
    "待接收": "CFE3F6",
    "返工待完": "F5CFD4",
    "未领料": "DFE6ED",
    "未开始": "DFE6ED",
    "待核对": "DFE6ED",
}


def _dashboard_email_positive(value):
    return value is not None and Decimal(str(value)) > _DASHBOARD_EMAIL_EPSILON


def _dashboard_email_step_state(step):
    if _dashboard_email_positive(step.get("rework_remaining_qty")):
        return "返工待完"
    if _dashboard_email_positive(step.get("normal_remaining_qty")):
        return "待开工" if step.get("status") == "received" else "生产中"
    if _dashboard_email_positive(step.get("receive_available_qty")):
        return "待接收"
    if step.get("normal_remaining_qty") is None:
        return "待核对"
    if (
        _dashboard_email_positive(step.get("normal_received_qty"))
        and _dashboard_email_positive(step.get("normal_done_qty"))
    ):
        return "已完成"
    if step.get("is_first_step"):
        return "待核对" if step.get("first_issued_qty") is None else "未领料"
    return "未开始"


def _dashboard_email_step_anomalies(order, steps, index):
    step = steps[index]
    anomalies = []
    if (
        _dashboard_email_step_state(step) == "已完成"
        and _dashboard_email_positive(order.get("plan_qty"))
        and Decimal(str(step.get("normal_done_qty") or 0)) + _DASHBOARD_EMAIL_EPSILON
        < Decimal(str(order["plan_qty"]))
    ):
        anomalies.append(
            f"完工数量不足：累计{step.get('normal_done_qty') or 0}，计划{order['plan_qty']}"
        )
    previous = steps[index - 1] if index > 0 else None
    received = step.get("normal_received_qty")
    available = step.get("receive_available_qty")
    downstream = (
        Decimal(str(received)) + Decimal(str(available))
        if received is not None and available is not None
        else None
    )
    if (
        previous
        and previous.get("transferable_qty") is not None
        and downstream is not None
        and (
            _dashboard_email_step_state(previous) == "已完成"
            or downstream > _DASHBOARD_EMAIL_EPSILON
        )
        and abs(Decimal(str(previous["transferable_qty"])) - downstream)
        > _DASHBOARD_EMAIL_EPSILON
    ):
        anomalies.append(
            "上下游数量不一致："
            f"上道可流转{previous['transferable_qty']}，"
            f"本工序已接收及可接收{downstream}"
        )
    return anomalies


def _dashboard_email_orders(orders):
    visible = []
    for order in orders:
        if order.get("is_closed"):
            continue
        steps = sorted(
            order.get("steps") or [],
            key=lambda row: int(row.get("seq") or 0),
        )
        has_quantity = any(
            _dashboard_email_positive(step.get(field))
            for step in steps
            for field in (
                "normal_remaining_qty",
                "rework_remaining_qty",
                "receive_available_qty",
            )
        )
        has_anomaly = any(
            _dashboard_email_step_anomalies(order, steps, index)
            for index in range(len(steps))
        )
        if order.get("has_reporting") is False or has_quantity or has_anomaly:
            visible.append(order)
    return visible


def _dashboard_email_step_text(order, steps, index):
    step = steps[index]

    def quantity(value):
        return "—" if value is None else str(value)

    def timestamp(value):
        return str(value)[:16] if value else "—"

    lines = [
        step.get("process_name") or f"第{step.get('seq') or index + 1}工序",
        _dashboard_email_step_state(step),
        f"累计接收 {quantity(step.get('normal_received_qty'))}  "
        f"累计完工 {quantity(step.get('normal_done_qty'))}",
        f"正常待完 {quantity(step.get('normal_remaining_qty'))}  "
        f"可接收 {quantity(step.get('receive_available_qty'))}",
        f"返工待完 {quantity(step.get('rework_remaining_qty'))}",
        f"始 {timestamp(step.get('first_start_time'))}",
        f"终 {timestamp(step.get('last_end_time'))}",
    ]
    lines.extend(
        f"异常：{reason}"
        for reason in _dashboard_email_step_anomalies(order, steps, index)
    )
    return "\n".join(lines)


def build_report_attachment(report_key):
    """Build the current report as an XLSX attachment."""
    from io import BytesIO
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    if report_key == "production-dashboard":
        response = dashboard_operations()
        headers = ()
        report_name = "生产现场看板"
    elif report_key == "receipt-comparison":
        response = receipt_comparison()
        headers = (
            ("工单号", "mo_code"),
            ("行号", "sort_seq"),
            ("产品编码", "inv_code"),
            ("产品名称", "inv_name"),
            ("规格型号", "inv_std"),
            ("计划数量", "plan_qty"),
            ("工单状态", "workorder_status"),
            ("工单关闭原因", "workorder_close_reason"),
            ("最后工序", "last_process_name"),
            ("末工序完工时间", "final_process_end_time"),
            ("末工序完工数量", "final_process_qty"),
            ("ERP已审核入库", "erp_in_qty"),
            ("差额", "difference"),
            ("对账结果", "compare_result"),
        )
        report_name = "末工序入库对账"
    elif report_key == "workorder-process-report":
        response = workorder_process_report()
        headers = (
            ("生产订单号", "mo_code"),
            ("生产订单行号", "sort_seq"),
            ("客户名称", "customer_name"),
            ("产品编码", "inv_code"),
            ("产品名称", "inv_name"),
            ("规格型号", "inv_std"),
            ("工艺路线", "route_name"),
            ("工序序号", "process_seq"),
            ("工序名称", "process_name"),
            ("工站", "station_name"),
            ("工序状态", "process_status"),
            ("开工人员", "worker_names"),
            ("开工时间", "start_time"),
            ("完工时间", "end_time"),
            ("工序用时", "duration_text"),
            ("计划生产数量", "plan_qty"),
            ("累计完工数量", "qty_done"),
            ("A级数量", "qty_a"),
            ("A1级数量", "qty_a1"),
            ("A2级数量", "qty_a2"),
            ("C级数量", "qty_c"),
            ("是否打印流转标签", "label_printed"),
            ("标签打印次数", "print_count"),
            ("剩余未完成工序", "remaining_processes"),
        )
        report_name = "工单工序报告"
    else:
        raise ValueError("报表不存在")

    if isinstance(response, tuple):
        response = response[0]
    payload = response.get_json()
    if not payload or payload.get("code") != 0:
        raise RuntimeError(payload.get("msg") if payload else "报表生成失败")

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = report_name
    if report_key == "production-dashboard":
        dashboard_data = payload.get("data") or {}
        orders = _dashboard_email_orders(dashboard_data.get("orders") or [])
        process_count = max((len(row.get("steps") or []) for row in orders), default=0)
        sheet.freeze_panes = "C3"
        legend_items = [
            ("已完成", "CFEADE"),
            ("生产中", "F7E2A7"),
            ("待开工", "CFE3F6"),
            ("待接收", "CFE3F6"),
            ("返工待完", "F5CFD4"),
            ("未领料", "DFE6ED"),
            ("未开始", "DFE6ED"),
            ("待核对", "DFE6ED"),
            ("数量异常", "F6CBD0"),
        ]
        sheet.append(["图例", *[label for label, _ in legend_items], "逾期"])
        sheet["A1"].font = Font(name="微软雅黑", bold=True, color="17365D")
        for index, (_, color) in enumerate(legend_items, 2):
            cell = sheet.cell(row=1, column=index)
            cell.fill = PatternFill("solid", fgColor=color)
            cell.alignment = Alignment(vertical="center", horizontal="center")
        sheet["K1"].font = Font(name="微软雅黑", bold=True, color="C22F3F")
        sheet["J1"].alignment = Alignment(vertical="center", horizontal="center")
        sheet.append([
            "工单号", "行号", "客户", "产品", "料号", "规格",
            "计划生产数量", "单位", "计划开工", "计划完工", "工单状态",
            *[f"工序{index}" for index in range(1, process_count + 1)],
        ])
        widths = [20, 8, 30, 40, 28, 24, 16, 10, 15, 15, 16]
        for index, width in enumerate(widths, 1):
            sheet.column_dimensions[get_column_letter(index)].width = width
        for index in range(process_count):
            sheet.column_dimensions[get_column_letter(12 + index)].width = 38
        for order in orders:
            steps = sorted(order.get("steps") or [], key=lambda row: int(row.get("seq") or 0))
            status = "、".join(filter(None, (
                "系统已删除" if order.get("erp_deleted") else "",
                "已关闭" if order.get("is_closed") else "",
                "未报工" if order.get("has_reporting") is False else "",
                "逾期" if order.get("is_overdue") else "",
            )))
            values = [
                order.get("mo_code"), order.get("sort_seq"),
                (order.get("customer_name") or "").strip() or "未关联客户",
                order.get("inv_name") or order.get("inv_code") or (
                    "工单资料已删除" if order.get("erp_deleted") else "产品待补"
                ),
                order.get("inv_code") or "", order.get("inv_std") or "",
                order.get("plan_qty"), order.get("unit_name") or "",
                str(order.get("plan_start_date") or "")[:10],
                str(order.get("plan_due_date") or "")[:10], status,
            ]
            for index in range(process_count):
                step = steps[index] if index < len(steps) else None
                values.append(_dashboard_email_step_text(order, steps, index) if step else "—")
            sheet.append(values)
            excel_row = sheet.max_row
            sheet.row_dimensions[excel_row].height = 112
            for cell in sheet[excel_row]:
                cell.font = Font(name="微软雅黑", color="18283B")
                cell.alignment = Alignment(vertical="center", wrap_text=True)
            for index, step in enumerate(steps):
                anomalies = _dashboard_email_step_anomalies(order, steps, index)
                state = _dashboard_email_step_state(step)
                color = "F6CBD0" if anomalies else _DASHBOARD_EMAIL_STATE_FILLS[state]
                sheet.cell(row=excel_row, column=12 + index).fill = PatternFill(
                    "solid", fgColor=color
                )
            if order.get("is_overdue"):
                for column in (10, 11):
                    sheet.cell(row=excel_row, column=column).font = Font(
                        name="微软雅黑", bold=True, color="C22F3F"
                    )
            elif order.get("erp_deleted"):
                sheet.cell(row=excel_row, column=11).font = Font(
                    name="微软雅黑", bold=True, color="C22F3F"
                )
        sheet.auto_filter.ref = f"A2:K{sheet.max_row}"
        header_row = 2
    else:
        sheet.freeze_panes = "A2"
        sheet.append([label for label, _ in headers])
        for item in payload.get("data", []):
            values = []
            for _, key in headers:
                value = item.get(key)
                if key == "label_printed":
                    value = "是" if value else "否"
                elif key == "workorder_status":
                    value = {"done": "已完成", "processing": "生产中", "pending": "待处理"}.get(value, value)
                values.append(value)
            sheet.append(values)
        sheet.auto_filter.ref = sheet.dimensions
        for index, (label, key) in enumerate(headers, 1):
            column = sheet.column_dimensions[get_column_letter(index)]
            if key == "workorder_close_reason":
                column.width = 36
                for cells in sheet.iter_rows(min_row=2, max_row=sheet.max_row, min_col=index, max_col=index):
                    cell = cells[0]
                    if cell.value:
                        cell.data_type = "s"
                        cell.alignment = Alignment(vertical="center", wrap_text=True)
            else:
                column.width = min(max(len(label) + 4, 14), 36)
        header_row = 1
    for cell in sheet[header_row]:
        cell.fill = PatternFill("solid", fgColor="D9EAF7")
        cell.font = Font(name="微软雅黑", bold=True, color="17365D")
        cell.alignment = Alignment(vertical="center", horizontal="center")
    output = BytesIO()
    workbook.save(output)
    filename = f"{report_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return filename, output.getvalue()


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


@app.get("/api/mo/dashboard/operation-log")
def dashboard_operation_log():
    page = max(1, request.args.get("current", 1, type=int))
    page_size = min(100, max(10, request.args.get("pageSize", 20, type=int)))
    event_type = (request.args.get("event_type") or "").strip()
    operator = (request.args.get("operator") or "").strip()
    worker = (request.args.get("worker") or "").strip()
    mo_code = (request.args.get("mo_code") or "").strip()
    process_name = (request.args.get("process_name") or "").strip()
    station_name = (request.args.get("station_name") or "").strip()
    keyword = (request.args.get("keyword") or "").strip()
    start_date = (request.args.get("start_date") or "").strip()
    end_date = (request.args.get("end_date") or "").strip()
    where = []
    params = []

    def like(column, value):
        if value:
            where.append(f"{column} LIKE %s")
            params.append(f"%{value}%")

    if event_type:
        where.append("event_type=%s")
        params.append(event_type)
    like("operator_name", operator)
    like("worker_names", worker)
    like("mo_code", mo_code)
    like("process_name", process_name)
    like("station_name", station_name)
    if keyword:
        where.append("(mo_code LIKE %s OR process_name LIKE %s OR station_name LIKE %s OR reason LIKE %s)")
        params.extend([f"%{keyword}%"] * 4)
    if start_date:
        where.append("occurred_at >= %s")
        params.append(f"{start_date} 00:00:00")
    if end_date:
        where.append("occurred_at < DATE_ADD(%s, INTERVAL 1 DAY)")
        params.append(end_date)
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    try:
        conn = db()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            f"SELECT COUNT(*) AS cnt FROM mo_operation_log_yx {where_sql}",
            tuple(params),
        )
        total = int(cur.fetchone()["cnt"] or 0)
        cur.execute(
            f"""
            SELECT id,event_type,event_name,occurred_at,operator_id,operator_name,
                   worker_names,worker_details,mo_code,sort_seq,route_id,seq,
                   process_name,station_id,station_name,qty,qty_a,qty_a1,
                   qty_a2,qty_c,reason,photo_urls,source_type,source_id,details
            FROM mo_operation_log_yx
            {where_sql}
            ORDER BY occurred_at DESC,id DESC
            LIMIT %s OFFSET %s
            """,
            tuple(params + [page_size, (page - 1) * page_size]),
        )
        rows = cur.fetchall()
        for row in rows:
            for field in ("worker_details", "photo_urls", "details"):
                if isinstance(row.get(field), str):
                    try:
                        row[field] = json.loads(row[field])
                    except ValueError:
                        row[field] = None
        cur.close(); conn.close()
        return jsonify({
            "code": 0,
            "data": [_ser(row) for row in rows],
            "total": total,
        })
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": [], "total": 0})


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


app.register_blueprint(config_approval_blueprint(
    lambda: db(),
    _route_usage_count,
    _sync_route_categories,
    _route_version_name,
    enqueue_approval_email,
))


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5001,
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
        use_reloader=False,
    )
