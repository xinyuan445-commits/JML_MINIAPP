"""Approval workflow for production configuration changes."""
import json
from datetime import date, datetime
from decimal import Decimal

from flask import Blueprint, g, jsonify, request
from mysql.connector import IntegrityError
import equipment


MODULES = {"process", "workstation", "category", "route", *equipment.MODULES}
APPROVE_PERMISSION = {module: f"{module}.approve" for module in MODULES}
REQUEST_PERMISSION = {
    ("equipment", "create"): "equipment.add",
    ("equipment", "edit"): "equipment.edit",
    ("equipment-capacity", "create"): "equipment-capacity.edit",
    ("equipment-capacity", "edit"): "equipment-capacity.edit",
    ("equipment-capacity", "status"): "equipment-capacity.edit",
    ("process", "create"): "process.add",
    ("process", "edit"): "process.edit",
    ("process", "status"): "process.toggle",
    ("workstation", "create"): "workstation.add",
    ("workstation", "edit"): "workstation.edit",
    ("workstation", "status"): "workstation.toggle",
    ("category", "create"): "category.add",
    ("category", "edit"): "category.edit",
    ("category", "status"): "category.toggle",
    ("route", "create"): "route.add",
    ("route", "edit"): "route.edit",
    ("route", "version"): "route.edit",
    ("route", "status"): "route.toggle",
    ("route", "restore"): "route.restore",
}


def _json_default(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat(sep=" ")
    if isinstance(value, Decimal):
        return float(value)
    raise TypeError(f"Unsupported value: {type(value).__name__}")


def _json_value(value):
    return json.loads(json.dumps(value, ensure_ascii=False, default=_json_default))


def _positive_id(value, field="id"):
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError(f"{field}无效")
    return value


def _add_product_category_names(cur, rows):
    """Display metadata only; never replace the codes in approval payloads."""
    codes = set()
    for row in rows:
        if row['module_type'] != 'route':
            continue
        for field in ('before_data', 'after_data'):
            values = (row.get(field) or {}).get('product_codes')
            if isinstance(values, list):
                codes.update(str(value) for value in values)
    if not codes:
        return
    cur.execute('SELECT code,name FROM bj_product_cost_yx WHERE code IN (' +
                ','.join(['%s'] * len(codes)) + ')', tuple(sorted(codes)))
    names = {str(row['code']): row['name'] for row in cur.fetchall()}
    for row in rows:
        if row['module_type'] == 'route':
            row['product_category_names'] = names


def _text(payload, field, label, limit=255):
    value = payload.get(field)
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
        raise ValueError(f"请填写有效的{label}")
    return value.strip()


def _status(value):
    if value not in (0, 1, False, True):
        raise ValueError("状态无效")
    return int(bool(value))


def _target_id(payload):
    return _positive_id(payload.get("id") or payload.get("route_id"))


def _validate_steps(steps):
    if not isinstance(steps, list) or not steps:
        raise ValueError("请至少配置一道工序")
    for step in steps:
        if not isinstance(step, dict):
            raise ValueError("工序步骤格式无效")
        _positive_id(step.get("process_id"), "工序")
        _positive_id(step.get("station_id"), "工站")


def _route_steps_changed(before_steps, after_steps):
    def signature(steps):
        return [
            (int(step.get("process_id") or 0), int(step.get("station_id") or 0))
            for step in (steps or [])
        ]

    return signature(before_steps) != signature(after_steps)


def _validate_payload(module, action, payload):
    if module in equipment.MODULES:
        if "equipment" in getattr(g, "disabled_pages", set()):
            raise ValueError("设备管理页面已停用")
        normalized = equipment.normalize(module, action, payload)
        payload.clear()
        payload.update(normalized)
        return
    if action != "create":
        if module == "category":
            _text(payload, "code", "类别编码", 64)
        else:
            _target_id(payload)
    if action == "status":
        _status(payload.get("is_enabled") if module == "category" else payload.get("is_active"))
    if module == "process" and action in {"create", "edit"}:
        if action == "create":
            _text(payload, "process_code", "工序编码", 64)
        _text(payload, "process_name", "工序名称", 100)
    elif module == "workstation" and action in {"create", "edit"}:
        if action == "create":
            _text(payload, "station_code", "工站编码", 64)
        _text(payload, "station_name", "工站名称", 100)
    elif module == "category" and action in {"create", "edit"}:
        _text(payload, "name", "产品类别名称", 100)
    elif module == "route" and action == "create":
        _text(payload, "route_code", "路线编码", 64)
        _text(payload, "route_name", "路线名称", 100)
        _text(payload, "dept_code", "部门代码", 64)
        _validate_steps(payload.get("steps"))
    elif module == "route" and action == "edit":
        if payload.get("mode") == "steps":
            _validate_steps(payload.get("steps"))
        else:
            _text(payload, "route_name", "路线名称", 100)
            _text(payload, "dept_code", "部门代码", 64)
    elif module == "route" and action == "version":
        _validate_steps(payload.get("steps"))
        payload["set_default"] = _status(payload.get("set_default", 0))
    elif module == "route" and action == "restore":
        payload["set_default"] = 1


def _snapshot(cur, module, payload):
    if module in equipment.MODULES:
        return equipment.snapshot(cur, module, payload, lock=True)
    if module == "process":
        cur.execute("""SELECT id,process_code,process_name,description,sort,is_active
            FROM mo_process_yx WHERE id=%s""", (_target_id(payload),))
        return _json_value(cur.fetchone())
    if module == "workstation":
        cur.execute("""SELECT id,station_code,station_name,description,is_active
            FROM mo_workstation_yx WHERE id=%s""", (_target_id(payload),))
        return _json_value(cur.fetchone())
    if module == "category":
        code = _text(payload, "code", "类别编码", 64)
        cur.execute("SELECT code,name,is_enabled FROM bj_product_cost_yx WHERE code=%s", (code,))
        return _json_value(cur.fetchone())
    if module == "route":
        route_id = _target_id(payload)
        cur.execute("""SELECT id,route_code,version_group,version_no,parent_route_id,route_name,
            dept_code,dept_name,description,version_note,is_active,is_default,is_current
            FROM mo_route_yx WHERE id=%s""", (route_id,))
        route = cur.fetchone()
        if not route:
            return None
        cur.execute("""SELECT id FROM mo_route_yx
            WHERE version_group=%s AND is_current=1 ORDER BY id DESC LIMIT 1""", (route["version_group"],))
        current = cur.fetchone()
        route["current_route_id"] = current["id"] if current else None
        cur.execute("SELECT product_code FROM mo_route_version_category_yx WHERE route_id=%s ORDER BY product_code", (route_id,))
        route["product_codes"] = [row["product_code"] for row in cur.fetchall()]
        cur.execute("""SELECT s.seq,s.process_id,MIN(ss.station_id) AS station_id
            FROM mo_route_step_yx s
            LEFT JOIN mo_step_station_yx ss ON ss.step_id=s.id
            WHERE s.route_id=%s GROUP BY s.id,s.seq,s.process_id ORDER BY s.seq""", (route_id,))
        route["steps"] = cur.fetchall()
        return _json_value(route)
    raise ValueError("不支持的审批模块")


def _pending_key(module, action, payload):
    if module in equipment.MODULES:
        if action == "create":
            target = (str(payload["station_id"]) if module == "equipment" else
                      json.dumps([payload["device_id"], payload["process_id"], payload["category_code"]], ensure_ascii=False))
            import hashlib
            return f"{module}:create:{hashlib.sha256(target.encode()).hexdigest()}", target
        return f"{module}:target:{payload['id']}", str(payload['id'])
    if action == "create":
        fields = {
            "process": ("process_code", "工序编码"),
            "workstation": ("station_code", "工站编码"),
            "category": ("name", "产品类别名称"),
            "route": ("route_code", "路线编码"),
        }
        field, label = fields[module]
        key = _text(payload, field, label, 100)
        return f"{module}:create:{key.lower()}", key
    target = str(_target_id(payload)) if module != "category" else _text(payload, "code", "类别编码", 64)
    return f"{module}:target:{target}", target


def _replace_route_categories(cur, route_id, product_codes, version_group, sync_categories):
    if not isinstance(product_codes, list):
        raise ValueError("适用产品类别格式无效")
    values = list(dict.fromkeys(str(value).strip() for value in product_codes if str(value).strip()))
    cur.execute("DELETE FROM mo_route_version_category_yx WHERE route_id=%s", (route_id,))
    for code in values:
        cur.execute("INSERT INTO mo_route_version_category_yx (route_id,product_code) VALUES (%s,%s)", (route_id, code))
    cur.execute("SELECT is_current FROM mo_route_yx WHERE id=%s", (route_id,))
    if cur.fetchone()["is_current"]:
        sync_categories(cur, route_id, version_group)


def _replace_route_steps(cur, route_id, steps):
    _validate_steps(steps)
    cur.execute("SELECT id FROM mo_route_step_yx WHERE route_id=%s", (route_id,))
    old_ids = [row["id"] for row in cur.fetchall()]
    if old_ids:
        placeholders = ",".join(["%s"] * len(old_ids))
        cur.execute(f"DELETE FROM mo_step_station_yx WHERE step_id IN ({placeholders})", tuple(old_ids))
    cur.execute("DELETE FROM mo_route_step_yx WHERE route_id=%s", (route_id,))
    for seq, step in enumerate(steps, 1):
        cur.execute("INSERT INTO mo_route_step_yx (route_id,seq,process_id) VALUES (%s,%s,%s)",
            (route_id, seq, step["process_id"]))
        cur.execute("INSERT INTO mo_step_station_yx (step_id,station_id) VALUES (%s,%s)",
            (cur.lastrowid, step["station_id"]))


def _execute_simple(cur, module, action, payload):
    if module in equipment.MODULES:
        return equipment.execute_change(cur, module, action, payload, g.admin_display_name)
    if module == "process":
        if action == "create":
            cur.execute("INSERT INTO mo_process_yx (process_code,process_name,description,sort) VALUES (%s,%s,%s,%s)", (
                _text(payload, "process_code", "工序编码", 64),
                _text(payload, "process_name", "工序名称", 100),
                payload.get("description") or None, int(payload.get("sort") or 0),
            ))
            return cur.lastrowid
        row_id = _target_id(payload)
        if action == "edit":
            cur.execute("UPDATE mo_process_yx SET process_name=%s,description=%s,sort=%s WHERE id=%s", (
                _text(payload, "process_name", "工序名称", 100), payload.get("description") or None,
                int(payload.get("sort") or 0), row_id,
            ))
        else:
            cur.execute("UPDATE mo_process_yx SET is_active=%s WHERE id=%s", (_status(payload.get("is_active")), row_id))
        return row_id
    if module == "workstation":
        if action == "create":
            cur.execute("""INSERT INTO mo_workstation_yx
                (station_code,station_name,description,is_active,create_time,update_time)
                VALUES (%s,%s,%s,1,NOW(),NOW())""", (
                _text(payload, "station_code", "工站编码", 64),
                _text(payload, "station_name", "工站名称", 100), payload.get("description") or "",
            ))
            return cur.lastrowid
        row_id = _target_id(payload)
        if action == "edit":
            cur.execute("UPDATE mo_workstation_yx SET station_name=%s,description=%s,update_time=NOW() WHERE id=%s", (
                _text(payload, "station_name", "工站名称", 100), payload.get("description") or "", row_id,
            ))
        else:
            cur.execute("UPDATE mo_workstation_yx SET is_active=%s,update_time=NOW() WHERE id=%s",
                (_status(payload.get("is_active")), row_id))
        return row_id
    if module == "category":
        if action == "create":
            name = _text(payload, "name", "产品类别名称", 100)
            cur.execute("SELECT code FROM bj_product_cost_yx WHERE name=%s LIMIT 1", (name,))
            if cur.fetchone():
                raise ValueError("产品类别名称已存在")
            cur.execute("SELECT COALESCE(MAX(CAST(code AS UNSIGNED)),0)+1 AS next_code FROM bj_product_cost_yx WHERE code REGEXP '^[0-9]+$'")
            code = str(int(cur.fetchone()["next_code"])).zfill(2)
            cur.execute("""INSERT INTO bj_product_cost_yx
                (code,name,unit,mgmt_rate,mgmt_method,is_enabled,remark)
                VALUES (%s,%s,NULL,0,NULL,1,'报工产品类别')""", (code, name))
            return code
        code = _text(payload, "code", "类别编码", 64)
        if action == "edit":
            name = _text(payload, "name", "产品类别名称", 100)
            cur.execute("SELECT code FROM bj_product_cost_yx WHERE name=%s AND code<>%s LIMIT 1", (name, code))
            if cur.fetchone():
                raise ValueError("产品类别名称已存在")
            cur.execute("UPDATE bj_product_cost_yx SET name=%s WHERE code=%s", (name, code))
        else:
            cur.execute("UPDATE bj_product_cost_yx SET is_enabled=%s WHERE code=%s",
                (_status(payload.get("is_enabled")), code))
        return code
    return None


def _pin_received_routes(cur, version_group):
    # First-step receipt can exist before mo_wo_state_yx is created.
    # Preserve its actual version before changing the category default.
    cur.execute("""INSERT IGNORE INTO mo_wo_route_yx (mo_code,sort_seq,route_id)
        SELECT h.mo_code,h.sort_seq,h.route_id
        FROM mo_handover_yx h JOIN mo_route_yx r ON r.id=h.route_id
        WHERE r.version_group=%s AND h.status='confirmed'
          AND NOT EXISTS (SELECT 1 FROM mo_wo_state_yx s
              WHERE s.mo_code=h.mo_code AND s.sort_seq=h.sort_seq)
          AND h.id=(SELECT MIN(first_h.id) FROM mo_handover_yx first_h
              WHERE first_h.mo_code=h.mo_code AND first_h.sort_seq=h.sort_seq
                AND first_h.status='confirmed')""", (version_group,))


def _execute_route(cur, action, payload, route_usage_count, sync_categories, version_name):
    if action == "create":
        code = _text(payload, "route_code", "路线编码", 64)
        name = _text(payload, "route_name", "路线名称", 100)
        dept_code = _text(payload, "dept_code", "部门代码", 64)
        cur.execute("SELECT id FROM mo_route_yx WHERE route_code=%s", (code,))
        if cur.fetchone():
            raise ValueError("路线编码已存在，请重新提交")
        is_default = _status(payload.get("is_default", 0))
        if is_default:
            cur.execute("UPDATE mo_route_yx SET is_default=0 WHERE dept_code=%s", (dept_code,))
        cur.execute("""INSERT INTO mo_route_yx
            (route_code,version_group,version_no,parent_route_id,route_name,dept_code,
             description,version_note,is_active,is_default,is_current,create_time,update_time)
            VALUES (%s,%s,1,NULL,%s,%s,%s,%s,1,%s,1,NOW(),NOW())""", (
            code, code, name, dept_code, payload.get("description") or "",
            payload.get("version_note") or "", is_default,
        ))
        route_id = cur.lastrowid
        _replace_route_categories(cur, route_id, payload.get("product_codes", []), code, sync_categories)
        _replace_route_steps(cur, route_id, payload.get("steps"))
        return route_id
    route_id = _target_id(payload)
    if action == "edit":
        cur.execute("SELECT id,version_group,is_current FROM mo_route_yx WHERE id=%s FOR UPDATE", (route_id,))
        route = cur.fetchone()
        if not route:
            raise ValueError("路线不存在")
        if route_usage_count(cur, route_id) > 0:
            raise ValueError("路线已使用，请先申请创建新版本")
        if payload.get("mode") == "steps":
            _replace_route_steps(cur, route_id, payload.get("steps"))
        else:
            name = _text(payload, "route_name", "路线名称", 100)
            dept_code = _text(payload, "dept_code", "部门代码", 64)
            is_default = _status(payload.get("is_default", 0))
            if is_default and not route["is_current"]:
                raise ValueError("请先将该版本设为默认版本")
            if is_default:
                cur.execute("UPDATE mo_route_yx SET is_default=0 WHERE dept_code=%s AND id<>%s", (dept_code, route_id))
            cur.execute("""UPDATE mo_route_yx SET route_name=%s,dept_code=%s,is_default=%s,
                description=%s,version_note=%s,update_time=NOW() WHERE id=%s""", (
                name, dept_code, is_default, payload.get("description") or "",
                payload.get("version_note") or "", route_id,
            ))
            _replace_route_categories(cur, route_id, payload.get("product_codes", []), route["version_group"], sync_categories)
        return route_id
    if action == "status":
        active = _status(payload.get("is_active"))
        if not active:
            cur.execute("SELECT is_current,version_group FROM mo_route_yx WHERE id=%s FOR UPDATE", (route_id,))
            route = cur.fetchone()
            if route and route["is_current"]:
                group = route["version_group"]
                cur.execute("""SELECT id FROM mo_route_yx
                    WHERE version_group=%s AND id<>%s LIMIT 1 FOR UPDATE""", (group, route_id))
                if cur.fetchone():
                    raise ValueError("请先将其他版本设为默认，再停用该版本")
                _pin_received_routes(cur, group)
        cur.execute("UPDATE mo_route_yx SET is_active=%s,update_time=NOW() WHERE id=%s",
            (active, route_id))
        return route_id
    if action == "version":
        cur.execute("SELECT * FROM mo_route_yx WHERE id=%s FOR UPDATE", (route_id,))
        source = cur.fetchone()
        if not source:
            raise ValueError("来源路线不存在")
        group = source["version_group"] or source["route_code"]
        cur.execute("""SELECT id,is_current,is_default,is_active FROM mo_route_yx
            WHERE version_group=%s ORDER BY id FOR UPDATE""", (group,))
        versions = cur.fetchall()
        current = next((item for item in versions if item["is_current"]), None)
        set_default = bool(_status(payload.get("set_default", 0))) or not (current and current["is_active"])
        was_default = int(current.get("is_default") or 0) if current else 0
        cur.execute("SELECT COALESCE(MAX(version_no),0)+1 AS next_version FROM mo_route_yx WHERE version_group=%s", (group,))
        version_no = int(cur.fetchone()["next_version"])
        suffix = f"-V{version_no}"
        code = f"{group[:50-len(suffix)]}{suffix}"
        if set_default:
            _pin_received_routes(cur, group)
            cur.execute("UPDATE mo_route_yx SET is_current=0,is_default=0 WHERE version_group=%s", (group,))
        cur.execute("""INSERT INTO mo_route_yx
            (route_code,version_group,version_no,parent_route_id,route_name,dept_code,dept_name,
             is_default,is_current,description,version_note,is_active,create_time,update_time)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,1,NOW(),NOW())""", (
            code, group, version_no, route_id, version_name(source["route_name"], version_no),
            source.get("dept_code"), source.get("dept_name"), was_default if set_default else 0,
            int(set_default),
            source.get("description"), payload.get("version_note") or "由历史路线创建新版本",
        ))
        new_id = cur.lastrowid
        cur.execute("""INSERT INTO mo_route_version_category_yx (route_id,product_code)
            SELECT %s,product_code FROM mo_route_version_category_yx WHERE route_id=%s""", (new_id, route_id))
        _replace_route_steps(cur, new_id, payload.get("steps"))
        if set_default:
            sync_categories(cur, new_id, group)
        return new_id
    if action == "restore":
        cur.execute("SELECT * FROM mo_route_yx WHERE id=%s FOR UPDATE", (route_id,))
        route = cur.fetchone()
        if not route:
            raise ValueError("路线不存在")
        group = route["version_group"]
        cur.execute("SELECT id FROM mo_route_yx WHERE version_group=%s ORDER BY id FOR UPDATE", (group,))
        cur.fetchall()
        cur.execute("SELECT MAX(is_default) AS was_default FROM mo_route_yx WHERE version_group=%s", (group,))
        was_default = int(cur.fetchone()["was_default"] or 0)
        _pin_received_routes(cur, group)
        cur.execute("UPDATE mo_route_yx SET is_current=0,is_default=0 WHERE version_group=%s", (group,))
        cur.execute("UPDATE mo_route_yx SET is_current=1,is_default=%s,is_active=1,update_time=NOW() WHERE id=%s",
            (was_default, route_id))
        sync_categories(cur, route_id, group)
        return route_id
    raise ValueError("不支持的审批操作")


def config_approval_blueprint(
    database,
    route_usage_count,
    sync_categories,
    version_name,
    enqueue_approval=None,
):
    bp = Blueprint("config_approvals", __name__)

    def audit(cur, action, target_id, changes):
        cur.execute("""INSERT INTO mo_admin_audit_log_yx
            (username,action_name,request_method,request_path,target_id,
             request_data,result_code,result_message,ip_address)
            VALUES (%s,%s,%s,%s,%s,%s,0,'',%s)""", (
            g.audit_username, action, request.method, request.path, str(target_id),
            json.dumps(changes, ensure_ascii=False, default=_json_default), request.remote_addr or "",
        ))

    def transaction(work):
        conn = None
        cur = None
        try:
            conn = database()
            cur = conn.cursor(dictionary=True)
            result = work(cur)
            conn.commit()
            return jsonify({"success": True, "code": 0, **result})
        except ValueError as error:
            if conn:
                conn.rollback()
            return jsonify({"code": 400, "msg": str(error)}), 400
        except IntegrityError:
            if conn:
                conn.rollback()
            return jsonify({"code": 409, "msg": "存在重复关联、启用标准或待审批申请，请刷新"}), 409
        except Exception:
            if conn:
                conn.rollback()
            return jsonify({"code": 503, "msg": "审批数据暂不可用，请核对相关初始化及数据库"}), 503
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()

    @bp.post("/api/admin/config-approvals/submit")
    def submit():
        body = request.get_json(silent=True) or {}
        module = body.get("module_type")
        action = body.get("action_type")
        payload = body.get("payload")
        if module not in MODULES or (module, action) not in REQUEST_PERMISSION or not isinstance(payload, dict):
            return jsonify({"code": 400, "msg": "审批申请内容无效"}), 400
        if REQUEST_PERMISSION[(module, action)] not in g.admin_permissions:
            return jsonify({"code": 403, "msg": "当前账号没有提交该申请的权限"}), 403
        try:
            _validate_payload(module, action, payload)
        except ValueError as error:
            return jsonify({"code": 400, "msg": str(error)}), 400

        def work(cur):
            pending_key, target_key = _pending_key(module, action, payload)
            before = None if action == "create" else _snapshot(cur, module, payload)
            if action != "create" and before is None:
                raise ValueError("申请对象不存在")
            if module == "route" and action == "version" and not _route_steps_changed(
                before.get("steps"), payload.get("steps")
            ):
                raise ValueError("请先调整工序后再提交新版本")
            if module == "route" and action == "version" and not before.get("current_route_id"):
                payload["set_default"] = 1
            if module in equipment.MODULES:
                equipment.ensure_revision(payload, before)
                equipment.describe(cur, module, payload, before)
            cur.execute("""INSERT INTO mo_config_approval_yx
                (module_type,action_type,target_key,pending_key,before_data,after_data,
                 applicant_account_id,applicant_name)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""", (
                module, action, target_key, pending_key,
                json.dumps(before, ensure_ascii=False) if before is not None else None,
                json.dumps(_json_value(payload), ensure_ascii=False),
                g.admin_account["id"], g.admin_display_name,
            ))
            approval_id = cur.lastrowid
            request_no = f"APR-{approval_id:08d}"
            cur.execute("UPDATE mo_config_approval_yx SET request_no=%s WHERE id=%s", (request_no, approval_id))
            audit(cur, "提交配置审批", approval_id, {
                "request_no": request_no, "module_type": module, "action_type": action,
            })
            return {"data": {"id": approval_id, "request_no": request_no}}
        return transaction(work)

    @bp.post("/api/admin/config-approvals/update")
    def update_request():
        body = request.get_json(silent=True) or {}
        payload = body.get("payload")
        try:
            approval_id = _positive_id(body.get("id"), "审批编号")
            expected_revision = _positive_id(body.get("revision"), "申请版本")
        except ValueError as error:
            return jsonify({"code": 400, "msg": str(error)}), 400
        if not isinstance(payload, dict):
            return jsonify({"code": 400, "msg": "审批申请内容无效"}), 400

        def work(cur):
            cur.execute("SELECT * FROM mo_config_approval_yx WHERE id=%s FOR UPDATE", (approval_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError("审批申请不存在")
            if row["status"] not in {"pending", "rejected"}:
                raise ValueError("申请已处理，不能修改")
            if int(row.get("revision") or 1) != expected_revision:
                raise ValueError("申请已变更，请刷新后重试")
            if row["applicant_account_id"] != g.admin_account["id"]:
                raise ValueError("只能修改自己提交的申请")
            module = row["module_type"]
            action = row["action_type"]
            permission = REQUEST_PERMISSION.get((module, action))
            if permission not in g.admin_permissions:
                raise ValueError("当前账号没有修改该申请的权限")
            _validate_payload(module, action, payload)
            pending_key, target_key = _pending_key(module, action, payload)
            if action != "create" and target_key != row["target_key"]:
                raise ValueError("不能更换申请对象")
            before = None if action == "create" else _snapshot(cur, module, payload)
            if action != "create" and before is None:
                raise ValueError("申请对象不存在")
            if module in equipment.MODULES:
                equipment.ensure_revision(payload, before)
                equipment.describe(cur, module, payload, before)
            revision = expected_revision + 1
            resubmitting = row["status"] == "rejected"
            cur.execute("""UPDATE mo_config_approval_yx
                SET target_key=%s,pending_key=%s,before_data=%s,after_data=%s,
                    revision=%s,status='pending',reviewer_account_id=NULL,
                    reviewer_name=NULL,review_comment='',review_time=NULL,
                    applicant_seen=0,apply_time=NOW() WHERE id=%s""", (
                target_key, pending_key,
                json.dumps(before, ensure_ascii=False) if before is not None else None,
                json.dumps(_json_value(payload), ensure_ascii=False),
                revision, approval_id,
            ))
            audit(cur, "修改并重新提交配置审批" if resubmitting else "修改配置审批申请", approval_id, {
                "request_no": row["request_no"], "module_type": module,
                "action_type": action, "revision": revision,
            })
            return {"data": {"id": approval_id, "revision": revision, "status": "pending"}}
        return transaction(work)

    @bp.get("/api/admin/config-approvals")
    def approvals():
        scope = request.args.get("scope", "mine")
        page = max(1, request.args.get("current", 1, type=int))
        page_size = min(100, max(10, request.args.get("pageSize", 20, type=int)))
        module_filter = (request.args.get("module_type") or "").strip()
        applicant_filter = (request.args.get("applicant_account_id") or "").strip()
        if applicant_filter:
            if not applicant_filter.isdecimal() or int(applicant_filter) <= 0:
                return jsonify({"code": 400, "msg": "申请人无效"}), 400
            applicant_filter = int(applicant_filter)
        approvable = sorted(module for module in MODULES if APPROVE_PERMISSION[module] in g.admin_permissions)
        where = []
        params = []
        if scope == "mine":
            if "approval.mine" not in g.admin_permissions:
                return jsonify({"code": 403, "msg": "当前账号没有查看申请记录的权限"}), 403
            where.append("applicant_account_id=%s")
            params.append(g.admin_account["id"])
        elif scope in {"pending", "history"}:
            if not approvable:
                return jsonify({"code": 0, "data": [], "total": 0, "applicants": []})
            where.append(f"module_type IN ({','.join(['%s'] * len(approvable))})")
            params.extend(approvable)
            where.append("status='pending'" if scope == "pending" else "status<>'pending'")
        else:
            return jsonify({"code": 400, "msg": "查询范围无效"}), 400
        if module_filter:
            if module_filter not in MODULES:
                return jsonify({"code": 400, "msg": "审批模块无效"}), 400
            where.append("module_type=%s")
            params.append(module_filter)
        applicant_where_sql = " AND ".join(where) or "1=1"
        applicant_params = tuple(params)
        if applicant_filter:
            where.append("applicant_account_id=%s")
            params.append(applicant_filter)
        where_sql = " AND ".join(where) or "1=1"

        def work(cur):
            applicants = []
            if scope == "pending":
                cur.execute(f"""SELECT applicant_account_id,MAX(applicant_name) AS applicant_name
                    FROM mo_config_approval_yx WHERE {applicant_where_sql}
                    GROUP BY applicant_account_id ORDER BY applicant_name,applicant_account_id""",
                    applicant_params)
                applicants = cur.fetchall()
            cur.execute(f"SELECT COUNT(*) AS total FROM mo_config_approval_yx WHERE {where_sql}", tuple(params))
            total = int(cur.fetchone()["total"] or 0)
            cur.execute(f"""SELECT * FROM mo_config_approval_yx WHERE {where_sql}
                ORDER BY id DESC LIMIT %s OFFSET %s""", tuple(params + [page_size, (page - 1) * page_size]))
            rows = cur.fetchall()
            for row in rows:
                for field in ("before_data", "after_data"):
                    if isinstance(row[field], str):
                        row[field] = json.loads(row[field])
            _add_product_category_names(cur, rows)
            return {"data": _json_value(rows), "total": total, "applicants": _json_value(applicants)}
        return transaction(work)

    @bp.get("/api/admin/config-approvals/notifications")
    def notifications():
        approvable = sorted(module for module in MODULES if APPROVE_PERMISSION[module] in g.admin_permissions)

        def work(cur):
            todo = 0
            if approvable:
                placeholders = ",".join(["%s"] * len(approvable))
                cur.execute(f"""SELECT COUNT(*) AS total FROM mo_config_approval_yx
                    WHERE status='pending' AND module_type IN ({placeholders})""", tuple(approvable))
                todo = int(cur.fetchone()["total"] or 0)
            result = 0
            if "approval.mine" in g.admin_permissions:
                cur.execute("""SELECT COUNT(*) AS total FROM mo_config_approval_yx
                    WHERE applicant_account_id=%s AND status<>'pending' AND applicant_seen=0""",
                    (g.admin_account["id"],))
                result = int(cur.fetchone()["total"] or 0)
            return {"data": {"todo": todo, "result": result, "total": todo + result}}
        return transaction(work)

    @bp.post("/api/admin/config-approvals/notifications/read")
    def read_notifications():
        def work(cur):
            cur.execute("""UPDATE mo_config_approval_yx SET applicant_seen=1
                WHERE applicant_account_id=%s AND status<>'pending' AND applicant_seen=0""",
                (g.admin_account["id"],))
            return {"data": {"read": True}}
        return transaction(work)

    @bp.post("/api/admin/config-approvals/review")
    def review():
        body = request.get_json(silent=True) or {}
        try:
            approval_id = _positive_id(body.get("id"), "审批编号")
            expected_revision = _positive_id(body.get("revision"), "申请版本")
        except ValueError as error:
            return jsonify({"code": 400, "msg": str(error)}), 400
        decision = body.get("decision")
        comment = str(body.get("comment") or "").strip()
        if decision not in {"approve", "reject"}:
            return jsonify({"code": 400, "msg": "审批结果无效"}), 400
        if decision == "reject" and not comment:
            return jsonify({"code": 400, "msg": "请填写驳回原因"}), 400
        if len(comment) > 500:
            return jsonify({"code": 400, "msg": "审批意见不能超过500个字符"}), 400

        def work(cur):
            cur.execute("SELECT * FROM mo_config_approval_yx WHERE id=%s FOR UPDATE", (approval_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError("审批申请不存在")
            if row["status"] != "pending":
                raise ValueError("该申请已经处理")
            if int(row.get("revision") or 1) != expected_revision:
                raise ValueError("申请内容已修改，请刷新后重新审批")
            module = row["module_type"]
            if APPROVE_PERMISSION.get(module) not in g.admin_permissions:
                raise ValueError("当前账号没有该模块的审批权限")
            payload = json.loads(row["after_data"]) if isinstance(row["after_data"], str) else row["after_data"]
            before = json.loads(row["before_data"]) if isinstance(row["before_data"], str) else row["before_data"]
            result_target = row["target_key"]
            if decision == "approve":
                if module in equipment.MODULES:
                    _validate_payload(module, row["action_type"], payload)
                if row["action_type"] != "create" and _snapshot(cur, module, payload) != before:
                    raise ValueError("正式数据已变化，请驳回后重新提交申请")
                result_target = (_execute_route(
                    cur, row["action_type"], payload, route_usage_count, sync_categories, version_name,
                ) if module == "route" else _execute_simple(cur, module, row["action_type"], payload))
                status = "approved"
                action_name = "审批通过配置变更"
            else:
                status = "rejected"
                action_name = "驳回配置变更"
            cur.execute("""UPDATE mo_config_approval_yx
                SET status=%s,pending_key=NULL,reviewer_account_id=%s,reviewer_name=%s,
                    review_comment=%s,review_time=NOW(),applicant_seen=0 WHERE id=%s""", (
                status, g.admin_account["id"], g.admin_display_name, comment, approval_id,
            ))
            audit(cur, action_name, approval_id, {
                "request_no": row["request_no"], "module_type": module,
                "action_type": row["action_type"], "result_target": result_target,
                "comment": comment,
            })
            if decision == "approve" and enqueue_approval:
                enqueue_approval(cur, approval_id)
            return {"data": {"id": approval_id, "status": status}}
        return transaction(work)

    return bp
