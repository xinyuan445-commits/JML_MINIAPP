"""Time-limited station grants, independent of permanent station staffing."""
import hashlib
import json
from datetime import datetime, timezone

from flask import g, request
from station_permissions import staff_id


def utc_text(value):
    return value.replace(tzinfo=timezone.utc).isoformat(timespec="seconds")


def grant_data(row):
    return {"id": row["id"], "staff_id": row["staff_id"],
        "starts_at": utc_text(row["starts_at"]), "ends_at": utc_text(row["ends_at"])}


def grant_version(rows):
    if not rows:
        return ""
    payload = [grant_data(row) for row in sorted(rows, key=lambda row: row["staff_id"])]
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def parse_time(value):
    if not isinstance(value, str) or len(value) > 40:
        raise ValueError("请填写有效的代理时间")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if result.tzinfo is None:
            raise ValueError()
        return result.astimezone(timezone.utc).replace(tzinfo=None, microsecond=0)
    except (ValueError, OverflowError):
        raise ValueError("请填写有效的代理时间（含时区）") from None


def register_station_proxies(bp, transaction, audit):
    @bp.get("/api/admin/station-permissions/proxies")
    def station_proxies_list():
        def work(cur):
            cur.execute("""SELECT id,station_id,staff_id,starts_at,ends_at
                FROM mo_station_staff_proxy_yx WHERE ends_at>UTC_TIMESTAMP()
                ORDER BY station_id,staff_id""")
            rows = cur.fetchall()
            identifiers = sorted({row["staff_id"] for row in rows})
            people = {}
            if identifiers:
                cur.execute("SELECT id,name,position,status FROM jml_staff WHERE id IN ("
                    + ",".join(["%s"] * len(identifiers)) + ")", tuple(identifiers))
                people = {person["id"]: person for person in cur.fetchall()}
            groups = {}
            for row in rows:
                groups.setdefault(row["station_id"], []).append(row)
            return [{"station_id": station, "version": grant_version(grants),
                "proxies": [{**grant_data(row), "person": people.get(row["staff_id"],
                    {"id": row["staff_id"], "name": "人员已不存在", "status": "missing"})}
                    for row in grants]} for station, grants in groups.items()]
        return transaction(work)

    @bp.post("/api/admin/station-permissions/proxies/save")
    def station_proxies_save():
        def work(cur):
            body = request.get_json()
            if set(body) != {"station_id", "proxies", "version"}:
                raise ValueError("代理配置参数无效")
            station = body["station_id"]
            if type(station) is not int or station <= 0:
                raise ValueError("请选择有效的工站")
            if not isinstance(body["version"], str) or len(body["version"]) > 64:
                raise ValueError("代理配置版本无效，请刷新后重试")
            proxies = body["proxies"]
            if not isinstance(proxies, list) or len(proxies) > 100:
                raise ValueError("代理人必须为人员列表，最多 100 人")
            cur.execute("SELECT id FROM mo_workstation_yx WHERE id=%s FOR UPDATE", (station,))
            if not cur.fetchone():
                raise ValueError("工站不存在，请刷新后重试")
            cur.execute("SELECT UTC_TIMESTAMP() AS now_utc")
            now = cur.fetchone()["now_utc"]
            cur.execute("""SELECT id,station_id,staff_id,starts_at,ends_at
                FROM mo_station_staff_proxy_yx WHERE station_id=%s ORDER BY staff_id FOR UPDATE""", (station,))
            before = cur.fetchall()
            if grant_version([row for row in before if row["ends_at"] > now]) != body["version"]:
                raise ValueError("代理配置已变化或到期，请刷新后重新编辑")
            grants = []
            identifiers = set()
            for item in proxies:
                if not isinstance(item, dict) or set(item) != {"staff_id", "starts_at", "ends_at"}:
                    raise ValueError("代理配置参数无效")
                identifier = staff_id(item["staff_id"])
                if identifier in identifiers:
                    raise ValueError("同一工站不能重复配置代理人")
                identifiers.add(identifier)
                start, end = parse_time(item["starts_at"]), parse_time(item["ends_at"])
                if start >= end:
                    raise ValueError("到期时间必须晚于生效时间")
                if end <= now:
                    raise ValueError("到期时间必须晚于当前时间")
                grants.append((identifier, start, end))
            if identifiers:
                cur.execute("SELECT id FROM jml_staff WHERE status='1' AND id IN ("
                    + ",".join(["%s"] * len(identifiers)) + ") FOR SHARE", tuple(sorted(identifiers)))
                if {row["id"] for row in cur.fetchall()} != identifiers:
                    raise ValueError("选择的员工已停用或不存在，请刷新后重新选择")
            cur.execute("DELETE FROM mo_station_staff_proxy_yx WHERE station_id=%s", (station,))
            for identifier, start, end in grants:
                cur.execute("""INSERT INTO mo_station_staff_proxy_yx
                    (station_id,staff_id,starts_at,ends_at,updated_by) VALUES (%s,%s,%s,%s,%s)""",
                    (station, identifier, start, end, g.audit_username))
            audit(cur, "保存工站代理配置", station, {
                "before": [grant_data(row) for row in before],
                "after": [{"staff_id": identifier, "starts_at": utc_text(start), "ends_at": utc_text(end)}
                    for identifier, start, end in grants],
            })
            return {"id": station}
        return transaction(work)


def cleanup_expired(conn):
    """Delete and audit in one transaction; multiple workers cannot remove twice."""
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""SELECT id,station_id,staff_id,starts_at,ends_at
            FROM mo_station_staff_proxy_yx WHERE ends_at<=UTC_TIMESTAMP()
            ORDER BY id LIMIT 500 FOR UPDATE""")
        rows = cur.fetchall()
        for row in rows:
            cur.execute("""INSERT INTO mo_admin_audit_log_yx
                (username,action_name,request_method,request_path,target_id,request_data,
                 result_code,result_message,ip_address)
                VALUES (%s,%s,'SYSTEM','station-proxy-expiry',%s,%s,0,'','')""",
                ("system:station-proxy-expiry", "工站代理到期自动移除", str(row["station_id"]),
                    json.dumps({"before": grant_data(row), "after": None}, ensure_ascii=False)))
            cur.execute("DELETE FROM mo_station_staff_proxy_yx WHERE id=%s", (row["id"],))
        conn.commit()
        return len(rows)
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
