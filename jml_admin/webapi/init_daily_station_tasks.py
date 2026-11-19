"""Explicit additive migration. Does not create example production tasks."""
import json
from pathlib import Path


def initialize(connection):
    cursor = connection.cursor(dictionary=True)
    try:
        for statement in Path(__file__).with_name('daily_station_tasks.sql').read_text(encoding='utf-8').split(';'):
            if statement.strip():
                cursor.execute(statement)
        cursor.execute("SELECT id,permissions FROM mo_admin_role_yx WHERE code='system-admin' FOR UPDATE")
        for role in cursor.fetchall():
            permissions = role['permissions']
            if isinstance(permissions, str):
                permissions = json.loads(permissions)
            permissions = set(permissions or []) | {'daily-tasks.view', 'daily-tasks.manage'}
            cursor.execute('UPDATE mo_admin_role_yx SET permissions=%s WHERE id=%s',
                           (json.dumps(sorted(permissions)), role['id']))
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()


if __name__ == '__main__':
    from app import db
    connection = db()
    try:
        initialize(connection)
        from init_daily_task_snapshots import initialize as initialize_snapshots
        initialize_snapshots(connection)
        print('工站每日任务及快照表已初始化；仅为系统管理员增加本模块权限，未生成任务或修改报工。')
    finally:
        connection.close()
