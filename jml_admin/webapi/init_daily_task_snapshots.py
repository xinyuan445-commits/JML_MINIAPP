"""Explicit migration; preserves existing task rows and creates no example arrangements."""
from datetime import datetime, time, timedelta
from daily_task_snapshots import beijing_now


def initialize(connection):
    cur = connection.cursor(dictionary=True)
    try:
        cur.execute('''CREATE TABLE IF NOT EXISTS mo_daily_task_sheet_yx (
          id BIGINT PRIMARY KEY AUTO_INCREMENT, work_date DATE NOT NULL,
          sheet_kind VARCHAR(20) NOT NULL, parent_id BIGINT NULL,
          main_date DATE GENERATED ALWAYS AS (CASE WHEN sheet_kind='main' THEN work_date ELSE NULL END) STORED,
          created_by VARCHAR(100) NOT NULL, created_at DATETIME NOT NULL,
          plan_cutoff DATETIME NOT NULL,result_cutoff DATETIME NOT NULL,
          plan_data JSON NULL,result_data JSON NULL,
          plan_frozen_at DATETIME NULL,result_frozen_at DATETIME NULL,
          legacy_import TINYINT NOT NULL DEFAULT 0,
          UNIQUE KEY uk_daily_main(main_date),KEY idx_daily_sheet_date(work_date,id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')
        cur.execute("SHOW COLUMNS FROM mo_daily_task_yx LIKE 'sheet_id'")
        if not cur.fetchone():
            cur.execute('ALTER TABLE mo_daily_task_yx ADD COLUMN sheet_id BIGINT NULL')
        cur.execute('''SELECT h.work_date,h.created_at,h.created_by FROM mo_daily_task_yx h
            JOIN (SELECT MIN(id) id FROM mo_daily_task_yx WHERE sheet_id IS NULL GROUP BY work_date) first_header
            ON h.id=first_header.id''')
        now = beijing_now()
        for row in cur.fetchall():
            created = row['created_at'] or beijing_now()
            plan_cutoff = datetime.combine(created.date()+timedelta(days=1),time.min)
            cur.execute('''INSERT IGNORE INTO mo_daily_task_sheet_yx
                (work_date,sheet_kind,created_by,created_at,plan_cutoff,result_cutoff,legacy_import)
                VALUES (%s,'main',%s,%s,%s,%s,%s)''',
                (row['work_date'], row['created_by'], created,
                 plan_cutoff, datetime.combine(row['work_date']+timedelta(days=1),time.min), int(plan_cutoff <= now)))
        cur.execute('''UPDATE mo_daily_task_yx h JOIN mo_daily_task_sheet_yx s
          ON s.work_date=h.work_date AND s.sheet_kind='main' SET h.sheet_id=s.id WHERE h.sheet_id IS NULL''')
        connection.commit()
        cur.execute("SHOW INDEX FROM mo_daily_task_yx WHERE Key_name='uk_daily_department'")
        if cur.fetchall():
            cur.execute('ALTER TABLE mo_daily_task_yx DROP INDEX uk_daily_department')
        cur.execute("SHOW INDEX FROM mo_daily_task_yx WHERE Key_name='uk_daily_sheet_department'")
        if not cur.fetchall():
            cur.execute('ALTER TABLE mo_daily_task_yx ADD UNIQUE KEY uk_daily_sheet_department(sheet_id,dept_name)')
        cur.execute('ALTER TABLE mo_daily_task_yx MODIFY COLUMN sheet_id BIGINT NOT NULL')
        connection.commit()
    finally:
        cur.close()


if __name__ == '__main__':
    from app import db
    connection = db()
    try:
        initialize(connection)
        print('安排单及快照表已初始化；原安排、报工数据保留。历史记录标记为补存。')
    finally:
        connection.close()
