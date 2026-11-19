from io import BytesIO
from datetime import datetime, timedelta
from unittest.mock import MagicMock

from openpyxl import load_workbook

import app as webapp
from report_email_scheduler import due_slot
from report_email_sender import check_smtp_connection, send_configured_report
from report_email_settings import (
    REPORT_CATALOG,
    _smtp_payload,
    decrypt_smtp_password,
    encrypt_smtp_password,
    next_send_time,
)


def test_report_catalog_includes_production_dashboard():
    assert ("production-dashboard", "生产现场看板") in REPORT_CATALOG


def test_production_dashboard_attachment_uses_default_visible_orders(monkeypatch):
    orders = [
        {
            "mo_code": "SCDD-OPEN",
            "sort_seq": 1,
            "customer_name": "测试客户",
            "inv_code": "TEST-001",
            "inv_name": "测试产品",
            "inv_std": "1000*500",
            "plan_qty": 10,
            "unit_name": "张",
            "plan_start_date": "2026-10-25 00:00:00",
            "plan_due_date": "2026-10-26 00:00:00",
            "is_closed": False,
            "is_overdue": True,
            "steps": [{
                "seq": 1,
                "process_name": "压贴",
                "status": "processing",
                "normal_received_qty": 10,
                "normal_done_qty": 5,
                "normal_remaining_qty": 5,
                "receive_available_qty": 0,
                "rework_remaining_qty": 0,
                "first_start_time": "2026-10-26 08:00:00",
                "last_end_time": None,
            }],
        },
        {
            "mo_code": "SCDD-UNREPORTED",
            "sort_seq": 2,
            "has_reporting": False,
            "is_closed": False,
            "steps": [],
        },
        {
            "mo_code": "SCDD-CLOSED",
            "sort_seq": 1,
            "is_closed": True,
            "steps": [{"seq": 1, "normal_remaining_qty": 5}],
        },
    ]
    monkeypatch.setattr(
        webapp,
        "dashboard_operations",
        lambda: webapp.jsonify({"code": 0, "data": {"orders": orders}}),
    )

    with webapp.app.test_request_context("/"):
        filename, content = webapp.build_report_attachment("production-dashboard")

    sheet = load_workbook(BytesIO(content)).active
    assert filename.startswith("生产现场看板_")
    assert sheet.title == "生产现场看板"
    assert sheet["A1"].value == "图例"
    assert sheet["B1"].value == "已完成"
    assert sheet["B1"].fill.fgColor.rgb == "00CFEADE"
    assert sheet["J1"].value == "数量异常"
    assert sheet["K1"].value == "逾期"
    assert sheet["A2"].value == "工单号"
    assert sheet["I2"].value == "计划开工"
    assert sheet["L2"].value == "工序1"
    assert sheet["A3"].value == "SCDD-OPEN"
    assert sheet["I3"].value == "2026-10-25"
    assert "压贴\n生产中" in sheet["L3"].value
    assert sheet["L3"].fill.fgColor.rgb == "00F7E2A7"
    assert sheet["J3"].font.bold is True
    assert sheet["J3"].font.color.rgb == "00C22F3F"
    assert sheet["K3"].font.bold is True
    assert sheet["A4"].value == "SCDD-UNREPORTED"
    assert sheet["K4"].value == "未报工"
    assert sheet.max_row == 4


def test_smtp_password_is_encrypted_and_never_serialized():
    ciphertext = encrypt_smtp_password("smtp-secret", "flask-secret")
    assert ciphertext != "smtp-secret"
    assert decrypt_smtp_password(ciphertext, "flask-secret") == "smtp-secret"
    payload = _smtp_payload({
        "smtp_server": "smtp.example.com",
        "smtp_port": 465,
        "smtp_user": "report@example.com",
        "smtp_use_ssl": 1,
        "smtp_password_ciphertext": ciphertext,
        "revision": 1,
    })
    assert payload["password_configured"] is True
    assert "smtp_password_ciphertext" not in payload


def test_basic_settings_reads_existing_email_service(monkeypatch, legacy_admin_access):
    connection = MagicMock()
    connection.cursor.return_value.fetchone.return_value = {
        "smtp_server": "smtp.example.com",
        "smtp_port": 465,
        "smtp_user": "report@example.com",
        "smtp_use_ssl": 1,
        "smtp_password_ciphertext": "encrypted",
        "revision": 3,
    }
    monkeypatch.setattr(webapp, "db", lambda: connection)
    client = webapp.app.test_client()
    with client.session_transaction() as values:
        values["admin_username"] = "admin"
        values["admin_role"] = "admin"

    response = client.get("/api/admin/basic-settings/email-service")

    assert response.status_code == 200
    assert response.get_json()["data"] == {
        "smtp_server": "smtp.example.com",
        "smtp_port": 465,
        "smtp_user": "report@example.com",
        "smtp_use_ssl": True,
        "password_configured": True,
        "revision": 3,
        "updated_by": None,
        "update_time": None,
    }


def test_schedule_slots_cover_daily_weekly_and_monthly():
    now = datetime(2026, 10, 26, 8, 30)
    base = {"is_enabled": 1, "send_mode": "scheduled", "send_time": "08:30:00"}
    assert due_slot({**base, "schedule_frequency": "daily"}, now) == "daily:2026-10-26"
    assert due_slot({**base, "schedule_frequency": "weekly", "week_day": 1}, now) == "weekly:2026-44"
    assert due_slot({**base, "schedule_frequency": "monthly", "month_day": 26}, now) == "monthly:2026-10"
    assert due_slot({**base, "schedule_frequency": "weekly", "week_day": 2}, now) is None
    assert due_slot({**base, "send_time": timedelta(hours=8, minutes=30), "schedule_frequency": "daily"}, now) == "daily:2026-10-26"


def test_next_send_time_covers_daily_weekly_and_monthly():
    now = datetime(2026, 10, 29, 9, 0)
    base = {"is_enabled": 1, "send_mode": "scheduled", "send_time": "08:30"}
    assert next_send_time({**base, "schedule_frequency": "daily"}, now) == "2026-10-30 08:30"
    assert next_send_time({**base, "schedule_frequency": "weekly", "week_day": 5}, now) == "2026-10-30 08:30"
    assert next_send_time({**base, "schedule_frequency": "monthly", "month_day": 29}, now) == "2026-11-29 08:30"
    assert next_send_time({**base, "is_enabled": 0}, now) is None


def test_sender_uses_to_cc_bcc_without_exposing_bcc_header(monkeypatch):
    ciphertext = encrypt_smtp_password("smtp-secret", "flask-secret")
    read_conn = MagicMock()
    read_cur = read_conn.cursor.return_value
    read_cur.fetchone.side_effect = [
        {
            "smtp_server": "smtp.example.com",
            "smtp_port": 465,
            "smtp_user": "report@example.com",
            "smtp_use_ssl": 1,
            "smtp_password_ciphertext": ciphertext,
        },
        {
            "report_key": "receipt-comparison",
            "is_enabled": 1,
            "to_recipients": "to@example.com",
            "cc_recipients": "cc@example.com",
            "bcc_recipients": "bcc@example.com",
            "email_subject": "{report_name} {date}",
            "email_body": "生成时间：{datetime}",
        },
    ]
    update_conn = MagicMock()
    database = MagicMock(side_effect=[read_conn, update_conn])
    smtp_factory = MagicMock()
    smtp_client = smtp_factory.return_value.__enter__.return_value
    monkeypatch.setattr("report_email_sender.smtplib.SMTP_SSL", smtp_factory)

    send_configured_report(
        database,
        "flask-secret",
        lambda _: ("report.xlsx", b"xlsx"),
        "receipt-comparison",
    )

    smtp_client.login.assert_called_once_with("report@example.com", "smtp-secret")
    message = smtp_client.send_message.call_args.args[0]
    assert message["To"] == "to@example.com"
    assert message["Cc"] == "cc@example.com"
    assert message["Bcc"] is None
    assert smtp_client.send_message.call_args.kwargs["to_addrs"] == [
        "to@example.com",
        "cc@example.com",
        "bcc@example.com",
    ]


def test_smtp_connection_logs_in_without_sending(monkeypatch):
    ciphertext = encrypt_smtp_password("smtp-secret", "flask-secret")
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchone.return_value = {
        "smtp_server": "smtp.example.com",
        "smtp_port": 465,
        "smtp_user": "report@example.com",
        "smtp_use_ssl": 1,
        "smtp_password_ciphertext": ciphertext,
    }
    smtp_factory = MagicMock()
    smtp_client = smtp_factory.return_value.__enter__.return_value
    monkeypatch.setattr("report_email_sender.smtplib.SMTP_SSL", smtp_factory)

    assert check_smtp_connection(MagicMock(return_value=conn), "flask-secret") is True

    smtp_factory.assert_called_once_with("smtp.example.com", 465, timeout=30)
    smtp_client.login.assert_called_once_with("report@example.com", "smtp-secret")
    smtp_client.send_message.assert_not_called()
