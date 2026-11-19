"""管理后台：正常报工数量规则。"""
import json

from flask import Blueprint, g, jsonify, request


SETTING_FIELDS = (
    "completion_not_exceed_received",
    "receive_not_exceed_previous_completed",
    "completion_not_exceed_previous_completed",
)


def _body():
    value = request.get_json(silent=True)
    if not isinstance(value, dict):
        raise ValueError("请求内容无效")
    return value


def _boolean(body, key):
    value = body.get(key)
    if value not in (True, False, 0, 1):
        raise ValueError("开关参数错误")
    return int(bool(value))


def _revision(body):
    value = body.get("revision")
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError("配置版本错误")
    return value


def _audit(cur, action, target, data):
    cur.execute("""
        INSERT INTO mo_admin_audit_log_yx
          (username,action_name,request_method,request_path,target_id,
           request_data,result_code,result_message,ip_address)
        VALUES (%s,%s,%s,%s,%s,%s,0,'',%s)
    """, (g.audit_username, action, request.method, request.path, str(target),
          json.dumps(data, ensure_ascii=False), request.remote_addr or ""))


def quantity_rules_blueprint(database):
    bp = Blueprint("quantity_rules", __name__)

    def run(work, write=False):
        conn = cur = None
        try:
            conn = database()
            cur = conn.cursor(dictionary=True)
            result = work(cur)
            if write:
                conn.commit()
            return jsonify({"code": 0, "data": result})
        except ValueError as exc:
            if conn:
                conn.rollback()
            return jsonify({"code": 400, "msg": str(exc)}), 400
        except Exception:
            if conn:
                conn.rollback()
            return jsonify({"code": 503, "msg": "报工数量规则暂不可用"}), 503
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()

    @bp.get("/api/admin/quantity-rules")
    def get_rules():
        def work(cur):
            cur.execute("SELECT * FROM mo_quantity_rule_setting_yx WHERE id=1")
            setting = cur.fetchone()
            if not setting:
                raise ValueError("请先初始化报工数量规则")
            for field in SETTING_FIELDS:
                setting[field] = bool(setting[field])
            return {
                "setting": setting,
                "scope": "041",
            }
        return run(work)

    @bp.post("/api/admin/quantity-rules/setting/save")
    def save_setting():
        def work(cur):
            body = _body()
            revision = _revision(body)
            values = [_boolean(body, field) for field in SETTING_FIELDS]
            cur.execute("SELECT revision FROM mo_quantity_rule_setting_yx WHERE id=1 FOR UPDATE")
            current = cur.fetchone()
            if not current or int(current["revision"]) != revision:
                raise ValueError("规则已变化，请刷新后重试")
            cur.execute("""
                UPDATE mo_quantity_rule_setting_yx
                SET completion_not_exceed_received=%s,
                    receive_not_exceed_previous_completed=%s,
                    completion_not_exceed_previous_completed=%s,
                    revision=revision+1,updated_by=%s
                WHERE id=1 AND revision=%s
            """, (*values, g.audit_username, revision))
            _audit(cur, "修改报工数量规则", 1, dict(zip(SETTING_FIELDS, values)))
            return {"revision": revision + 1}
        return run(work, True)

    return bp
