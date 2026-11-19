"""Secure SMTP and per-report delivery settings."""
import base64
import hashlib
import json
import re
from datetime import datetime, time, timedelta

from cryptography.fernet import Fernet
from flask import Blueprint, current_app, g, jsonify, request


REPORT_CATALOG = (
    ("production-dashboard", "生产现场看板"),
    ("receipt-comparison", "末工序入库对账"),
    ("workorder-process-report", "工单工序报告"),
)
REPORT_KEYS = frozenset(key for key, _ in REPORT_CATALOG)
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _cipher(secret_key):
    secret = str(secret_key or "").encode("utf-8")
    if not secret:
        raise RuntimeError("邮件密码加密密钥未配置")
    key = base64.urlsafe_b64encode(hashlib.sha256(secret).digest())
    return Fernet(key)


def encrypt_smtp_password(password, secret_key):
    return _cipher(secret_key).encrypt(password.encode("utf-8")).decode("ascii")


def decrypt_smtp_password(ciphertext, secret_key):
    return _cipher(secret_key).decrypt(ciphertext.encode("ascii")).decode("utf-8")


def _text(body, field, label, limit=255, required=True):
    value = body.get(field)
    if value is None and not required:
        return ""
    if not isinstance(value, str):
        raise ValueError(f"请填写有效的{label}")
    value = value.strip()
    if (
        (required and not value)
        or len(value) > limit
        or any(ord(char) < 32 and char not in "\r\n\t" for char in value)
    ):
        raise ValueError(f"请填写有效的{label}")
    return value


def _emails(body, field, label, required=False):
    raw = _text(body, field, label, 4000, required=required)
    if not raw:
        return ""
    values = [item.strip() for item in re.split(r"[,;；，\n]+", raw) if item.strip()]
    if any(not EMAIL_PATTERN.fullmatch(item) for item in values):
        raise ValueError(f"{label}中存在无效邮箱")
    return ";".join(dict.fromkeys(values))


def _smtp_payload(row):
    return {
        "smtp_server": row.get("smtp_server", "") if row else "",
        "smtp_port": int(row.get("smtp_port") or 465) if row else 465,
        "smtp_user": row.get("smtp_user", "") if row else "",
        "smtp_use_ssl": bool(row.get("smtp_use_ssl", 1)) if row else True,
        "password_configured": bool(row and row.get("smtp_password_ciphertext")),
        "revision": int(row.get("revision") or 0) if row else 0,
        "updated_by": row.get("updated_by") if row else None,
        "update_time": str(row.get("update_time")) if row and row.get("update_time") else None,
    }


def send_time_text(value):
    if isinstance(value, timedelta):
        seconds = int(value.total_seconds()) % 86400
        return f"{seconds // 3600:02d}:{seconds % 3600 // 60:02d}"
    if isinstance(value, time):
        return value.strftime("%H:%M")
    match = re.fullmatch(r"(\d{1,2}):(\d{2})(?::\d{2})?", str(value or ""))
    if match:
        return f"{int(match.group(1)):02d}:{match.group(2)}"
    return "08:00"


def next_send_time(row, now=None):
    if not row or not row.get("is_enabled") or row.get("send_mode") != "scheduled":
        return None
    current = now or datetime.now()
    hour, minute = (int(value) for value in send_time_text(row.get("send_time")).split(":"))
    candidate = current.replace(hour=hour, minute=minute, second=0, microsecond=0)
    frequency = row.get("schedule_frequency")
    if frequency == "daily":
        if candidate <= current:
            candidate += timedelta(days=1)
    elif frequency == "weekly":
        week_day = int(row.get("week_day") or 1)
        candidate += timedelta(days=(week_day - current.isoweekday()) % 7)
        if candidate <= current:
            candidate += timedelta(days=7)
    elif frequency == "monthly":
        month_day = int(row.get("month_day") or 1)
        candidate = candidate.replace(day=month_day)
        if candidate <= current:
            year = current.year + (1 if current.month == 12 else 0)
            month = 1 if current.month == 12 else current.month + 1
            candidate = candidate.replace(year=year, month=month, day=month_day)
    else:
        return None
    return candidate.strftime("%Y-%m-%d %H:%M")


def _report_payload(row, report_key, report_name):
    return {
        "report_key": report_key,
        "report_name": report_name,
        "is_enabled": bool(row.get("is_enabled", 0)) if row else False,
        "send_mode": row.get("send_mode", "manual") if row else "manual",
        "schedule_frequency": row.get("schedule_frequency", "daily") if row else "daily",
        "send_time": send_time_text(row.get("send_time")) if row else "08:00",
        "week_day": int(row.get("week_day") or 1) if row else 1,
        "month_day": int(row.get("month_day") or 1) if row else 1,
        "to_recipients": row.get("to_recipients", "") if row else "",
        "cc_recipients": row.get("cc_recipients", "") if row else "",
        "bcc_recipients": row.get("bcc_recipients", "") if row else "",
        "email_subject": row.get("email_subject", report_name) if row else report_name,
        "email_body": row.get("email_body", "") if row else "",
        "revision": int(row.get("revision") or 0) if row else 0,
        "updated_by": row.get("updated_by") if row else None,
        "update_time": str(row.get("update_time")) if row and row.get("update_time") else None,
        "last_sent_time": str(row.get("last_sent_time")) if row and row.get("last_sent_time") else None,
        "last_send_status": row.get("last_send_status") if row else None,
        "last_error": row.get("last_error") if row else None,
        "next_send_time": next_send_time(row),
    }


def _audit(cur, action, data):
    cur.execute("""
        INSERT INTO mo_admin_audit_log_yx
            (username,action_name,request_method,request_path,target_id,
             request_data,result_code,result_message,ip_address)
        VALUES (%s,%s,%s,%s,%s,%s,0,'',%s)
    """, (
        g.audit_username,
        action,
        request.method,
        request.path,
        str(data.get("report_key") or 1),
        json.dumps(data, ensure_ascii=False),
        request.remote_addr or "",
    ))


def report_email_settings_blueprint(database, secret_key, send_report=None, test_smtp=None):
    bp = Blueprint("report_email_settings", __name__)

    @bp.get("/api/admin/basic-settings/email-service")
    def get_email_service_settings():
        conn = None
        cur = None
        try:
            conn = database()
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM mo_report_email_setting_yx WHERE id=1")
            return jsonify({"code": 0, "data": _smtp_payload(cur.fetchone())})
        except Exception:
            return jsonify({"code": 503, "msg": "邮件服务配置暂不可用"}), 503
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()

    @bp.get("/api/admin/report-email-settings")
    def get_settings():
        conn = None
        cur = None
        try:
            conn = database()
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM mo_report_email_setting_yx WHERE id=1")
            smtp = _smtp_payload(cur.fetchone())
            cur.execute("SELECT * FROM mo_report_delivery_setting_yx")
            saved = {row["report_key"]: row for row in cur.fetchall()}
            reports = [
                _report_payload(saved.get(key), key, name)
                for key, name in REPORT_CATALOG
            ]
            return jsonify({"code": 0, "data": {"smtp": smtp, "reports": reports}})
        except Exception:
            return jsonify({"code": 503, "msg": "报表发送配置暂不可用"}), 503
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()

    @bp.post("/api/admin/basic-settings/email-service/save")
    @bp.post("/api/admin/report-email-settings/smtp/save")
    def save_smtp_settings():
        conn = None
        cur = None
        try:
            body = request.get_json(silent=True)
            if not isinstance(body, dict):
                raise ValueError("请求内容必须是对象")
            server = _text(body, "smtp_server", "SMTP服务器")
            user = _text(body, "smtp_user", "SMTP账号")
            port = body.get("smtp_port")
            if isinstance(port, bool) or not isinstance(port, int) or not 1 <= port <= 65535:
                raise ValueError("SMTP端口应为1至65535")
            use_ssl = body.get("smtp_use_ssl")
            if use_ssl not in (True, False, 0, 1):
                raise ValueError("SSL设置无效")
            revision = body.get("revision")
            if isinstance(revision, bool) or not isinstance(revision, int) or revision < 0:
                raise ValueError("配置版本无效")

            conn = database()
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM mo_report_email_setting_yx WHERE id=1 FOR UPDATE")
            before = cur.fetchone()
            current_revision = int(before.get("revision") or 0) if before else 0
            if revision != current_revision:
                raise ValueError("SMTP配置已变化，请刷新后重试")
            supplied_password = body.get("smtp_password")
            if supplied_password in (None, ""):
                ciphertext = before.get("smtp_password_ciphertext") if before else None
                password_changed = False
            else:
                if not isinstance(supplied_password, str) or len(supplied_password) > 256:
                    raise ValueError("SMTP密码格式无效")
                ciphertext = encrypt_smtp_password(supplied_password, secret_key)
                password_changed = True
            if not ciphertext:
                raise ValueError("请填写SMTP密码")

            next_revision = current_revision + 1
            values = (server, port, user, ciphertext, int(bool(use_ssl)), next_revision, g.audit_username)
            if before:
                cur.execute("""
                    UPDATE mo_report_email_setting_yx
                    SET smtp_server=%s,smtp_port=%s,smtp_user=%s,
                        smtp_password_ciphertext=%s,smtp_use_ssl=%s,
                        revision=%s,updated_by=%s WHERE id=1
                """, values)
            else:
                cur.execute("""
                    INSERT INTO mo_report_email_setting_yx
                        (id,smtp_server,smtp_port,smtp_user,smtp_password_ciphertext,
                         smtp_use_ssl,revision,updated_by)
                    VALUES (1,%s,%s,%s,%s,%s,%s,%s)
                """, values)
            audit_data = {
                "smtp_server": server,
                "smtp_port": port,
                "smtp_user": user,
                "smtp_use_ssl": bool(use_ssl),
                "password_changed": password_changed,
            }
            _audit(cur, "修改报表SMTP配置", audit_data)
            conn.commit()
            return jsonify({"code": 0, "data": {
                **audit_data,
                "password_configured": True,
                "revision": next_revision,
                "updated_by": g.audit_username,
            }})
        except ValueError as error:
            if conn:
                conn.rollback()
            return jsonify({"code": 400, "msg": str(error)}), 400
        except Exception:
            if conn:
                conn.rollback()
            return jsonify({"code": 503, "msg": "SMTP配置保存失败"}), 503
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()

    @bp.post("/api/admin/basic-settings/email-service/test")
    @bp.post("/api/admin/report-email-settings/smtp/test")
    def test_smtp_settings():
        if test_smtp is None:
            return jsonify({"code": 503, "msg": "SMTP测试服务未启用"}), 503
        try:
            test_smtp()
            conn = database()
            cur = conn.cursor(dictionary=True)
            try:
                _audit(cur, "测试报表SMTP连接", {})
                conn.commit()
            except Exception:
                conn.rollback()
                current_app.logger.exception("SMTP connection test audit failed")
            finally:
                cur.close()
                conn.close()
            return jsonify({"code": 0, "data": {"connected": True}})
        except ValueError as error:
            return jsonify({"code": 400, "msg": str(error)}), 400
        except Exception:
            return jsonify({"code": 503, "msg": "SMTP连接失败"}), 503

    @bp.post("/api/admin/report-email-settings/report/save")
    def save_report_settings():
        conn = None
        cur = None
        try:
            body = request.get_json(silent=True)
            if not isinstance(body, dict):
                raise ValueError("请求内容必须是对象")
            report_key = body.get("report_key")
            if report_key not in REPORT_KEYS:
                raise ValueError("报表不存在")
            enabled = body.get("is_enabled")
            if enabled not in (True, False, 0, 1):
                raise ValueError("发送开关无效")
            send_mode = body.get("send_mode")
            if send_mode not in {"manual", "scheduled"}:
                raise ValueError("发送方式无效")
            frequency = body.get("schedule_frequency")
            if frequency not in {"daily", "weekly", "monthly"}:
                raise ValueError("定时周期无效")
            send_time = body.get("send_time")
            if not isinstance(send_time, str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", send_time):
                raise ValueError("发送时间无效")
            week_day = body.get("week_day")
            month_day = body.get("month_day")
            if isinstance(week_day, bool) or not isinstance(week_day, int) or not 1 <= week_day <= 7:
                raise ValueError("星期设置无效")
            if isinstance(month_day, bool) or not isinstance(month_day, int) or not 1 <= month_day <= 28:
                raise ValueError("每月日期应为1至28")
            revision = body.get("revision")
            if isinstance(revision, bool) or not isinstance(revision, int) or revision < 0:
                raise ValueError("配置版本无效")
            to_recipients = _emails(body, "to_recipients", "收件人", required=bool(enabled))
            cc_recipients = _emails(body, "cc_recipients", "抄送人")
            bcc_recipients = _emails(body, "bcc_recipients", "密送人")
            subject = _text(body, "email_subject", "邮件主题", 500)
            email_body = _text(body, "email_body", "邮件正文", 10000, required=False)

            conn = database()
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT * FROM mo_report_delivery_setting_yx WHERE report_key=%s FOR UPDATE",
                (report_key,),
            )
            before = cur.fetchone()
            current_revision = int(before.get("revision") or 0) if before else 0
            if revision != current_revision:
                raise ValueError("报表发送配置已变化，请刷新后重试")
            next_revision = current_revision + 1
            values = (
                int(bool(enabled)), send_mode, frequency, send_time,
                week_day, month_day, to_recipients, cc_recipients,
                bcc_recipients, subject, email_body, next_revision,
                g.audit_username, report_key,
            )
            if before:
                cur.execute("""
                    UPDATE mo_report_delivery_setting_yx
                    SET is_enabled=%s,send_mode=%s,schedule_frequency=%s,send_time=%s,
                        week_day=%s,month_day=%s,to_recipients=%s,cc_recipients=%s,
                        bcc_recipients=%s,email_subject=%s,email_body=%s,
                        revision=%s,updated_by=%s WHERE report_key=%s
                """, values)
            else:
                cur.execute("""
                    INSERT INTO mo_report_delivery_setting_yx
                        (is_enabled,send_mode,schedule_frequency,send_time,week_day,
                         month_day,to_recipients,cc_recipients,bcc_recipients,
                         email_subject,email_body,revision,updated_by,report_key)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, values)
            saved = {
                "report_key": report_key,
                "is_enabled": bool(enabled),
                "send_mode": send_mode,
                "schedule_frequency": frequency,
                "send_time": send_time,
                "week_day": week_day,
                "month_day": month_day,
                "to_recipients": to_recipients,
                "cc_recipients": cc_recipients,
                "bcc_recipients": bcc_recipients,
                "email_subject": subject,
                "email_body": email_body,
                "revision": next_revision,
                "updated_by": g.audit_username,
                "last_sent_time": before.get("last_sent_time") if before else None,
                "last_send_status": before.get("last_send_status") if before else None,
                "last_error": before.get("last_error") if before else None,
            }
            _audit(cur, "修改报表发送配置", saved)
            conn.commit()
            name = dict(REPORT_CATALOG)[report_key]
            return jsonify({"code": 0, "data": _report_payload(saved, report_key, name)})
        except ValueError as error:
            if conn:
                conn.rollback()
            return jsonify({"code": 400, "msg": str(error)}), 400
        except Exception:
            if conn:
                conn.rollback()
            return jsonify({"code": 503, "msg": "报表发送配置保存失败"}), 503
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()

    @bp.post("/api/admin/report-email-settings/send")
    def send_now():
        body = request.get_json(silent=True)
        if not isinstance(body, dict) or body.get("report_key") not in REPORT_KEYS:
            return jsonify({"code": 400, "msg": "报表不存在"}), 400
        if send_report is None:
            return jsonify({"code": 503, "msg": "报表发送服务未启用"}), 503
        report_key = body["report_key"]
        try:
            sent_at = send_report(report_key)
            conn = database()
            cur = conn.cursor(dictionary=True)
            try:
                _audit(cur, "手动发送报表邮件", {"report_key": report_key})
                conn.commit()
            except Exception:
                conn.rollback()
                current_app.logger.exception("manual report email audit failed")
            finally:
                cur.close()
                conn.close()
            return jsonify({"code": 0, "data": {
                "report_key": report_key,
                "sent_at": sent_at,
            }})
        except ValueError as error:
            return jsonify({"code": 400, "msg": str(error)}), 400
        except Exception:
            return jsonify({"code": 503, "msg": "报表邮件发送失败"}), 503

    return bp
