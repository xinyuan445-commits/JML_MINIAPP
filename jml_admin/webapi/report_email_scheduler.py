"""Single-process scheduler for enabled report email deliveries."""
import argparse
import time
from datetime import datetime

from approval_email import run_due_approval_emails
from app import app, build_report_attachment, db
from report_email_sender import send_configured_report
from report_email_settings import send_time_text


def due_slot(row, now):
    if not row.get("is_enabled") or row.get("send_mode") != "scheduled":
        return None
    if send_time_text(row.get("send_time")) != now.strftime("%H:%M"):
        return None
    frequency = row.get("schedule_frequency")
    if frequency == "daily":
        return now.strftime("daily:%Y-%m-%d")
    if frequency == "weekly" and int(row.get("week_day") or 0) == now.isoweekday():
        return now.strftime("weekly:%G-%V")
    if frequency == "monthly" and int(row.get("month_day") or 0) == now.day:
        return now.strftime("monthly:%Y-%m")
    return None


def run_due_reports(now=None):
    current = now or datetime.now()
    conn = db()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT * FROM mo_report_delivery_setting_yx
            WHERE is_enabled=1 AND send_mode='scheduled'
        """)
        rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    for row in rows:
        slot = due_slot(row, current)
        if not slot or row.get("last_sent_slot") == slot:
            continue
        claim = db()
        claim_cur = claim.cursor()
        try:
            claim_cur.execute("""
                UPDATE mo_report_delivery_setting_yx
                SET last_sent_slot=%s,last_send_status='sending',last_error=''
                WHERE report_key=%s
                  AND (last_sent_slot IS NULL OR last_sent_slot<>%s)
            """, (slot, row["report_key"], slot))
            claimed = claim_cur.rowcount == 1
            claim.commit()
        finally:
            claim_cur.close()
            claim.close()
        if not claimed:
            continue
        try:
            with app.test_request_context("/"):
                send_configured_report(
                    db,
                    app.secret_key,
                    build_report_attachment,
                    row["report_key"],
                )
        except Exception as error:
            app.logger.error("scheduled report email failed: %s", error)

    with app.test_request_context("/"):
        run_due_approval_emails(db, app.secret_key, current)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--loop", action="store_true")
    args = parser.parse_args()
    if not args.loop:
        run_due_reports()
        return
    while True:
        try:
            run_due_reports()
        except Exception as error:
            app.logger.error("report email scheduler check failed: %s", error)
        time.sleep(30)


if __name__ == "__main__":
    main()
