"""Explicit, idempotent initialization for report email settings."""
import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR / ".env.admin", override=True)
load_dotenv(BASE_DIR / ".env.smtp", override=True)

from app import app, db  # noqa: E402
from report_email_settings import REPORT_CATALOG, encrypt_smtp_password  # noqa: E402


def initialize(conn):
    cur = conn.cursor()
    try:
        schema = (BASE_DIR / "report_email_settings.sql").read_text(encoding="utf-8")
        for statement in schema.split(";"):
            if statement.strip():
                cur.execute(statement)

        server = (os.getenv("SMTP_SERVER") or "").strip()
        user = (os.getenv("SMTP_USER") or "").strip()
        password = os.getenv("SMTP_PASSWORD") or ""
        if server and user and password:
            port = int(os.getenv("SMTP_PORT", "465"))
            use_ssl = (os.getenv("SMTP_USE_SSL", "true").strip().lower() in {
                "1", "true", "yes", "on",
            })
            cur.execute("""
                INSERT IGNORE INTO mo_report_email_setting_yx
                    (id,smtp_server,smtp_port,smtp_user,smtp_password_ciphertext,
                     smtp_use_ssl,revision,updated_by)
                VALUES (1,%s,%s,%s,%s,%s,1,'初始化')
            """, (
                server,
                port,
                user,
                encrypt_smtp_password(password, app.secret_key),
                int(use_ssl),
            ))
        for report_key, report_name in REPORT_CATALOG:
            cur.execute("""
                INSERT IGNORE INTO mo_report_delivery_setting_yx
                    (report_key,is_enabled,send_mode,schedule_frequency,send_time,
                     week_day,month_day,to_recipients,cc_recipients,bcc_recipients,
                     email_subject,email_body,revision,updated_by)
                VALUES (%s,0,'manual','daily','08:00:00',1,1,'','','',%s,'',1,'初始化')
            """, (report_key, report_name))
        cur.execute("""
            INSERT IGNORE INTO mo_approval_email_setting_yx
                (id,instant_enabled,weekly_enabled,weekly_day,weekly_time,
                 to_recipients,cc_recipients,bcc_recipients,revision,updated_by)
            VALUES (1,0,0,1,'08:10:00',%s,'','',1,'初始化')
        """, ("yuanxin@goldenchameleon.cn",))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


if __name__ == "__main__":
    connection = db()
    try:
        initialize(connection)
        print("邮件配置表初始化完成；已有配置不会被覆盖。")
    finally:
        connection.close()
