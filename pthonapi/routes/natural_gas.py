from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import datetime, timedelta
import uuid

from flask import Blueprint, request, jsonify

from models.db2 import get_db2


natural_gas_bp = Blueprint("natural_gas", __name__, url_prefix="/api/factory/natural-gas")


def _ok(data=None, msg="success"):
    return jsonify({"code": 0, "msg": msg, "data": data})


def _err(msg, status=400, error=None):
    payload = {"code": 1, "msg": msg}
    if error:
        payload["error"] = str(error)
    return jsonify(payload), status


def _make_id():
    return uuid.uuid4().hex


def _make_doc_no():
    return "TRQ-" + datetime.now().strftime("%Y%m%d-%H%M%S%f")[:-3]


def _to_decimal(value, field_name):
    try:
        return Decimal(str(value)).quantize(Decimal("0.00"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f"{field_name} 格式不正确")


def _to_int_flag(value, default=1):
    if value in (None, ""):
        return default
    if str(value) in ("1", "true", "True"):
        return 1
    if str(value) in ("0", "false", "False"):
        return 0
    raise ValueError("is_enable 参数非法")


def _parse_date_range(start_date, end_date):
    start_dt = None
    end_dt = None
    if start_date:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    if end_date:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
    return start_dt, end_dt


def _get_device(cur, device_id, only_enabled=False):
    sql = """
        SELECT
            id,
            device_code,
            device_name,
            factory_code,
            factory_name,
            is_enable,
            remark,
            sort_no,
            created_staff_id,
            update_staff_id,
            created_time,
            update_time
        FROM jml_natural_gas_device
        WHERE id = %s
    """
    params = [device_id]
    if only_enabled:
        sql += " AND is_enable = 1"
    cur.execute(sql, params)
    return cur.fetchone()


def _get_latest_log(cur, device_id):
    cur.execute(
        """
        SELECT
            l.id,
            l.name,
            l.daily_reading,
            l.before_reading,
            l.before_usage,
            l.created_time
        FROM jml_natural_gas_log l
        INNER JOIN jml_natural_gas_log_rel r ON r.log_id = l.id
        WHERE r.device_id = %s
        ORDER BY r.created_time DESC, l.created_time DESC, l.id DESC
        LIMIT 1
        """,
        (device_id,),
    )
    return cur.fetchone()


@natural_gas_bp.get("/device/list")
def device_list():
    conn = None
    cur = None
    try:
        factory_code = (request.args.get("factory_code") or "").strip().upper()
        keyword = (request.args.get("keyword") or "").strip()
        is_enable = request.args.get("is_enable")

        sql = """
            SELECT
                id,
                device_code,
                device_name,
                factory_code,
                factory_name,
                is_enable,
                remark,
                sort_no,
                created_staff_id,
                update_staff_id,
                created_time,
                update_time
            FROM jml_natural_gas_device
            WHERE 1 = 1
        """
        params = []

        if factory_code:
            sql += " AND factory_code = %s"
            params.append(factory_code)

        if keyword:
            sql += " AND (device_code LIKE %s OR device_name LIKE %s OR factory_name LIKE %s)"
            like_value = f"%{keyword}%"
            params.extend([like_value, like_value, like_value])

        if is_enable not in (None, ""):
            sql += " AND is_enable = %s"
            params.append(_to_int_flag(is_enable))

        sql += " ORDER BY is_enable DESC, sort_no ASC, created_time DESC"

        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params)
        rows = cur.fetchall()

        return _ok(rows)
    except ValueError as e:
        return _err(str(e))
    except Exception as e:
        return _err("error", status=500, error=e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@natural_gas_bp.get("/device/detail")
def device_detail():
    conn = None
    cur = None
    try:
        device_id = (request.args.get("id") or "").strip()
        if not device_id:
            return _err("缺少参数：id")

        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        row = _get_device(cur, device_id)
        if not row:
            return _ok(None, "not found")

        return _ok(row)
    except Exception as e:
        return _err("error", status=500, error=e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@natural_gas_bp.post("/device/save")
def device_save():
    conn = None
    cur = None
    try:
        data = request.get_json(silent=True) or {}
        device_id = (data.get("id") or "").strip()
        device_code = (data.get("device_code") or "").strip()
        device_name = (data.get("device_name") or "").strip()
        factory_code = (data.get("factory_code") or "").strip().upper()
        factory_name = (data.get("factory_name") or "").strip()
        remark = (data.get("remark") or "").strip()
        staff_id = (data.get("staff_id") or "").strip() or None
        sort_no = int(data.get("sort_no") or 0)
        is_enable = _to_int_flag(data.get("is_enable"), default=1)

        if not device_code:
            return _err("缺少参数：device_code")
        if not device_name:
            return _err("缺少参数：device_name")
        if not factory_code:
            return _err("缺少参数：factory_code")
        if not factory_name:
            return _err("缺少参数：factory_name")

        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        cur.execute(
            "SELECT id FROM jml_natural_gas_device WHERE device_code = %s",
            (device_code,),
        )
        exists = cur.fetchone()
        if exists and exists["id"] != device_id:
            return _err("设备编号已存在")

        if device_id:
            cur.execute("SELECT id FROM jml_natural_gas_device WHERE id = %s", (device_id,))
            if not cur.fetchone():
                return _err("设备不存在")

            cur.execute(
                """
                UPDATE jml_natural_gas_device
                SET device_code = %s,
                    device_name = %s,
                    factory_code = %s,
                    factory_name = %s,
                    is_enable = %s,
                    remark = %s,
                    sort_no = %s,
                    update_staff_id = %s
                WHERE id = %s
                """,
                (
                    device_code,
                    device_name,
                    factory_code,
                    factory_name,
                    is_enable,
                    remark or None,
                    sort_no,
                    staff_id,
                    device_id,
                ),
            )
            conn.commit()
            return _ok({"id": device_id}, "success")

        new_id = _make_id()
        cur.execute(
            """
            INSERT INTO jml_natural_gas_device
            (
                id, device_code, device_name, factory_code, factory_name,
                is_enable, remark, sort_no, created_staff_id, update_staff_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                new_id,
                device_code,
                device_name,
                factory_code,
                factory_name,
                is_enable,
                remark or None,
                sort_no,
                staff_id,
                staff_id,
            ),
        )
        conn.commit()
        return _ok({"id": new_id}, "success")
    except ValueError as e:
        if conn:
            conn.rollback()
        return _err(str(e))
    except Exception as e:
        if conn:
            conn.rollback()
        return _err("error", status=500, error=e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@natural_gas_bp.post("/device/enable")
def device_enable():
    conn = None
    cur = None
    try:
        data = request.get_json(silent=True) or {}
        device_id = (data.get("id") or "").strip()
        staff_id = (data.get("staff_id") or "").strip() or None
        is_enable = _to_int_flag(data.get("is_enable"), default=1)

        if not device_id:
            return _err("缺少参数：id")

        conn = get_db2()
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE jml_natural_gas_device
            SET is_enable = %s, update_staff_id = %s
            WHERE id = %s
            """,
            (is_enable, staff_id, device_id),
        )
        conn.commit()

        if cur.rowcount <= 0:
            return _ok(None, "not found")
        return _ok({"id": device_id, "is_enable": is_enable})
    except ValueError as e:
        if conn:
            conn.rollback()
        return _err(str(e))
    except Exception as e:
        if conn:
            conn.rollback()
        return _err("error", status=500, error=e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@natural_gas_bp.get("/before-reading")
def before_reading():
    conn = None
    cur = None
    try:
        device_id = (request.args.get("device_id") or "").strip()
        if not device_id:
            return _err("缺少参数：device_id")

        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        device = _get_device(cur, device_id)
        if not device:
            return _err("设备不存在")

        latest = _get_latest_log(cur, device_id)
        before_reading_value = latest["daily_reading"] if latest else None
        data = {
            "device_id": device_id,
            "factory_code": device["factory_code"],
            "factory_name": device["factory_name"],
            "device_code": device["device_code"],
            "device_name": device["device_name"],
            "before_reading": str(before_reading_value) if before_reading_value is not None else None,
            "is_first_reading": latest is None,
            "last_log_id": latest["id"] if latest else None,
            "last_created_time": latest["created_time"] if latest else None,
        }
        return _ok(data)
    except Exception as e:
        return _err("error", status=500, error=e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@natural_gas_bp.post("/save")
def save_log():
    conn = None
    cur = None
    try:
        data = request.get_json(silent=True) or {}
        device_id = (data.get("device_id") or "").strip()
        natural_gas_img1 = (data.get("natural_gas_img1") or "").strip()
        remark = (data.get("remark") or "").strip()
        staff_id = (data.get("staff_id") or "").strip()
        name = (data.get("name") or "").strip() or _make_doc_no()

        if not device_id:
            return _err("缺少参数：device_id")
        if not natural_gas_img1:
            return _err("缺少参数：natural_gas_img1")
        if not staff_id:
            return _err("缺少参数：staff_id")
        if data.get("daily_reading") in (None, ""):
            return _err("缺少参数：daily_reading")

        daily_reading = _to_decimal(data.get("daily_reading"), "daily_reading")

        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        device = _get_device(cur, device_id, only_enabled=True)
        if not device:
            return _err("设备不存在或已停用")

        latest = _get_latest_log(cur, device_id)
        # 旧记录暂不绑定设备。第一次通过新接口登记时仅建立基准，
        # 避免把首次用量错误计算成“当前表数 - 0”。
        before_reading_value = Decimal(str(latest["daily_reading"])) if latest else daily_reading
        before_usage_value = (daily_reading - before_reading_value).quantize(
            Decimal("0.00"), rounding=ROUND_HALF_UP
        )
        if before_usage_value < 0:
            return _err("本次示数不能小于该设备的上次示数")

        log_id = _make_id()
        rel_id = _make_id()

        cur.execute(
            """
            INSERT INTO jml_natural_gas_log
            (
                id, name, daily_reading, natural_gas_img1, before_reading,
                before_usage, remark, update_staff_id, created_staff_id, sync_status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, '1')
            """,
            (
                log_id,
                name,
                str(daily_reading),
                natural_gas_img1,
                str(before_reading_value),
                str(before_usage_value),
                remark or None,
                staff_id,
                staff_id,
            ),
        )

        cur.execute(
            """
            INSERT INTO jml_natural_gas_log_rel
            (
                id, log_id, device_id, factory_code, factory_name,
                device_code, device_name, created_staff_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                rel_id,
                log_id,
                device_id,
                device["factory_code"],
                device["factory_name"],
                device["device_code"],
                device["device_name"],
                staff_id,
            ),
        )
        conn.commit()

        return _ok(
            {
                "id": log_id,
                "name": name,
                "device_id": device_id,
                "before_reading": str(before_reading_value),
                "before_usage": str(before_usage_value),
            }
        )
    except ValueError as e:
        if conn:
            conn.rollback()
        return _err(str(e))
    except Exception as e:
        if conn:
            conn.rollback()
        return _err("error", status=500, error=e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@natural_gas_bp.get("/list")
def log_list():
    conn = None
    cur = None
    try:
        factory_code = (request.args.get("factory_code") or "").strip().upper()
        device_id = (request.args.get("device_id") or "").strip()
        keyword = (request.args.get("keyword") or "").strip()
        start_date = (request.args.get("start_date") or "").strip()
        end_date = (request.args.get("end_date") or "").strip()
        created_staff_id = (request.args.get("created_staff_id") or "").strip()
        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("page_size", 20))

        if page <= 0:
            page = 1
        if page_size <= 0:
            page_size = 20

        start_dt, end_dt = _parse_date_range(start_date, end_date)
        offset = (page - 1) * page_size

        where_sql = """
            FROM jml_natural_gas_log l
            INNER JOIN jml_natural_gas_log_rel r ON r.log_id = l.id
            INNER JOIN jml_natural_gas_device d ON d.id = r.device_id
            LEFT JOIN jml_staff cs ON cs.id = l.created_staff_id
            WHERE 1 = 1
        """
        params = []

        if factory_code:
            where_sql += " AND r.factory_code = %s"
            params.append(factory_code)

        if device_id:
            where_sql += " AND d.id = %s"
            params.append(device_id)

        if keyword:
            where_sql += """
                AND (
                    l.name LIKE %s OR
                    d.device_code LIKE %s OR
                    d.device_name LIKE %s OR
                    d.factory_name LIKE %s
                )
            """
            like_value = f"%{keyword}%"
            params.extend([like_value, like_value, like_value, like_value])

        if created_staff_id:
            where_sql += " AND l.created_staff_id = %s"
            params.append(created_staff_id)

        if start_dt:
            where_sql += " AND l.created_time >= %s"
            params.append(start_dt.strftime("%Y-%m-%d %H:%M:%S"))

        if end_dt:
            where_sql += " AND l.created_time < %s"
            params.append(end_dt.strftime("%Y-%m-%d %H:%M:%S"))

        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        cur.execute("SELECT COUNT(1) AS total " + where_sql, params)
        total = cur.fetchone()["total"]

        data_sql = """
            SELECT
                l.id,
                l.name,
                l.daily_reading,
                l.natural_gas_img1,
                l.before_reading,
                l.before_usage,
                l.remark,
                l.created_staff_id,
                cs.name AS created_staff_name,
                l.update_staff_id,
                l.created_time,
                l.update_time,
                d.id AS device_id,
                r.device_code,
                r.device_name,
                r.factory_code,
                r.factory_name
        """ + where_sql + """
            ORDER BY l.created_time DESC, l.id DESC
            LIMIT %s, %s
        """
        page_params = params + [offset, page_size]
        cur.execute(data_sql, page_params)
        rows = cur.fetchall()

        return _ok(
            {
                "list": rows,
                "page": page,
                "page_size": page_size,
                "total": total,
                "last_page": offset + len(rows) >= total,
            }
        )
    except ValueError as e:
        return _err(str(e))
    except Exception as e:
        return _err("error", status=500, error=e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@natural_gas_bp.get("/detail")
def log_detail():
    conn = None
    cur = None
    try:
        log_id = (request.args.get("id") or "").strip()
        if not log_id:
            return _err("缺少参数：id")

        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """
            SELECT
                l.id,
                l.name,
                l.daily_reading,
                l.natural_gas_img1,
                l.before_reading,
                l.before_usage,
                l.remark,
                l.created_staff_id,
                cs.name AS created_staff_name,
                l.update_staff_id,
                l.created_time,
                l.update_time,
                d.id AS device_id,
                r.device_code,
                r.device_name,
                r.factory_code,
                r.factory_name,
                d.is_enable
            FROM jml_natural_gas_log l
            INNER JOIN jml_natural_gas_log_rel r ON r.log_id = l.id
            INNER JOIN jml_natural_gas_device d ON d.id = r.device_id
            LEFT JOIN jml_staff cs ON cs.id = l.created_staff_id
            WHERE l.id = %s
            LIMIT 1
            """,
            (log_id,),
        )
        row = cur.fetchone()
        if not row:
            return _ok(None, "not found")

        return _ok(row)
    except Exception as e:
        return _err("error", status=500, error=e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()
