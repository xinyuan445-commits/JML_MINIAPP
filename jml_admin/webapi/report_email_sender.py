"""Generate and send configured report emails."""
import smtplib
from datetime import datetime
from email.message import EmailMessage

from report_email_settings import REPORT_CATALOG, decrypt_smtp_password


def _addresses(value):
    return [item.strip() for item in str(value or "").split(";") if item.strip()]


def _render(value, report_name, now):
    return str(value or "").replace("{report_name}", report_name).replace(
        "{date}", now.strftime("%Y-%m-%d")
    ).replace("{datetime}", now.strftime("%Y-%m-%d %H:%M"))


def check_smtp_connection(database, secret_key):
    conn = database()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT * FROM mo_report_email_setting_yx WHERE id=1")
        smtp = cur.fetchone()
    finally:
        cur.close()
        conn.close()
    if not smtp or not smtp.get("smtp_password_ciphertext"):
        raise ValueError("请先完成SMTP配置")
    password = decrypt_smtp_password(smtp["smtp_password_ciphertext"], secret_key)
    client_type = smtplib.SMTP_SSL if smtp.get("smtp_use_ssl") else smtplib.SMTP
    with client_type(smtp["smtp_server"], int(smtp["smtp_port"]), timeout=30) as client:
        client.login(smtp["smtp_user"], password)
    return True


def send_configured_report(database, secret_key, attachment_builder, report_key, *,
                           catalog=REPORT_CATALOG, expected_revision=None, now=None):
    report_names = dict(catalog)
    if report_key not in report_names:
        raise ValueError("报表不存在")
    conn = database()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT * FROM mo_report_email_setting_yx WHERE id=1")
        smtp = cur.fetchone()
        cur.execute(
            "SELECT * FROM mo_report_delivery_setting_yx WHERE report_key=%s",
            (report_key,),
        )
        report = cur.fetchone()
    finally:
        cur.close()
        conn.close()
    if not smtp or not smtp.get("smtp_password_ciphertext"):
        raise ValueError("请先完成SMTP配置")
    if not report:
        raise ValueError("请先保存该报表的发送配置")
    if expected_revision is not None and report.get("revision") != expected_revision:
        raise ValueError("收件人已变更，请重新打开邮件发送确认")
    if not report.get("is_enabled"):
        raise ValueError("该报表的发送开关未启用")
    to = _addresses(report.get("to_recipients"))
    cc = _addresses(report.get("cc_recipients"))
    bcc = _addresses(report.get("bcc_recipients"))
    if not to:
        raise ValueError("请先配置收件人")

    now = now or datetime.now()
    report_name = report_names[report_key]
    filename, content = attachment_builder(report_key)
    message = EmailMessage()
    message["From"] = smtp["smtp_user"]
    message["To"] = ", ".join(to)
    if cc:
        message["Cc"] = ", ".join(cc)
    message["Subject"] = _render(report.get("email_subject"), report_name, now)
    message.set_content(_render(report.get("email_body"), report_name, now))
    message.add_attachment(
        content,
        maintype="application",
        subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )

    password = decrypt_smtp_password(smtp["smtp_password_ciphertext"], secret_key)
    client_type = smtplib.SMTP_SSL if smtp.get("smtp_use_ssl") else smtplib.SMTP
    try:
        with client_type(smtp["smtp_server"], int(smtp["smtp_port"]), timeout=30) as client:
            client.login(smtp["smtp_user"], password)
            client.send_message(message, to_addrs=to + cc + bcc)
        _update_send_status(database, report_key, "success", "", now)
    except Exception as error:
        _update_send_status(database, report_key, "failed", str(error)[:500], now)
        raise
    return now.strftime("%Y-%m-%d %H:%M:%S")


def _update_send_status(database, report_key, status, error, sent_time):
    conn = database()
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE mo_report_delivery_setting_yx
            SET last_sent_time=%s,last_send_status=%s,last_error=%s
            WHERE report_key=%s
        """, (sent_time, status, error, report_key))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
