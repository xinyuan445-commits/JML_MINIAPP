from datetime import datetime
from io import BytesIO
from unittest.mock import MagicMock

from openpyxl import load_workbook

from approval_email import (
    _approval_details,
    _previous_week,
    _send_message,
    _weekly_workbook,
)
from report_email_settings import encrypt_smtp_password


def approval_row(request_no, review_time):
    return {
        "id": 1,
        "request_no": request_no,
        "module_type": "process",
        "action_type": "edit",
        "target_key": "P-01",
        "before_data": {"process_code": "P-01", "process_name": "下料"},
        "after_data": {"process_code": "P-01", "process_name": "裁切"},
        "applicant_name": "申请人",
        "reviewer_name": "审批人",
        "review_comment": "同意",
        "apply_time": "2026-10-20 08:00:00",
        "review_time": review_time,
    }


def test_previous_week_is_the_previous_natural_week():
    start, end = _previous_week(datetime(2026, 11, 2, 9, 0))
    assert str(start) == "2026-10-26"
    assert str(end) == "2026-11-01"


def test_weekly_workbook_keeps_reverse_order_and_highlights_previous_week():
    rows = [
        approval_row("APR-00000002", datetime(2026, 11, 2, 9, 0)),
        approval_row("APR-00000001", datetime(2026, 10, 30, 9, 0)),
    ]

    _, content, highlighted = _weekly_workbook(
        rows, datetime(2026, 11, 2, 10, 0),
    )

    sheet = load_workbook(BytesIO(content)).active
    assert sheet["B3"].value == "APR-00000002"
    assert sheet["B4"].value == "APR-00000001"
    assert sheet["A1"].value == (
        "数据范围：2026-10-30 09:00 至 2026-11-02 10:00（共 2 张审批单）"
    )
    assert sheet["A1"].font.color.rgb == "0017365D"
    assert sheet["G1"].value == "图例"
    assert sheet["H1"].value == "新增"
    assert sheet["H1"].fill.fgColor.rgb == "00E2F0D9"
    assert sheet["M1"].value is None
    assert sheet["N1"].value is None
    assert sheet["A2"].fill.fgColor.rgb == "00D9EAF7"
    assert sheet["G3"].fill.fgColor.rgb == "00DDEBF7"
    assert sheet["J3"].value == "修改"
    assert sheet["J3"].font.bold is True
    assert sheet["A4"].fill.fgColor.rgb == "00FFF2CC"
    assert sheet["G4"].fill.fgColor.rgb == "00DDEBF7"
    assert sheet.freeze_panes == "A3"
    assert sheet.auto_filter.ref == "A2:N4"
    assert highlighted == 1


def test_approval_sender_uses_to_cc_bcc_without_bcc_header(monkeypatch):
    ciphertext = encrypt_smtp_password("smtp-secret", "flask-secret")
    connection = MagicMock()
    cursor = connection.cursor.return_value
    cursor.fetchone.side_effect = [
        {
            "smtp_server": "smtp.example.com",
            "smtp_port": 465,
            "smtp_user": "report@example.com",
            "smtp_use_ssl": 1,
            "smtp_password_ciphertext": ciphertext,
        },
        {"id": 1},
    ]
    smtp_factory = MagicMock()
    smtp_client = smtp_factory.return_value.__enter__.return_value
    monkeypatch.setattr("approval_email.smtplib.SMTP_SSL", smtp_factory)

    _send_message(
        MagicMock(return_value=connection),
        "flask-secret",
        {
            "to_recipients": "to@example.com",
            "cc_recipients": "cc@example.com",
            "bcc_recipients": "bcc@example.com",
        },
        "审批邮件",
        "正文",
        "<p>正文</p>",
    )

    message = smtp_client.send_message.call_args.args[0]
    assert message["To"] == "to@example.com"
    assert message["Cc"] == "cc@example.com"
    assert message["Bcc"] is None
    assert smtp_client.send_message.call_args.kwargs["to_addrs"] == [
        "to@example.com",
        "cc@example.com",
        "bcc@example.com",
    ]


def test_route_steps_are_compared_by_sequence_with_clear_change_types():
    row = {
        "module_type": "route",
        "action_type": "version",
        "target_key": "79",
        "before_data": {
            "route_code": "RT-01",
            "route_name": "原路线",
            "steps": [
                {"seq": 1, "process_id": 1, "process_name": "裁切", "station_id": 1, "station_name": "裁切"},
                {"seq": 2, "process_id": 2, "process_name": "封边", "station_id": 2, "station_name": "封边"},
                {"seq": 3, "process_id": 3, "process_name": "修补", "station_id": 3, "station_name": "修补"},
            ],
        },
        "after_data": {
            "steps": [
                {"seq": 1, "process_id": 1, "process_name": "裁切", "station_id": 1, "station_name": "裁切"},
                {"seq": 2, "process_id": 4, "process_name": "倒角", "station_id": 4, "station_name": "倒角"},
            ],
        },
    }

    name, code, changes, steps = _approval_details(row)

    assert name == "原路线"
    assert code == "RT-01"
    assert changes == []
    assert [item["change_type"] for item in steps] == ["保留", "调整", "删除"]
    assert steps[1]["before_process"] == "封边"
    assert steps[1]["after_process"] == "倒角"
    assert steps[2]["after_process"] == "-"


def test_historical_approval_without_after_snapshot_is_not_labeled_as_updated():
    row = {
        "module_type": "route",
        "action_type": "version",
        "target_key": "33",
        "before_data": {
            "route_code": "RT-PROD-01",
            "route_name": "原路线",
            "steps": [{"seq": 1, "process_id": 1, "station_id": 1}],
        },
        "after_data": {"id": 33},
    }

    _, _, changes, steps = _approval_details(row)

    assert changes == [(
        "历史审批明细",
        "原资料已记录",
        "未保存具体变更内容",
    )]
    assert steps == []


def test_new_version_email_shows_explicit_default_choice():
    row = {
        "module_type": "route", "action_type": "version", "target_key": "10",
        "before_data": {"route_name": "压贴", "is_current": 1},
        "after_data": {"set_default": False},
    }
    _, _, changes, _ = _approval_details(row)
    assert ("设为默认版本", "-", "否") in changes


def test_weekly_workbook_merges_repeated_approval_columns_but_keeps_changes_separate():
    row = {
        "request_no": "APR-00000042",
        "module_type": "route",
        "action_type": "version",
        "target_key": "33",
        "before_data": {
            "route_code": "RT-PROD-01",
            "route_name": "原路线",
            "steps": [
                {"seq": 1, "process_id": 1, "process_name": "裁切", "station_id": 1, "station_name": "裁切"},
                {"seq": 2, "process_id": 2, "process_name": "封边", "station_id": 2, "station_name": "封边"},
            ],
        },
        "after_data": {
            "steps": [
                {"seq": 1, "process_id": 1, "process_name": "裁切", "station_id": 1, "station_name": "裁切"},
                {"seq": 2, "process_id": 3, "process_name": "倒角", "station_id": 3, "station_name": "倒角"},
            ],
        },
        "applicant_name": "申请人",
        "reviewer_name": "审批人",
        "review_comment": "",
        "apply_time": datetime(2026, 10, 30, 8, 0),
        "review_time": datetime(2026, 10, 30, 9, 0),
    }

    _, content, _ = _weekly_workbook([row], datetime(2026, 11, 2, 10, 0))
    sheet = load_workbook(BytesIO(content)).active
    merged = {str(item) for item in sheet.merged_cells.ranges}

    assert "A3:A4" in merged
    assert "F3:F4" in merged
    assert "K3:K4" in merged
    assert "N3:N4" in merged
    assert not any(item.startswith("G") for item in merged)
    assert sheet["G3"].value == "第1步"
    assert sheet["G4"].value == "第2步"
