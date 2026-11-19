"""Admin adapter. Current binding and explicit module permissions are reloaded per request."""
import json
import os
import sys
from pathlib import Path

workspace = Path(__file__).resolve().parents[2]
shared = workspace / "nonorder_shared"
if not shared.is_dir():
    shared = workspace / "JML_MINIAPP" / "nonorder_shared"
if shared.is_dir():
    sys.path.insert(0, str(shared))

from flask import Blueprint, g, jsonify, request
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from nonorder_core.http import blueprint
from nonorder_core.storage import engine_for, transaction, RuleError
from nonorder_core.service import require


def current_account(store):
    account_id = g.admin_account["id"]
    rows = store.external("SELECT * FROM mo_admin_account_yx WHERE id=:id", id=account_id)
    require(rows and rows[0]["is_active"], "账号已停用", 403)
    roles = store.external("""SELECT r.permissions FROM mo_admin_role_yx r
        JOIN mo_admin_account_role_yx ar ON ar.role_id=r.id
        WHERE ar.account_id=:id AND r.is_active=1""", id=account_id)
    explicit = set()
    for role in roles:
        values = role["permissions"]
        explicit.update(json.loads(values) if isinstance(values, str) else values)
    # g permissions also include platform write ceiling and page gating from host middleware.
    return rows[0], explicit & set(g.admin_permissions)


def nonorder_blueprint(database):
    def identity(store):
        account, permissions = current_account(store)
        require("daily-tasks.view" in permissions and "nonorder.view" in permissions or
                "nonorder.transfer" in permissions, "没有无工单任务权限", 403)
        return {"source": "admin", "staff_id": account.get("staff_id"), "account_id": account["id"],
                "name": account.get("display_name", ""), "permissions": permissions}
    return blueprint(lambda: engine_for(database), identity, name="admin_nonorder")


def binding_blueprint(database):
    bp = Blueprint("nonorder_staff_binding", __name__)

    @bp.get("/api/admin/accounts/staff-binding")
    def binding_options():
        try:
            require("accounts.manage" in g.admin_permissions, "没有账号管理权限", 403)
            require(os.getenv("NONORDER_ENABLED") == "1", "无工单任务尚未启用", 503)
            identifier = request.args.get("id", type=int)
            require(identifier and identifier > 0, "账号编号无效", 400)
            with transaction(engine_for(database)) as store:
                _, permissions = current_account(store)
                require("accounts.manage" in permissions, "账号管理权限已变化", 403)
                rows = store.external("SELECT staff_id,staff_binding_revision FROM mo_admin_account_yx WHERE id=:id", id=identifier)
                require(rows, "账号不存在", 404)
                account = rows[0]
                people = store.external("""SELECT s.id,s.name,s.status FROM jml_staff s
                    LEFT JOIN mo_admin_account_yx a ON a.staff_id=s.id
                    WHERE (s.status=1 AND a.id IS NULL) OR a.id=:id""", id=identifier)
            return jsonify(code=0, data={"staff_id": account["staff_id"], "revision": account["staff_binding_revision"],
                "people": [{"id": str(p["id"]), "name": p["name"], "active": str(p["status"]) == "1"} for p in people]})
        except RuleError as error:
            return jsonify(code=error.status, msg=str(error)), error.status
        except Exception:
            return jsonify(code=503, msg="员工绑定暂不可用"), 503

    @bp.post("/api/admin/accounts/staff-binding")
    def binding():
        try:
            require("accounts.manage" in g.admin_permissions, "没有账号管理权限", 403)
            body = request.get_json(silent=True)
            require(isinstance(body, dict), "请求内容无效", 400)
            with transaction(engine_for(database), write=True) as store:
                # This operation has its own explicit authorization; never accepts self-selected identity.
                _, permissions = current_account(store)
                require("accounts.manage" in permissions, "账号管理权限已变化", 403)
                rows = store.external("SELECT id,is_active,staff_id,staff_binding_revision FROM mo_admin_account_yx WHERE id=:id", id=body.get("id"))
                require(rows, "账号不存在", 404)
                account = rows[0]
                require(account["staff_binding_revision"] == body.get("revision"), "绑定已变化，请刷新")
                staff = body.get("staff_id") or None
                if staff:
                    staff = str(store.person(str(staff))["id"])
                store.conn.execute(text("""UPDATE mo_admin_account_yx SET staff_id=:staff,
                    staff_binding_revision=staff_binding_revision+1,staff_bound_by=:actor,staff_bound_at=:at WHERE id=:id"""),
                    {"staff": staff, "actor": g.admin_account["id"], "at": store.now(), "id": account["id"]})
                store.conn.execute(text("""INSERT INTO mo_admin_audit_log_yx
                    (username,action_name,request_method,request_path,target_id,request_data,result_code,result_message,ip_address)
                    VALUES (:name,'员工绑定','POST','/api/admin/accounts/staff-binding',:id,:data,0,'',:ip)"""),
                    {"name": g.audit_username, "id": str(account["id"]), "data": json.dumps({"before": account["staff_id"], "after": staff, "actor_account_id": g.admin_account["id"]}), "ip": request.remote_addr or ""})
            return jsonify(code=0, success=True, data={"revision": account["staff_binding_revision"] + 1})
        except RuleError as error:
            return jsonify(code=error.status, msg=str(error)), error.status
        except IntegrityError:
            return jsonify(code=409, msg="此员工已绑定其他账号"), 409
        except Exception:
            return jsonify(code=503, msg="员工绑定暂不可用"), 503
    return bp
