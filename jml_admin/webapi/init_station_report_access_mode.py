"""Explicit migration for the mini-program report access selector."""
import json


def initialize(conn):
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""SELECT COUNT(*) AS total FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mo_station_access_setting_yx'
              AND COLUMN_NAME='report_access_mode'""")
        created = int(cur.fetchone()["total"]) == 0
        if created:
            cur.execute("""ALTER TABLE mo_station_access_setting_yx
                ADD COLUMN report_access_mode ENUM('exempt','station','all')
                NOT NULL DEFAULT 'exempt' AFTER enabled""")
        cur.execute("SELECT report_access_mode FROM mo_station_access_setting_yx WHERE id=1")
        row = cur.fetchone()
        if not row:
            raise ValueError("请先初始化工站权限设置")
        conn.commit()
        return {"created": created, "report_access_mode": row["report_access_mode"]}
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


if __name__ == "__main__":
    from app import db
    connection = db()
    try:
        print(json.dumps(initialize(connection), ensure_ascii=False))
    finally:
        connection.close()
