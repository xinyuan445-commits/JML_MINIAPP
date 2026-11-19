"""Explicit equipment migration. Never imported by application startup."""
from pathlib import Path
import json
from uuid import NAMESPACE_URL, uuid5

from equipment import snapshot


def initialize_from_stations(connection):
    """Explicit, idempotent bootstrap requested by the user; no legacy device import."""
    cur = connection.cursor(dictionary=True)
    created = 0
    try:
        cur.execute("SELECT id,station_code,station_name,is_active FROM mo_workstation_yx ORDER BY id FOR UPDATE")
        for station in cur.fetchall():
            cur.execute("SELECT id FROM mo_equipment_yx WHERE station_id=%s", (station["id"],))
            if cur.fetchone():
                continue
            device_id = str(uuid5(NAMESPACE_URL, f"jml-production-equipment:station:{station['id']}"))
            code = f"EQ-{station['station_code']}"
            if len(code) > 64 or len(station["station_name"]) > 100:
                raise ValueError("工站编码或名称过长，请先核对")
            actor = "工站设备初始化"
            cur.execute("""INSERT INTO mo_equipment_device_yx
                (device_id,device_code,device_name,device_enabled,device_type,updated_by)
                VALUES (%s,%s,%s,%s,%s,%s)""",
                        (device_id, code, station["station_name"], int(bool(station["is_active"])), "未分类", actor))
            cur.execute("INSERT INTO mo_equipment_yx (station_id,device_id) VALUES (%s,%s)", (station["id"], device_id))
            target_id = cur.lastrowid
            after = snapshot(cur, "equipment", {"id": target_id})
            after.update(station_code=station["station_code"], station_name=station["station_name"])
            cur.execute("""INSERT INTO mo_equipment_history_yx
                (module_type,target_id,device_id,before_data,after_data,approved_by) VALUES (%s,%s,%s,%s,%s,%s)""",
                        ("equipment", target_id, device_id, None, json.dumps(after, ensure_ascii=False), actor))
            created += 1
        connection.commit()
        return created
    except Exception:
        connection.rollback()
        raise
    finally:
        cur.close()


def initialize(connection):
    cur = connection.cursor(dictionary=True)
    try:
        cur.execute("""SELECT TABLE_NAME AS name FROM information_schema.TABLES
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('mo_equipment_profile_yx','mo_equipment_device_yx')""")
        existing = {row["name"] for row in cur.fetchall()}
        if "mo_equipment_profile_yx" in existing:
            if "mo_equipment_device_yx" in existing:
                raise RuntimeError("新旧设备结构同时存在，请核对后再迁移")
            # The previous local version was initialized but had no archives or standards.
            # Never infer a migration from legacy business devices when data already exists.
            for table in ("mo_equipment_profile_yx", "mo_equipment_yx", "mo_equipment_capacity_yx", "mo_equipment_history_yx"):
                cur.execute(f"SELECT COUNT(*) AS total FROM {table}")
                if cur.fetchone()["total"]:
                    raise RuntimeError("旧设备扩展已有数据，请先明确独立设备迁移映射")
            cur.execute("RENAME TABLE mo_equipment_profile_yx TO mo_equipment_device_yx")
        if existing:
            cur.execute("SHOW COLUMNS FROM mo_equipment_device_yx")
            columns = {row["Field"] for row in cur.fetchall()}
            if "device_code" not in columns:
                cur.execute("""ALTER TABLE mo_equipment_device_yx
                    ADD device_code VARCHAR(64) NOT NULL UNIQUE,
                    ADD device_name VARCHAR(100) NOT NULL,
                    ADD device_enabled TINYINT NOT NULL DEFAULT 1""")
        sql = Path(__file__).with_name("equipment.sql").read_text(encoding="utf-8")
        sql = "\n".join(line for line in sql.splitlines() if not line.lstrip().startswith("--"))
        for statement in sql.split(";"):
            if statement.strip():
                cur.execute(statement)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cur.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-stations", action="store_true", help="按工站建立同名独立设备，已有绑定跳过")
    args = parser.parse_args()
    from app import db
    connection = db()
    try:
        initialize(connection)
        if args.from_stations:
            print(f"按工站建立独立设备 {initialize_from_stations(connection)} 台。")
        print("设备管理结构完成。未改原设备、工站、维修和报工数据。请另行核对后台权限初始化。")
    finally:
        connection.close()
