"""Explicit draft-only setup. Never called by app startup or reporting APIs."""
import argparse
import json
from pathlib import Path


def initialize(conn, seed_reference=False):
    cur = conn.cursor(dictionary=True)
    result = {"created": [], "skipped_existing": [], "unmatched_staff": [], "unmatched_stations": [], "enforcement_enabled": False}
    try:
        # Check the existing RBAC installation before running DDL (MySQL auto-commits DDL).
        cur.execute("SELECT id FROM mo_admin_role_yx WHERE code='system-admin' AND is_system=1")
        if not cur.fetchone():
            raise ValueError("请先执行 init_admin_permissions.py 初始化后台权限")
        cur.execute(Path(__file__).with_name("station_permissions.sql").read_text(encoding="utf-8"))
        cur.execute(Path(__file__).with_name("station_staff_exemptions.sql").read_text(encoding="utf-8"))
        cur.execute(Path(__file__).with_name("station_staff_proxies.sql").read_text(encoding="utf-8"))
        cur.execute("SELECT id,permissions FROM mo_admin_role_yx WHERE code='system-admin' AND is_system=1 FOR UPDATE")
        role = cur.fetchone()
        permissions = role["permissions"]
        permissions = json.loads(permissions) if isinstance(permissions, str) else permissions
        upgraded = sorted(set(permissions) | {"station-permissions.view", "station-permissions.manage"})
        if upgraded != sorted(permissions):
            cur.execute("UPDATE mo_admin_role_yx SET permissions=%s WHERE id=%s", (json.dumps(upgraded), role["id"]))
        if seed_reference:
            reference = json.loads(Path(__file__).with_name("station_permission_reference.json").read_text(encoding="utf-8"))
            cur.execute("SELECT id,station_name FROM mo_workstation_yx ORDER BY id FOR UPDATE")
            stations = {}
            for station in cur.fetchall():
                stations.setdefault(station["station_name"].strip(), []).append(station["id"])
            cur.execute("SELECT id,name FROM jml_staff WHERE status='1'")
            people = {}
            for person in cur.fetchall():
                people.setdefault((person["name"] or "").strip(), []).append(person["id"])
            cur.execute("SELECT station_id FROM mo_station_staff_config_yx")
            existing = {row["station_id"] for row in cur.fetchall()}

            def resolve(name):
                if not name:
                    return None
                matches = people.get(name, [])
                if len(matches) == 1:
                    return matches[0]
                result["unmatched_staff"].append(name)
                return None

            for row in reference:
                matches = stations.get(row["station"], [])
                if len(matches) != 1:
                    result["unmatched_stations"].append(row["station"])
                    continue
                station = matches[0]
                if station in existing:
                    result["skipped_existing"].append(row["station"])
                    continue
                leader = resolve(row["leader"])
                scanners = sorted({identifier for name in row["scanners"] if (identifier := resolve(name))})
                if not leader and not scanners:
                    continue
                cur.execute("""INSERT INTO mo_station_staff_config_yx
                    (station_id,leader_staff_id,scanner_staff_ids,updated_by) VALUES (%s,%s,%s,%s)""",
                    (station, leader, json.dumps(scanners), "system:init-station-permissions"))
                cur.execute("""INSERT INTO mo_admin_audit_log_yx
                    (username,action_name,request_method,request_path,target_id,request_data,result_code,result_message,ip_address)
                    VALUES (%s,%s,'SCRIPT','init_station_permissions.py',%s,%s,0,'','')""",
                    ("system:init-station-permissions", "初始化工站人员配置（未启用）", str(station),
                    json.dumps({"station_name": row["station"], "leader_staff_id": leader,
                        "scanner_staff_ids": scanners, "enforcement_enabled": False}, ensure_ascii=False)))
                result["created"].append(row["station"])
        conn.commit()
        result["unmatched_staff"] = sorted(set(result["unmatched_staff"]))
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="创建后台工站人员配置，不启用小程序限制")
    parser.add_argument("--seed-reference", action="store_true", help="按已确认名单首次填入，只精确匹配在用员工，不覆盖已有配置")
    args = parser.parse_args()
    from app import db
    connection = db()
    try:
        print(json.dumps(initialize(connection, args.seed_reference), ensure_ascii=False))
    finally:
        connection.close()
