"""Independent production equipment archives and capacity standards."""
import base64
import json
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, localcontext
from uuid import uuid4

from flask import Blueprint, g, jsonify, request

MODULES = {"equipment", "equipment-capacity"}
PROFILE_FIELDS = ("device_code", "device_name", "device_enabled", "device_type", "workshop", "location", "brand", "model", "serial_no",
                  "commissioned_on", "photo", "remark")
CAPACITY_FIELDS = ("device_id", "process_id", "category_code", "specification", "capacity_mode",
                   "quantity", "unit", "period", "effective_hours", "staffing", "setup_minutes",
                   "basis", "measured_on", "remark", "is_active")
BASES = {"experience", "measured", "manufacturer"}


def json_value(value):
    def encode(item):
        if isinstance(item, (datetime, date)):
            return item.isoformat()
        if isinstance(item, Decimal):
            return format(item, "f")
        raise TypeError(type(item).__name__)
    return json.loads(json.dumps(value, ensure_ascii=False, default=encode))


def text(value, label, maximum=255, required=False):
    if value is None:
        value = ""
    if not isinstance(value, str) or len(value.strip()) > maximum or (required and not value.strip()):
        raise ValueError(f"请填写有效的{label}")
    return value.strip()


def positive_id(value, label="编号"):
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError(f"{label}无效")
    return value


def number(value, label, places=8, maximum=Decimal('999999999999.99999999'), zero=False):
    if isinstance(value, bool) or value is None or value == "":
        raise ValueError(f"请填写有效的{label}")
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError(f"请填写有效的{label}") from None
    if not result.is_finite() or result < 0 or (not zero and result == 0) or result > maximum:
        raise ValueError(f"{label}超出范围")
    if result.as_tuple().exponent < -places:
        raise ValueError(f"{label}最多{places}位小数")
    return result


def optional_date(value, label):
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except (TypeError, ValueError):
        raise ValueError(f"{label}无效") from None


def photo_value(value):
    if not value:
        return None
    if not isinstance(value, str) or len(value) > 1400000:
        raise ValueError("照片请使用1MB以内的PNG、JPEG或WebP")
    for mime, signatures in (("png", (b'\x89PNG\r\n\x1a\n',)),
                             ("jpeg", (b'\xff\xd8\xff',)), ("webp", (b'RIFF',))):
        prefix = f"data:image/{mime};base64,"
        if value.startswith(prefix):
            try:
                data = base64.b64decode(value[len(prefix):], validate=True)
            except ValueError:
                break
            valid = data.startswith(signatures) and (mime != "webp" or data[8:12] == b'WEBP')
            if valid and len(data) <= 1024 * 1024:
                return value
            break
    raise ValueError("照片格式无效，请重新选择")


def normalize(module, action, payload):
    if action not in ({"create", "edit"} if module == "equipment" else {"create", "edit", "status"}):
        raise ValueError("不支持的设备操作")
    result = {}
    if action != "create":
        result["id"] = positive_id(payload.get("id"))
        result["revision"] = positive_id(payload.get("revision"), "正式资料版本")
    if action == "status":
        if type(payload.get("is_active")) is not int or payload["is_active"] not in (0, 1):
            raise ValueError("状态无效")
        return {**result, "is_active": payload["is_active"]}
    new_device = payload.get("new_device", False) if module == "equipment" else False
    if type(new_device) is not bool:
        raise ValueError("设备创建方式无效")
    result["device_id"] = text(payload.get("device_id") or (str(uuid4()) if new_device else ""), "设备", 64, True)
    if module == "equipment":
        result["new_device"] = new_device
        result["station_id"] = positive_id(payload.get("station_id"), "工站")
        revision = payload.get("profile_revision", 0)
        if type(revision) is not int or revision < 0:
            raise ValueError("设备资料版本无效")
        result["profile_revision"] = revision
        for field in PROFILE_FIELDS:
            if field == "device_enabled":
                enabled = payload.get(field, 1)
                if type(enabled) is not int or enabled not in (0, 1):
                    raise ValueError("设备状态无效")
                result[field] = enabled
            elif field == "commissioned_on":
                result[field] = optional_date(payload.get(field), "投用日期")
            elif field == "photo":
                result[field] = photo_value(payload.get(field))
            else:
                limit = 1000 if field == "remark" else 255 if field == "location" else 64 if field == "device_code" else 100
                result[field] = text(payload.get(field), {"device_type": "设备类型", "device_code": "设备编号", "device_name": "设备名称"}.get(field, field),
                                     limit, field in {"device_code", "device_name", "device_type"})
        return result
    result.update({
        "process_id": positive_id(payload.get("process_id"), "工序"),
        "category_code": text(payload.get("category_code"), "产品类别", 64),
        "specification": text(payload.get("specification"), "规格说明"),
        "capacity_mode": payload.get("capacity_mode"),
        "unit": text(payload.get("unit"), "计量单位", 30),
        "basis": payload.get("basis"),
        "measured_on": optional_date(payload.get("measured_on"), "测定日期"),
        "remark": text(payload.get("remark"), "备注", 1000),
        "is_active": payload.get("is_active", 1),
    })
    if type(result["is_active"]) is not int or result["is_active"] not in (0, 1):
        raise ValueError("状态无效")
    if not isinstance(result["basis"], str) or result["basis"] not in BASES:
        raise ValueError("请选择标准依据")
    staffing = payload.get("staffing")
    result["staffing"] = None if staffing in (None, "") else positive_id(staffing, "标准配员")
    if result["staffing"] and result["staffing"] > 100000:
        raise ValueError("标准配员超出范围")
    setup = payload.get("setup_minutes")
    result["setup_minutes"] = None if setup in (None, "") else number(setup, "准备时间", 6, Decimal('99999999'), True)
    if result["capacity_mode"] == "unlimited":
        result.update(quantity=None, period=None, effective_hours=None)
    elif result["capacity_mode"] == "finite":
        result["quantity"] = number(payload.get("quantity"), "标准数量")
        if not result["unit"]:
            raise ValueError("请选择计量单位")
        result["period"] = payload.get("period")
        if not isinstance(result["period"], str) or result["period"] not in {"minute", "hour", "day", "shift"}:
            raise ValueError("请选择时间周期")
        result["effective_hours"] = (number(payload.get("effective_hours"), "有效工时", 6, Decimal(24))
                                      if result["period"] in {"day", "shift"} else None)
    else:
        raise ValueError("请选择产能模式")
    return json_value(result)


def conversion(standard, target_quantity=None, unit=None):
    if target_quantity is not None:
        target_quantity = number(target_quantity, "计算数量")
    if not standard:
        return {"state": "unconfigured", "hourly": None, "unit_minutes": None, "target_minutes": None}
    if standard.get("is_active", 1) != 1:
        return {"state": "inactive", "hourly": None, "unit_minutes": None, "target_minutes": None}
    if target_quantity is not None:
        if standard.get("unit") and unit != standard["unit"]:
            raise ValueError("计算单位与标准不一致")
    if standard.get("capacity_mode") == "unlimited":
        return {"state": "unlimited", "hourly": None, "unit_minutes": None, "target_minutes": None}
    try:
        quantity = number(standard.get("quantity"), "标准数量")
        period = standard.get("period")
        if period in {"day", "shift"}:
            minutes = number(standard.get("effective_hours"), "有效工时", 6, Decimal(24)) * 60
        elif period in {"minute", "hour"}:
            minutes = Decimal(1 if period == "minute" else 60)
        else:
            raise ValueError("时间周期缺失")
        if standard.get("capacity_mode") != "finite" or not standard.get("unit"):
            raise ValueError("标准待补")
    except ValueError:
        return {"state": "incomplete", "hourly": None, "unit_minutes": None, "target_minutes": None}
    with localcontext() as context:
        context.prec = 50
        return json_value({"state": "finite", "hourly": quantity * 60 / minutes,
                           "unit_minutes": minutes / quantity,
                           "target_minutes": None if target_quantity is None else target_quantity * minutes / quantity})


def select_standard(rows, process_id, category_code=""):
    enabled = [r for r in rows if r["process_id"] == process_id and r["is_active"] == 1]
    return next((r for r in enabled if r["category_code"] == category_code), None) or next(
        (r for r in enabled if not r["category_code"]), None)


def devices(cur, device_id=None, lock=False):
    query = "SELECT *,device_id AS id,device_name AS name,device_enabled AS enable FROM mo_equipment_device_yx"
    if device_id is not None:
        query += " WHERE device_id=%s"
    query += " ORDER BY device_code" + (" FOR UPDATE" if lock else "")
    cur.execute(query, (device_id,) if device_id is not None else ())
    return json_value(cur.fetchall())


def snapshot(cur, module, payload, lock=False):
    suffix = " FOR UPDATE" if lock else ""
    if module == "equipment":
        cur.execute("""SELECT e.id,e.station_id,e.device_id,e.revision,
            p.device_code,p.device_name,p.device_enabled,
            p.device_type,p.workshop,p.location,p.brand,p.model,p.serial_no,p.commissioned_on,
            p.photo,p.remark,p.revision AS profile_revision
            FROM mo_equipment_yx e JOIN mo_equipment_device_yx p ON p.device_id=e.device_id
            WHERE e.id=%s""" + suffix, (payload["id"],))
    else:
        cur.execute("SELECT id," + ",".join(CAPACITY_FIELDS) +
                    ",revision FROM mo_equipment_capacity_yx WHERE id=%s" + suffix, (payload["id"],))
    return json_value(cur.fetchone())


def ensure_revision(payload, before):
    if before and payload["revision"] != before["revision"]:
        raise ValueError("正式资料已变更，请刷新后重试")


def describe(cur, module, payload, before):
    """Server-resolved labels for the approval center; never trust client labels."""
    values = {**(before or {}), **payload}
    if module != "equipment" or not values.get("new_device"):
        source = devices(cur, values["device_id"])
        if not source:
            raise ValueError("设备不存在")
        if module != "equipment":
            payload["device_name"] = source[0]["name"]
    if module == "equipment":
        cur.execute("SELECT station_code,station_name FROM mo_workstation_yx WHERE id=%s", (values["station_id"],))
        row = cur.fetchone()
        if not row:
            raise ValueError("工站不存在")
        payload.update(row)
    else:
        cur.execute("SELECT process_name FROM mo_process_yx WHERE id=%s", (values["process_id"],))
        row = cur.fetchone()
        if not row:
            raise ValueError("工序不存在")
        payload.update(row)
        payload["category_name"] = "通用"
        if values["category_code"]:
            cur.execute("SELECT name FROM bj_product_cost_yx WHERE code=%s", (values["category_code"],))
            row = cur.fetchone()
            if not row:
                raise ValueError("产品类别不存在")
            payload["category_name"] = row["name"]


def execute_change(cur, module, action, payload, actor):
    values = normalize(module, action, payload)
    before = None if action == "create" else snapshot(cur, module, values, True)
    if action != "create" and not before:
        raise ValueError("设备资料不存在")
    ensure_revision(values, before)
    device_id = before["device_id"] if action == "status" else values["device_id"]
    if module == "equipment-capacity" and before and device_id != before["device_id"]:
        raise ValueError("不能更换产能标准所属设备")
    original = devices(cur, device_id, True)
    if module != "equipment" and (not original or str(original[0]["enable"]) != "1"):
        if action != "status" or values["is_active"] != 0:
            raise ValueError("设备不存在或已停用")
    if module == "equipment":
        if values["new_device"] and original:
            raise ValueError("设备已建立，请刷新后选择已有设备")
        if not values["new_device"] and not original:
            raise ValueError("设备不存在")
        cur.execute("SELECT device_id FROM mo_equipment_device_yx WHERE device_code=%s AND device_id<>%s FOR UPDATE",
                    (values["device_code"], device_id))
        if cur.fetchone():
            raise ValueError("设备编号已存在")
        cur.execute("SELECT id,is_active FROM mo_workstation_yx WHERE id=%s FOR UPDATE", (values["station_id"],))
        station = cur.fetchone()
        if not station or (not station["is_active"] and (not before or before["station_id"] != values["station_id"])):
            raise ValueError("工站不存在或已停用")
        if (original and not original[0]["enable"] and
                (not before or before["device_id"] != device_id)):
            raise ValueError("设备已停用，不能建立新关联")
        cur.execute("SELECT id FROM mo_equipment_yx WHERE (station_id=%s OR device_id=%s) AND id<>%s FOR UPDATE",
                    (values["station_id"], device_id, values.get("id", 0)))
        if cur.fetchone():
            raise ValueError("工站或设备已有关联，请刷新")
        cur.execute("SELECT revision FROM mo_equipment_device_yx WHERE device_id=%s FOR UPDATE", (device_id,))
        profile = cur.fetchone()
        if (profile["revision"] if profile else 0) != values["profile_revision"]:
            raise ValueError("设备生产资料已变化，请重新提交")
        fields = list(PROFILE_FIELDS)
        if profile:
            cur.execute("UPDATE mo_equipment_device_yx SET " + ",".join(f"{f}=%s" for f in fields) +
                        ",revision=revision+1,updated_by=%s WHERE device_id=%s",
                        tuple(values[f] for f in fields) + (actor, device_id))
        else:
            cur.execute("INSERT INTO mo_equipment_device_yx (device_id," + ",".join(fields) +
                        ",updated_by) VALUES (" + ",".join(["%s"] * (len(fields) + 2)) + ")",
                        (device_id,) + tuple(values[f] for f in fields) + (actor,))
        if action == "create":
            cur.execute("INSERT INTO mo_equipment_yx (station_id,device_id) VALUES (%s,%s)",
                        (values["station_id"], device_id))
            target_id = cur.lastrowid
        else:
            target_id = values["id"]
            cur.execute("UPDATE mo_equipment_yx SET station_id=%s,device_id=%s,revision=revision+1 WHERE id=%s",
                        (values["station_id"], device_id, target_id))
    else:
        if action == "status":
            values = normalize(module, "edit", {**before, **values})
        cur.execute("SELECT station_id FROM mo_equipment_yx WHERE device_id=%s FOR UPDATE", (device_id,))
        binding = cur.fetchone()
        if not binding:
            raise ValueError("请先建立设备档案")
        if values["is_active"]:
            cur.execute("""SELECT p.id FROM mo_process_yx p JOIN mo_route_step_yx s ON s.process_id=p.id
                JOIN mo_step_station_yx ss ON ss.step_id=s.id
                WHERE p.id=%s AND p.is_active=1 AND ss.station_id=%s LIMIT 1""",
                        (values["process_id"], binding["station_id"]))
            if not cur.fetchone():
                cur.execute("""SELECT p.id FROM mo_process_yx p JOIN mo_workstation_yx w ON w.id=%s
                    WHERE p.id=%s AND p.is_active=1 AND w.is_active=1 AND p.process_name=w.station_name""",
                            (binding["station_id"], values["process_id"]))
                if not cur.fetchone():
                    raise ValueError("该工站未配置此有效工序")
            if values["category_code"]:
                cur.execute("SELECT code FROM bj_product_cost_yx WHERE code=%s AND is_enabled=1", (values["category_code"],))
                if not cur.fetchone():
                    raise ValueError("产品类别不存在或已停用")
            cur.execute("""SELECT id FROM mo_equipment_capacity_yx WHERE device_id=%s AND process_id=%s
                AND category_code=%s AND is_active=1 AND id<>%s FOR UPDATE""",
                        (device_id, values["process_id"], values["category_code"], values.get("id", 0)))
            if cur.fetchone():
                raise ValueError("该工序和类别已有启用标准")
        if action == "create":
            cur.execute("INSERT INTO mo_equipment_capacity_yx (" + ",".join(CAPACITY_FIELDS) + ") VALUES (" +
                        ",".join(["%s"] * len(CAPACITY_FIELDS)) + ")", tuple(values[f] for f in CAPACITY_FIELDS))
            target_id = cur.lastrowid
        else:
            target_id = values["id"]
            cur.execute("UPDATE mo_equipment_capacity_yx SET " + ",".join(f"{f}=%s" for f in CAPACITY_FIELDS) +
                        ",revision=revision+1 WHERE id=%s", tuple(values[f] for f in CAPACITY_FIELDS) + (target_id,))
    after = snapshot(cur, module, {"id": target_id})
    history_before = dict(before) if before else None
    history_after = dict(after)
    for record in (history_before, history_after):
        if record is None:
            continue
        original_record = devices(cur, record["device_id"])
        record.setdefault("device_name", original_record[0]["name"] if original_record else "设备资料缺失")
        if module == "equipment":
            cur.execute("SELECT station_code,station_name FROM mo_workstation_yx WHERE id=%s", (record["station_id"],))
            record.update(cur.fetchone() or {})
    cur.execute("""INSERT INTO mo_equipment_history_yx
        (module_type,target_id,device_id,before_data,after_data,approved_by) VALUES (%s,%s,%s,%s,%s,%s)""",
                (module, target_id, device_id, json.dumps(history_before, ensure_ascii=False) if before else None,
                 json.dumps(history_after, ensure_ascii=False), actor))
    return target_id


def equipment_blueprint(database):
    bp = Blueprint("equipment", __name__)

    def read(work):
        conn = cur = None
        try:
            conn = database()
            cur = conn.cursor(dictionary=True)
            return jsonify({"code": 0, "data": json_value(work(cur))})
        except ValueError as error:
            return jsonify({"code": 400, "msg": str(error)}), 400
        except Exception:
            return jsonify({"code": 503, "msg": "设备资料暂不可用，请核对设备数据及设备管理迁移"}), 503
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()

    def pending(cur, module, rows):
        cur.execute("""SELECT * FROM mo_config_approval_yx WHERE module_type=%s AND
            (status='pending' OR (status='rejected' AND applicant_account_id=%s AND action_type IN ('create','edit')))
            ORDER BY id DESC""", (module, g.admin_account["id"]))
        existing = {str(row["id"]): row for row in rows}
        for row in cur.fetchall():
            payload = json.loads(row["after_data"]) if isinstance(row["after_data"], str) else row["after_data"]
            target = existing.get(str(row["target_key"])) if row["action_type"] != "create" else None
            if target is None:
                if row["action_type"] != "create":
                    continue
                target = {**payload, "id": -row["id"]}
                rows.append(target)
            if target.get("approval_id"):
                continue
            target.update(approval_status=row["status"], approval_id=row["id"], approval_action=row["action_type"],
                          approval_payload=payload, approval_revision=row["revision"],
                          approval_can_edit=row["applicant_account_id"] == g.admin_account["id"])
        return rows

    @bp.get("/api/mo/equipment/options")
    def options():
        def work(cur):
            originals = devices(cur)
            profiles = {r["device_id"]: r for r in originals}
            cur.execute("SELECT id,station_id,device_id FROM mo_equipment_yx")
            bindings = cur.fetchall()
            cur.execute("SELECT id,station_code,station_name,is_active FROM mo_workstation_yx ORDER BY station_code")
            stations = cur.fetchall()
            cur.execute("""SELECT DISTINCT p.id,p.process_name,ss.station_id FROM mo_process_yx p
                JOIN mo_route_step_yx s ON s.process_id=p.id JOIN mo_step_station_yx ss ON ss.step_id=s.id
                WHERE p.is_active=1
                UNION
                SELECT p.id,p.process_name,w.id AS station_id FROM mo_process_yx p
                JOIN mo_workstation_yx w ON w.station_name=p.process_name
                WHERE p.is_active=1 AND w.is_active=1
                ORDER BY process_name""")
            processes = cur.fetchall()
            cur.execute("SELECT code,name,unit FROM bj_product_cost_yx WHERE is_enabled=1 ORDER BY name")
            categories = cur.fetchall()
            cur.execute("SELECT DISTINCT unit FROM mo_equipment_capacity_yx WHERE unit<>'' ORDER BY unit")
            standard_units = {r["unit"] for r in cur.fetchall()}
            return {"devices": [{**r, "profile": profiles.get(r["id"])} for r in originals],
                    "bindings": bindings,
                    "stations": stations, "processes": processes, "categories": categories,
                    "types": sorted({r["device_type"] for r in profiles.values()}),
                    "workshops": sorted({r["workshop"] for r in profiles.values() if r["workshop"]}),
                    "units": sorted({"件", "套", "张", "面", "片", "个", "米", "公斤"} |
                                    standard_units | {r["unit"] for r in categories if r.get("unit")})}
        return read(work)

    @bp.get("/api/mo/equipment/list")
    def listing():
        def work(cur):
            cur.execute("""SELECT e.id,e.station_id,e.device_id,e.revision,
                p.device_code,p.device_name,p.device_enabled,
                p.device_type,p.workshop,p.location,p.brand,p.model,p.serial_no,p.commissioned_on,p.remark,
                p.revision AS profile_revision,w.station_code,w.station_name,
                w.is_active AS station_active,
                (SELECT COUNT(*) FROM mo_equipment_capacity_yx c WHERE c.device_id=e.device_id AND c.is_active=1) AS capacity_count
                FROM mo_equipment_yx e JOIN mo_equipment_device_yx p ON p.device_id=e.device_id
                JOIN mo_workstation_yx w ON w.id=e.station_id ORDER BY w.station_code""")
            rows = pending(cur, "equipment", json_value(cur.fetchall()))
            for row in rows:
                row["device_active"] = row.get("device_enabled") == 1
            return rows
        return read(work)

    @bp.get("/api/mo/equipment/detail")
    def detail():
        def work(cur):
            target = request.args.get("id", type=int)
            row = snapshot(cur, "equipment", {"id": positive_id(target)})
            if not row:
                raise ValueError("设备档案不存在")
            can_capacity = "equipment-capacity.view" in g.admin_permissions
            cur.execute("SELECT id," + ",".join(CAPACITY_FIELDS) +
                        ",revision FROM mo_equipment_capacity_yx WHERE device_id=%s ORDER BY id DESC", (row["device_id"],))
            standards = pending(cur, "equipment-capacity", json_value(cur.fetchall()))
            row["standards"] = [r for r in standards if r["device_id"] == row["device_id"]] if can_capacity else []
            for standard in row["standards"]:
                standard["conversion"] = conversion(standard)
            cur.execute("""SELECT * FROM mo_equipment_history_yx WHERE
                (module_type='equipment' AND target_id=%s) OR device_id=%s ORDER BY id DESC""", (target, row["device_id"]))
            row["history"] = [r for r in cur.fetchall() if can_capacity or r["module_type"] == "equipment"]
            return row
        return read(work)

    @bp.get("/api/mo/equipment/approval")
    def approval():
        def work(cur):
            target = positive_id(request.args.get("id", type=int), "申请编号")
            cur.execute("SELECT * FROM mo_config_approval_yx WHERE id=%s", (target,))
            row = cur.fetchone()
            if (not row or row["module_type"] not in MODULES or
                    row["applicant_account_id"] != g.admin_account["id"] or
                    row["status"] not in {"pending", "rejected"}):
                raise ValueError("申请不存在或不可修改")
            for field in ("before_data", "after_data"):
                if isinstance(row[field], str):
                    row[field] = json.loads(row[field])
            if row["action_type"] != "create":
                row["current_data"] = snapshot(cur, row["module_type"], row["after_data"])
            return row
        return read(work)

    @bp.get("/api/mo/equipment/preview")
    def preview():
        def work(_cur):
            standard = {key: request.args.get(key) for key in
                        ("capacity_mode", "quantity", "unit", "period", "effective_hours")}
            return conversion(standard, request.args.get("target_quantity"), request.args.get("unit"))
        return read(work)

    @bp.get("/api/mo/equipment/calculate")
    def calculate():
        def work(cur):
            equipment_id = positive_id(request.args.get("equipment_id", type=int), "设备档案")
            process_id = positive_id(request.args.get("process_id", type=int), "工序")
            row = snapshot(cur, "equipment", {"id": equipment_id})
            if not row:
                raise ValueError("设备档案不存在")
            cur.execute("SELECT id," + ",".join(CAPACITY_FIELDS) + ",revision FROM mo_equipment_capacity_yx WHERE device_id=%s",
                        (row["device_id"],))
            standard = select_standard(cur.fetchall(), process_id, request.args.get("category_code", ""))
            result = conversion(standard, request.args.get("quantity"), request.args.get("unit"))
            return {**result, "standard_id": standard["id"] if standard else None}
        return read(work)

    return bp
