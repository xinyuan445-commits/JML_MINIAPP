"""Explicit, idempotent admin RBAC initialization; never runs on app import."""
import json
from pathlib import Path

from admin_permissions import ALL_PERMISSIONS, ROLE_TEMPLATES, load_account


def initialize(conn):
    cur = conn.cursor(dictionary=True)
    try:
        schema = Path(__file__).with_name("admin_permissions.sql").read_text(encoding="utf-8")
        schema = "\n".join(line for line in schema.splitlines() if not line.lstrip().startswith("--"))
        for statement in schema.split(";"):
            if statement.strip():
                cur.execute(statement)
        for column, definition in (
            ("revision", "INT NOT NULL DEFAULT 1"),
            ("applicant_seen", "TINYINT NOT NULL DEFAULT 0"),
        ):
            cur.execute(f"SHOW COLUMNS FROM mo_config_approval_yx LIKE '{column}'")
            if not cur.fetchone():
                cur.execute(f"ALTER TABLE mo_config_approval_yx ADD COLUMN {column} {definition}")
        for code, name, permissions in ROLE_TEMPLATES:
            cur.execute("""INSERT IGNORE INTO mo_admin_role_yx (code,name,permissions,is_system)
                VALUES (%s,%s,%s,%s)""", (code, name, json.dumps(sorted(permissions)), int(code == "system-admin")))
        cur.execute("SELECT id,code,permissions FROM mo_admin_role_yx")
        request_permissions = {
            "equipment.add", "equipment.edit", "equipment-capacity.edit",
            "process.add", "process.edit", "process.toggle",
            "workstation.add", "workstation.edit", "workstation.toggle",
            "category.add", "category.edit", "category.toggle",
            "route.add", "route.edit", "route.toggle", "route.restore",
        }
        for role in cur.fetchall():
            current = json.loads(role["permissions"]) if isinstance(role["permissions"], str) else list(role["permissions"])
            migrated = set(current) & ALL_PERMISSIONS
            if role["code"] == "system-admin":
                migrated = set(ALL_PERMISSIONS)
            else:
                if "completed.view" in migrated:
                    migrated.add("route-trace.view")
                if "reports.view" in migrated:
                    migrated.add("reports2.view")
                    migrated.add("receipt-comparison.view")
                    migrated.add("workorder-process-report.view")
                if "production-label.view" in migrated:
                    migrated.add("completion-flow-report.view")
                if "production-label.print" in migrated:
                    migrated.add("completion-flow-report.print")
                if migrated & request_permissions:
                    migrated.add("approval.mine")
            cur.execute("UPDATE mo_admin_role_yx SET permissions=%s WHERE id=%s",
                (json.dumps(sorted(migrated)), role["id"]))
        cur.execute("SELECT id,username,display_name,role,is_active FROM mo_admin_user_yx")
        for user in cur.fetchall():
            account = load_account(cur, "session", user["id"], username=user["username"],
                display_name=user["display_name"] or user["username"],
                default_role="system-admin" if user["role"] == "admin" else "viewer")
            if not user["is_active"]:
                cur.execute("UPDATE mo_admin_account_yx SET is_active=0 WHERE id=%s", (account["id"],))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


if __name__ == "__main__":
    from app import db
    connection = db()
    try:
        initialize(connection)
        print("后台权限表、默认角色与原账号迁移完成。未修改小程序、ERP 或工站绑定。")
    finally:
        connection.close()
