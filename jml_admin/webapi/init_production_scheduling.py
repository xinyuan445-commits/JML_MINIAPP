"""Explicit, idempotent bootstrap for production calendars and dispatch policies."""
from datetime import date, timedelta
import json
from pathlib import Path


WEEKDAYS = range(1, 8)
SUMMER_INTERVALS = [["08:00", "12:00"], ["13:30", "17:30"]]
WINTER_INTERVALS = [["08:00", "12:00"], ["13:00", "17:00"]]

POLICIES = (
    (
        "due-date",
        "交期优先",
        "逾期和计划完工较早的工单优先。",
        True,
        ("overdue_first", "earliest_due_date", "started_first", "earliest_plan_start", "order_number"),
    ),
)


def initialize(connection):
    cursor = connection.cursor(dictionary=True)
    try:
        schema = Path(__file__).with_name("production_scheduling.sql").read_text(encoding="utf-8")
        schema = "\n".join(line for line in schema.splitlines() if not line.lstrip().startswith("--"))
        for statement in schema.split(";"):
            if statement.strip():
                cursor.execute(statement)

        actor = "生产排程初始化"
        cursor.execute("""
            INSERT IGNORE INTO mo_work_calendar_yx
              (calendar_code,calendar_name,timezone,is_default,is_active,updated_by)
            VALUES ('jml-default','金米龙生产日历','Asia/Shanghai',1,1,%s)
        """, (actor,))
        cursor.execute("SELECT id FROM mo_work_calendar_yx WHERE calendar_code='jml-default'")
        calendar_id = cursor.fetchone()["id"]
        periods = (
            ("夏季作息", "05-01", "09-30", 1, SUMMER_INTERVALS),
            ("冬季作息", "10-01", "04-30", 2, WINTER_INTERVALS),
        )
        for name, start, end, order, intervals in periods:
            cursor.execute("""
                INSERT IGNORE INTO mo_work_calendar_period_yx
                  (calendar_id,period_name,start_month_day,end_month_day,sort_order)
                VALUES (%s,%s,%s,%s,%s)
            """, (calendar_id, name, start, end, order))
            cursor.execute("""
                SELECT id FROM mo_work_calendar_period_yx
                WHERE calendar_id=%s AND period_name=%s
            """, (calendar_id, name))
            period_id = cursor.fetchone()["id"]
            for weekday in WEEKDAYS:
                day_intervals = intervals if weekday <= 5 else []
                cursor.execute("""
                    INSERT IGNORE INTO mo_work_calendar_week_yx
                      (period_id,weekday,intervals_json) VALUES (%s,%s,%s)
                """, (period_id, weekday, json.dumps(day_intervals, ensure_ascii=False)))

        for code, name, description, is_default, rules in POLICIES:
            cursor.execute("""
                INSERT IGNORE INTO mo_schedule_policy_yx
                  (policy_code,policy_name,description,is_default,is_active,updated_by)
                VALUES (%s,%s,%s,%s,1,%s)
            """, (code, name, description, int(is_default), actor))
            cursor.execute("SELECT id FROM mo_schedule_policy_yx WHERE policy_code=%s", (code,))
            policy_id = cursor.fetchone()["id"]
            for priority, rule_code in enumerate(rules, 1):
                cursor.execute("""
                    INSERT IGNORE INTO mo_schedule_policy_rule_yx
                      (policy_id,priority,rule_code,is_enabled)
                    VALUES (%s,%s,%s,1)
                """, (policy_id, priority, rule_code))
        upgrade_strategies(connection)
        connection.commit()
        return calendar_id
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()


def import_china_holidays(connection, calendar_id, year, actor="生产排程初始化", commit=True):
    try:
        from chinese_calendar import get_holiday_detail, is_workday
    except ImportError as exc:
        raise RuntimeError("未安装 chinesecalendar，请先安装 webapi requirements") from exc
    cursor = connection.cursor(dictionary=True)
    imported = 0
    skipped = 0
    current = date(year, 1, 1)
    end = date(year, 12, 31)
    try:
        while current <= end:
            try:
                working = bool(is_workday(current))
            except NotImplementedError as exc:
                raise ValueError(f"chinesecalendar尚未提供{year}年法定节假日") from exc
            differs = working != (current.isoweekday() <= 5)
            if differs:
                cursor.execute("""
                    SELECT source FROM mo_work_calendar_exception_yx
                    WHERE calendar_id=%s AND work_date=%s
                """, (calendar_id, current))
                existing = cursor.fetchone()
                if existing and existing["source"] == "manual":
                    skipped += 1
                    current += timedelta(days=1)
                    continue
                holiday, name = get_holiday_detail(current)
                intervals = SUMMER_INTERVALS if (5, 1) <= (current.month, current.day) <= (9, 30) else WINTER_INTERVALS
                cursor.execute("""
                    INSERT INTO mo_work_calendar_exception_yx
                      (calendar_id,work_date,exception_type,intervals_json,reason,source,updated_by)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                    ON DUPLICATE KEY UPDATE
                      exception_type=VALUES(exception_type),intervals_json=VALUES(intervals_json),
                      reason=VALUES(reason),source=VALUES(source),revision=revision+1,
                      updated_by=VALUES(updated_by)
                """, (
                    calendar_id,
                    current,
                    "work" if working else "rest",
                    json.dumps(intervals if working else [], ensure_ascii=False),
                    str(getattr(name, "value", name) if holiday and name else ("调休工作日" if working else "法定休息日")),
                    f"chinesecalendar:{year}",
                    actor,
                ))
                imported += 1
            current += timedelta(days=1)
        if commit:
            connection.commit()
        return imported, skipped
    except Exception:
        if commit:
            connection.rollback()
        raise
    finally:
        cursor.close()


def upgrade_strategies(connection):
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(Path(__file__).with_name("production_schedule_handover.sql").read_text(encoding="utf-8"))
        cursor.execute("""
            INSERT IGNORE INTO mo_schedule_policy_yx
                (policy_code,policy_name,description,is_default,is_active,updated_by)
            VALUES ('efficiency','效率优先','优先填设备空档，保护临期工单。',0,1,'生产排程初始化')
        """)
        cursor.execute("""
            INSERT IGNORE INTO mo_schedule_policy_rule_yx (policy_id,priority,rule_code,is_enabled)
            SELECT id,1,'order_number',1 FROM mo_schedule_policy_yx WHERE policy_code='efficiency'
        """)
    finally:
        cursor.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--holiday-year", type=int, default=date.today().year)
    parser.add_argument("--skip-holidays", action="store_true")
    parser.add_argument("--upgrade-strategies", action="store_true")
    args = parser.parse_args()
    from app import db
    connection = db()
    try:
        if args.upgrade_strategies:
            upgrade_strategies(connection)
            connection.commit()
            print("排程策略和工序交割配置升级完成。")
            raise SystemExit(0)
        calendar_id = initialize(connection)
        if not args.skip_holidays:
            imported, skipped = import_china_holidays(connection, calendar_id, args.holiday_year)
            print(f"导入 {args.holiday_year} 年节假日例外 {imported} 条，保留人工配置 {skipped} 条。")
        print("生产日历、排程策略和工序交割配置初始化完成。")
    finally:
        connection.close()
