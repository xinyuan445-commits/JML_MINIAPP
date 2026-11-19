"""Run with npm start or independently; snapshot writes only, no reporting/ERP writes."""
import logging
import time
from daily_task_snapshots import beijing_now, capture_due


def run_once(database):
    import nonorder_daily as nonorder

    connection = database()
    cursor = connection.cursor(dictionary=True)
    locked = nonorder_locked = False
    try:
        cursor.execute("SELECT GET_LOCK('jml_pmc_daily_tasks',1) locked")
        locked = cursor.fetchone()['locked'] == 1
        if not locked:
            return
        capture_due(cursor, beijing_now())
        connection.commit()
        cursor.execute("SELECT RELEASE_LOCK('jml_pmc_daily_tasks')")
        cursor.fetchone()
        locked = False
        nonorder_locked = nonorder.acquire(cursor)
        if nonorder_locked:
            nonorder.capture_due(cursor, beijing_now())
            connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        if nonorder_locked:
            nonorder.release(cursor)
        if locked:
            cursor.execute("SELECT RELEASE_LOCK('jml_pmc_daily_tasks')")
            cursor.fetchone()
        cursor.close()
        connection.close()


if __name__ == '__main__':
    import sys
    from app import db
    while True:
        try:
            run_once(db)
        except Exception:
            logging.exception('任务安排快照生成失败，下次自动重试')
        if '--loop' not in sys.argv:
            break
        from datetime import datetime, time as daytime, timedelta
        now = beijing_now()
        midnight = datetime.combine(now.date() + timedelta(days=1), daytime.min)
        time.sleep(max(0.1, min(30, (midnight-now).total_seconds())))
