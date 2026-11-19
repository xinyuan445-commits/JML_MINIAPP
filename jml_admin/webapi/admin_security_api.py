"""Account and role management for the admin application only."""
import json

from flask import Blueprint, g, jsonify, request
from mysql.connector import IntegrityError
from werkzeug.security import generate_password_hash
from station_permissions import register_station_permissions
from station_proxies import register_station_proxies

from admin_permissions import (
    PAGE_CATALOG,
    PAGE_KEYS,
    identity_key,
    normalize_permissions,
    permission_catalog,
)


def positive_id(value):
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError("无效编号")
    return value


def required_text(body, field, limit):
    value = body.get(field)
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit or any(ord(c) < 32 for c in value):
        raise ValueError("请填写有效的名称或账号")
    return value.strip()


def active_value(body):
    value = body.get("is_active", True)
    if value not in (True, False, 0, 1):
        raise ValueError("无效状态")
    return int(bool(value))


def password_hash(body):
    value = body.get("password")
    if not isinstance(value, str) or not 8 <= len(value) <= 128 or not value.strip():
        raise ValueError("密码长度须为 8 至 128 位")
    return generate_password_hash(value)


def security_blueprint(database):
    bp = Blueprint("admin_security", __name__)

    def transaction(work):
        conn = None
        cur = None
        try:
            conn = database()
            cur = conn.cursor(dictionary=True)
            if request.method == "POST":
                # Serialize authorization edits, including the last-admin check.
                cur.execute("SELECT id FROM mo_admin_role_yx WHERE code='system-admin' FOR UPDATE")
                if not cur.fetchone():
                    raise ValueError("请先初始化后台权限表")
                if not isinstance(request.get_json(silent=True), dict):
                    raise ValueError("请求内容必须是对象")
            result = work(cur)
            conn.commit()
            return jsonify({"success": True, "code": 0, "data": result})
        except ValueError as error:
            if conn:
                conn.rollback()
            return jsonify({"code": 400, "msg": str(error)}), 400
        except IntegrityError:
            if conn:
                conn.rollback()
            return jsonify({"code": 409, "msg": "账号或角色编码已存在"}), 409
        except Exception:
            if conn:
                conn.rollback()
            return jsonify({"code": 503, "msg": "权限数据暂不可用，请检查初始化和数据库连接"}), 503
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()

    def audit(cur, action, target_id, changes):
        # Same transaction as the change; only explicit non-secret fields are logged.
        cur.execute("""INSERT INTO mo_admin_audit_log_yx
            (username,action_name,request_method,request_path,target_id,
             request_data,result_code,result_message,ip_address)
            VALUES (%s,%s,%s,%s,%s,%s,0,'',%s)""", (
            g.audit_username, action, request.method, request.path, str(target_id),
            json.dumps(changes, ensure_ascii=False), request.remote_addr or "",
        ))

    def require_local_admin(cur):
        cur.execute("""SELECT COUNT(*) AS total FROM mo_admin_account_yx a
            JOIN mo_admin_user_yx u ON u.id=a.local_user_id
            JOIN mo_admin_account_role_yx ar ON ar.account_id=a.id
            JOIN mo_admin_role_yx r ON r.id=ar.role_id
            WHERE a.is_active=1 AND u.is_active=1 AND r.is_active=1 AND r.code='system-admin'""")
        if not cur.fetchone()["total"]:
            raise ValueError("至少保留一个启用的本地系统管理员")

    @bp.get("/api/admin/permissions")
    def catalog():
        return jsonify({"success": True, "code": 0, "data": permission_catalog()})

    @bp.get("/api/admin/roles")
    def roles():
        def work(cur):
            cur.execute("SELECT id,code,name,permissions,is_active,is_system FROM mo_admin_role_yx ORDER BY id")
            rows = cur.fetchall()
            for row in rows:
                if isinstance(row["permissions"], str):
                    row["permissions"] = json.loads(row["permissions"])
            return rows
        return transaction(work)

    @bp.get("/api/admin/accounts")
    def accounts():
        def work(cur):
            cur.execute("""SELECT a.id,a.auth_source,a.username,a.display_name,
                a.is_active,a.local_user_id,a.subject,a.issuer,u.last_login_time
                FROM mo_admin_account_yx a LEFT JOIN mo_admin_user_yx u ON u.id=a.local_user_id
                ORDER BY a.id""")
            rows = cur.fetchall()
            cur.execute("SELECT account_id,role_id FROM mo_admin_account_role_yx")
            assignments = {}
            for row in cur.fetchall():
                assignments.setdefault(row["account_id"], []).append(row["role_id"])
            for row in rows:
                row["role_ids"] = assignments.get(row["id"], [])
                if row["last_login_time"]:
                    row["last_login_time"] = str(row["last_login_time"])
            return rows
        return transaction(work)

    @bp.get("/api/admin/page-settings")
    def page_settings():
        def work(cur):
            cur.execute("""SELECT page_key,is_enabled,revision,updated_by,update_time
                FROM mo_admin_page_setting_yx""")
            saved = {row["page_key"]: row for row in cur.fetchall()}
            return [
                {
                    **page,
                    "is_enabled": int(saved.get(page["key"], {}).get("is_enabled", 1)),
                    "revision": int(saved.get(page["key"], {}).get("revision", 0)),
                    "updated_by": saved.get(page["key"], {}).get("updated_by"),
                    "update_time": saved.get(page["key"], {}).get("update_time"),
                }
                for page in PAGE_CATALOG
            ]
        return transaction(work)

    @bp.post("/api/admin/page-settings/save")
    def save_page_setting():
        def work(cur):
            body = request.get_json()
            page_key = body.get("page_key")
            if page_key not in PAGE_KEYS:
                raise ValueError("页面不存在")
            if page_key == "page-settings":
                raise ValueError("页面开关不能停用")
            if body.get("is_enabled") not in (True, False, 0, 1):
                raise ValueError("页面状态无效")
            revision = body.get("revision")
            if isinstance(revision, bool) or not isinstance(revision, int) or revision < 0:
                raise ValueError("页面配置版本无效")
            enabled = int(bool(body["is_enabled"]))
            cur.execute("""SELECT page_key,is_enabled,revision FROM mo_admin_page_setting_yx
                WHERE page_key=%s FOR UPDATE""", (page_key,))
            before = cur.fetchone()
            current_revision = int(before["revision"]) if before else 0
            if revision != current_revision:
                raise ValueError("页面状态已变化，请刷新后重试")
            next_revision = current_revision + 1
            if before:
                cur.execute("""UPDATE mo_admin_page_setting_yx
                    SET is_enabled=%s,revision=%s,updated_by=%s WHERE page_key=%s""", (
                    enabled, next_revision, g.audit_username, page_key,
                ))
            else:
                cur.execute("""INSERT INTO mo_admin_page_setting_yx
                    (page_key,is_enabled,revision,updated_by) VALUES (%s,%s,%s,%s)""", (
                    page_key, enabled, next_revision, g.audit_username,
                ))
            audit(cur, "设置后台页面开关", page_key, {
                "before": {"is_enabled": int(before["is_enabled"])} if before else None,
                "after": {"is_enabled": enabled},
            })
            return {"page_key": page_key, "is_enabled": enabled, "revision": next_revision}
        return transaction(work)

    @bp.post("/api/admin/roles/save")
    def save_role():
        def work(cur):
            body = request.get_json()
            name = required_text(body, "name", 100)
            permissions = normalize_permissions(body.get("permissions"))
            enabled = active_value(body)
            row_id = body.get("id")
            before = None
            if row_id is not None:
                positive_id(row_id)
                cur.execute("SELECT * FROM mo_admin_role_yx WHERE id=%s", (row_id,))
                before = cur.fetchone()
                if not before:
                    raise ValueError("角色不存在")
                if before["is_system"]:
                    raise ValueError("系统管理员角色不可修改或停用")
                cur.execute("UPDATE mo_admin_role_yx SET name=%s,permissions=%s,is_active=%s WHERE id=%s",
                    (name, json.dumps(permissions), enabled, row_id))
            else:
                code = required_text(body, "code", 64)
                if not all(c.isascii() and (c.isalnum() or c in "-_") for c in code):
                    raise ValueError("角色编码仅支持英文字母、数字、横线和下划线")
                cur.execute("INSERT INTO mo_admin_role_yx (code,name,permissions,is_active) VALUES (%s,%s,%s,%s)",
                    (code, name, json.dumps(permissions), enabled))
                row_id = cur.lastrowid
            audit(cur, "修改后台角色" if before else "新增后台角色", row_id, {
                "before": {key: before[key] for key in ("name", "permissions", "is_active")} if before else None,
                "after": {"name": name, "permissions": permissions, "is_active": enabled},
            })
            return {"id": row_id}
        return transaction(work)

    @bp.post("/api/admin/accounts/save")
    def save_account():
        def work(cur):
            body = request.get_json()
            name = required_text(body, "display_name", 100)
            enabled = active_value(body)
            role_ids = body.get("role_ids")
            if not isinstance(role_ids, list):
                raise ValueError("请选择角色")
            role_ids = sorted(set(positive_id(value) for value in role_ids))
            if role_ids:
                cur.execute(f"SELECT id FROM mo_admin_role_yx WHERE id IN ({','.join(['%s'] * len(role_ids))})", tuple(role_ids))
                if {row["id"] for row in cur.fetchall()} != set(role_ids):
                    raise ValueError("选择的角色不存在")
            row_id = body.get("id")
            before = None
            if row_id is not None:
                positive_id(row_id)
                cur.execute("SELECT * FROM mo_admin_account_yx WHERE id=%s", (row_id,))
                before = cur.fetchone()
                if not before:
                    raise ValueError("账号不存在")
                if row_id == g.admin_account["id"] and not enabled:
                    raise ValueError("不能停用当前登录账号")
                cur.execute("SELECT role_id FROM mo_admin_account_role_yx WHERE account_id=%s", (row_id,))
                old_roles = [row["role_id"] for row in cur.fetchall()]
                cur.execute("UPDATE mo_admin_account_yx SET display_name=%s,is_active=%s WHERE id=%s", (name, enabled, row_id))
                if before["auth_source"] == "session":
                    if before["is_active"] and not enabled:
                        cur.execute("UPDATE mo_admin_account_yx SET session_version=session_version+1 WHERE id=%s", (row_id,))
                    cur.execute("UPDATE mo_admin_user_yx SET display_name=%s,is_active=%s WHERE id=%s",
                        (name, enabled, before["local_user_id"]))
                cur.execute("DELETE FROM mo_admin_account_role_yx WHERE account_id=%s", (row_id,))
            else:
                username = required_text(body, "username", 50)
                hashed = password_hash(body)
                cur.execute("""INSERT INTO mo_admin_user_yx (username,password_hash,display_name,role,is_active)
                    VALUES (%s,%s,%s,'viewer',%s)""", (username, hashed, name, enabled))
                user_id = cur.lastrowid
                cur.execute("""INSERT INTO mo_admin_account_yx
                    (identity_key,auth_source,local_user_id,subject,username,display_name,is_active)
                    VALUES (%s,'session',%s,%s,%s,%s,%s)""",
                    (identity_key("session", user_id), user_id, str(user_id), username, name, enabled))
                row_id = cur.lastrowid
                old_roles = []
            for role_id in role_ids:
                cur.execute("INSERT INTO mo_admin_account_role_yx (account_id,role_id) VALUES (%s,%s)", (row_id, role_id))
            require_local_admin(cur)
            audit(cur, "修改后台账号" if before else "新增后台账号", row_id, {
                "before": {"role_ids": old_roles, "is_active": before["is_active"], "display_name": before["display_name"]} if before else None,
                "after": {"display_name": name, "is_active": enabled, "role_ids": role_ids},
            })
            return {"id": row_id}
        return transaction(work)

    @bp.post("/api/admin/accounts/password")
    def reset_password():
        def work(cur):
            body = request.get_json()
            row_id = positive_id(body.get("id"))
            hashed = password_hash(body)
            cur.execute("SELECT auth_source,local_user_id FROM mo_admin_account_yx WHERE id=%s", (row_id,))
            account = cur.fetchone()
            if not account or account["auth_source"] != "session":
                raise ValueError("仅可重置本地账号密码，域账号请在统一平台处理")
            cur.execute("UPDATE mo_admin_user_yx SET password_hash=%s WHERE id=%s", (hashed, account["local_user_id"]))
            cur.execute("UPDATE mo_admin_account_yx SET session_version=session_version+1 WHERE id=%s", (row_id,))
            audit(cur, "重置后台账号密码", row_id, {"sessions_invalidated": True})
            return {"id": row_id}
        return transaction(work)

    register_station_permissions(bp, transaction, audit)
    register_station_proxies(bp, transaction, audit)
    return bp
