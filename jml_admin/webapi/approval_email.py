"""Approval notification emails and the weekly cumulative change list."""
import html
import json
import smtplib
import uuid
from datetime import datetime, timedelta
from email.message import EmailMessage
from io import BytesIO

from flask import Blueprint, current_app, g, jsonify, request
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from report_email_settings import (
    EMAIL_PATTERN,
    decrypt_smtp_password,
    send_time_text,
)


MODULE_NAMES = {
    "equipment": "设备档案",
    "equipment-capacity": "标准产能",
    "process": "工序管理",
    "workstation": "工站管理",
    "category": "报工类别",
    "route": "工艺路线",
}
ACTION_NAMES = {
    "create": "新增",
    "edit": "编辑",
    "status": "状态调整",
    "version": "新版本",
    "restore": "设为默认版本",
}
SUBJECT_FIELDS = {
    "equipment": ("device_name", "station_name"),
    "equipment-capacity": ("device_name", "process_name"),
    "process": ("process_name", "process_code"),
    "workstation": ("station_name", "station_code"),
    "category": ("name", "code"),
    "route": ("route_name", "route_code"),
}
CODE_FIELDS = {
    "equipment": "device_code",
    "equipment-capacity": "device_code",
    "process": "process_code",
    "workstation": "station_code",
    "category": "code",
    "route": "route_code",
}
FIELD_NAMES = {
    "device_code": "设备编号", "device_enabled": "设备状态",
    "device_name": "设备名称", "station_name": "工站名称",
    "process_name": "工序名称", "category_name": "适用类别",
    "category_code": "类别编码", "device_type": "设备类型",
    "workshop": "车间", "location": "位置", "brand": "品牌",
    "model": "型号", "serial_no": "出厂编号", "commissioned_on": "投用日期",
    "photo": "设备照片", "capacity_mode": "产能模式", "quantity": "标准数量",
    "unit": "计量单位", "period": "时间周期", "effective_hours": "周期有效工时",
    "staffing": "标准配员", "setup_minutes": "换型准备时间（分钟）",
    "basis": "标准依据", "measured_on": "测定日期", "specification": "规格说明",
    "remark": "备注", "process_code": "工序编码", "station_code": "工站编码",
    "code": "类别编码", "name": "类别名称", "route_code": "路线编码",
    "route_name": "路线名称", "dept_code": "部门代码", "description": "描述",
    "sort": "排序", "is_active": "状态", "is_enabled": "状态",
    "is_default": "默认路线", "product_codes": "适用产品类别",
    "set_default": "设为默认版本",
    "steps": "工序步骤", "version_note": "版本说明",
}
HIDDEN_FIELDS = {
    "id", "route_id", "device_id", "station_id", "process_id", "mode",
    "version_group", "version_no", "parent_route_id", "is_current",
    "current_route_id", "dept_name", "revision",
}

CHANGE_STYLES = {
    "新增": {"fill": "E2F0D9", "font": "548235"},
    "修改": {"fill": "DDEBF7", "font": "2F5597"},
    "调整": {"fill": "FCE4D6", "font": "C65911"},
    "删除": {"fill": "F4CCCC", "font": "9C0006"},
    "保留": {"fill": "F2F2F2", "font": "7F7F7F"},
    "历史明细缺失": {"fill": "FFF2CC", "font": "9C6500"},
}


def _json_object(value):
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return {}
    return value if isinstance(value, dict) else {}


def _display_value(field, value):
    if value in (None, ""):
        return "-"
    if field == "photo":
        return "已上传照片"
    labels = {
        "capacity_mode": {"finite": "有限产能", "unlimited": "无限产能"},
        "period": {"minute": "每分钟", "hour": "每小时", "day": "每天", "shift": "每班"},
        "basis": {"experience": "经验估算", "measured": "现场实测", "manufacturer": "厂家参数"},
    }
    if field in labels and str(value) in labels[field]:
        return labels[field][str(value)]
    if field in {"device_enabled", "is_active", "is_enabled"}:
        return "启用" if bool(value) else "停用"
    if field in {"is_default", "set_default"}:
        return "是" if bool(value) else "否"
    if field == "steps" and isinstance(value, list):
        return "；".join(
            f"{index}. {step.get('process_name') or f'工序#{step.get("process_id")}'} / "
            f"{step.get('station_name') or f'工站#{step.get("station_id")}'}"
            for index, step in enumerate(value, 1)
        ) or "-"
    if isinstance(value, list):
        return "、".join(str(item) for item in value) or "-"
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)


def _step_name(step, kind):
    if not step:
        return "-"
    name = step.get(f"{kind}_name")
    identifier = step.get(f"{kind}_id")
    return str(name or (f"{kind == 'process' and '工序' or '工站'}#{identifier}" if identifier else "-"))


def _route_step_details(before_steps, after_steps):
    before_by_seq = {
        int(step.get("seq") or index): step
        for index, step in enumerate(before_steps or [], 1)
    }
    after_by_seq = {
        int(step.get("seq") or index): step
        for index, step in enumerate(after_steps or [], 1)
    }
    details = []
    for seq in sorted(set(before_by_seq) | set(after_by_seq)):
        before = before_by_seq.get(seq)
        after = after_by_seq.get(seq)
        if before is None:
            change_type = "新增"
        elif after is None:
            change_type = "删除"
        elif (
            before.get("process_id") != after.get("process_id")
            or before.get("station_id") != after.get("station_id")
        ):
            change_type = "调整"
        else:
            change_type = "保留"
        details.append({
            "seq": seq,
            "before_process": _step_name(before, "process"),
            "before_station": _step_name(before, "station"),
            "after_process": _step_name(after, "process"),
            "after_station": _step_name(after, "station"),
            "change_type": change_type,
        })
    return details


def _approval_details(row):
    before = _json_object(row.get("before_data"))
    supplied_after = _json_object(row.get("after_data"))
    after = {**before, **supplied_after}
    module = row.get("module_type")
    name_fields = SUBJECT_FIELDS.get(module, ("name", "code"))
    subject_name = next(
        (str(after.get(field)) for field in name_fields if after.get(field)),
        str(row.get("target_key") or "-"),
    )
    code_field = CODE_FIELDS.get(module, "code")
    subject_code = str(after.get(code_field) or "")
    changed = []
    for field in FIELD_NAMES:
        if field in HIDDEN_FIELDS or field == "steps" or field not in after:
            continue
        if row.get("action_type") != "create" and before.get(field) == after.get(field):
            continue
        changed.append((
            FIELD_NAMES[field],
            "-" if row.get("action_type") == "create" else _display_value(field, before.get(field)),
            _display_value(field, after.get(field)),
        ))
    route_steps = []
    if "steps" in supplied_after:
        route_steps = _route_step_details(
            before.get("steps") or [], supplied_after.get("steps") or [],
        )
    if not changed and not route_steps:
        changed.append((
            "历史审批明细",
            "原资料已记录",
            "未保存具体变更内容",
        ))
    return subject_name, subject_code, changed, route_steps


def _previous_week(now):
    current = now.date()
    this_monday = current - timedelta(days=current.weekday())
    start = this_monday - timedelta(days=7)
    end = this_monday - timedelta(days=1)
    return start, end


def _as_datetime(value):
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _weekly_workbook(rows, now):
    rows = list(rows)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "全部审批变更"
    headers = [
        "审批时间", "审批单号", "资料类型", "操作类型", "对象编码", "对象名称",
        "变更项目", "修改前", "修改后", "变更类型", "申请人", "申请时间", "审批人", "审批意见",
    ]
    review_times = [
        value for value in (_as_datetime(row.get("review_time")) for row in rows)
        if value is not None
    ]
    range_start = min(review_times).strftime("%Y-%m-%d %H:%M") if review_times else "-"
    range_end = now.strftime("%Y-%m-%d %H:%M")
    sheet.append([
        f"数据范围：{range_start} 至 {range_end}（共 {len(rows)} 张审批单）",
        "", "", "", "", "", "图例", "新增", "修改", "调整", "删除", "保留", "", "",
    ])
    sheet.merge_cells("A1:F1")
    sheet.append(headers)
    start, end = _previous_week(now)
    highlighted = 0
    for row in rows:
        name, code, changes, route_steps = _approval_details(row)
        review_time = _as_datetime(row.get("review_time"))
        output_changes = [
            (
                label,
                before,
                after,
                "历史明细缺失" if label == "历史审批明细" else (
                    "新增" if row.get("action_type") == "create" else "修改"
                ),
            )
            for label, before, after in changes
        ]
        output_changes.extend((
            f"第{step['seq']}步",
            f"工序：{step['before_process']}\n工站：{step['before_station']}",
            f"工序：{step['after_process']}\n工站：{step['after_station']}",
            step["change_type"],
        ) for step in route_steps)
        is_previous_week = bool(
            review_time and start <= review_time.date() <= end
        )
        if is_previous_week:
            highlighted += 1
        group_start = sheet.max_row + 1
        for label, before_value, after_value, change_type in output_changes:
            sheet.append([
                str(row.get("review_time") or ""), row.get("request_no") or "",
                MODULE_NAMES.get(row.get("module_type"), row.get("module_type") or ""),
                ACTION_NAMES.get(row.get("action_type"), row.get("action_type") or ""),
                code, name, label, before_value, after_value, change_type,
                row.get("applicant_name") or "", str(row.get("apply_time") or ""),
                row.get("reviewer_name") or "", row.get("review_comment") or "",
            ])
            excel_row = sheet.max_row
            if is_previous_week:
                for cell in sheet[excel_row]:
                    cell.fill = PatternFill("solid", fgColor="FFF2CC")
            for cell in sheet[excel_row]:
                cell.alignment = Alignment(vertical="top", wrap_text=True)
            style = CHANGE_STYLES.get(change_type, CHANGE_STYLES["修改"])
            for cell in sheet[excel_row][6:10]:
                cell.fill = PatternFill("solid", fgColor=style["fill"])
                cell.font = Font(
                    name="微软雅黑",
                    color=style["font"],
                    bold=change_type != "保留",
                )
            sheet.cell(excel_row, 10).alignment = Alignment(
                vertical="center", horizontal="center",
            )
            if change_type == "删除":
                sheet.cell(excel_row, 8).font = Font(
                    name="微软雅黑", color=style["font"], bold=True,
                    strike=True,
                )
            if change_type != "保留":
                accent = Side(style="medium", color=style["font"])
                sheet.cell(excel_row, 7).border = Border(left=accent)
        group_end = sheet.max_row
        if group_end > group_start:
            for column in (*range(1, 7), *range(11, 15)):
                sheet.merge_cells(
                    start_row=group_start,
                    start_column=column,
                    end_row=group_end,
                    end_column=column,
                )
                sheet.cell(group_start, column).alignment = Alignment(
                    vertical="top",
                    horizontal="center" if column in {1, 2, 3, 4, 11, 13} else "left",
                    wrap_text=True,
                )
        group_color = "9FBAD0"
        for column in range(1, 15):
            top_cell = sheet.cell(group_start, column)
            bottom_cell = sheet.cell(group_end, column)
            top_cell.border = Border(
                left=top_cell.border.left,
                right=top_cell.border.right,
                top=Side(style="medium", color=group_color),
                bottom=top_cell.border.bottom,
            )
            bottom_cell.border = Border(
                left=bottom_cell.border.left,
                right=bottom_cell.border.right,
                top=bottom_cell.border.top,
                bottom=Side(style="thin", color=group_color),
            )
    summary_cell = sheet["A1"]
    summary_cell.fill = PatternFill("solid", fgColor="EAF2F8")
    summary_cell.font = Font(name="微软雅黑", bold=True, color="17365D")
    summary_cell.alignment = Alignment(vertical="center", horizontal="left")
    sheet["G1"].fill = PatternFill("solid", fgColor="D9EAF7")
    sheet["G1"].font = Font(name="微软雅黑", bold=True, color="17365D")
    sheet["G1"].alignment = Alignment(vertical="center", horizontal="center")
    for column, change_type in zip(
        range(8, 13), ("新增", "修改", "调整", "删除", "保留")
    ):
        style = CHANGE_STYLES[change_type]
        cell = sheet.cell(1, column)
        cell.fill = PatternFill("solid", fgColor=style["fill"])
        cell.font = Font(name="微软雅黑", bold=True, color=style["font"])
        cell.alignment = Alignment(vertical="center", horizontal="center")
    sheet.row_dimensions[1].height = 24
    for cell in sheet[2]:
        cell.fill = PatternFill("solid", fgColor="D9EAF7")
        cell.font = Font(name="微软雅黑", bold=True, color="17365D")
        cell.alignment = Alignment(vertical="center", horizontal="center")
    widths = [20, 18, 14, 12, 20, 26, 16, 30, 30, 12, 14, 20, 14, 28]
    for index, width in enumerate(widths, 1):
        sheet.column_dimensions[get_column_letter(index)].width = width
    sheet.freeze_panes = "A3"
    sheet.auto_filter.ref = f"A2:N{sheet.max_row}"
    output = BytesIO()
    workbook.save(output)
    filename = f"审批变更全量清单_{now.strftime('%Y%m%d_%H%M%S')}.xlsx"
    return filename, output.getvalue(), highlighted


def _addresses(value):
    return [item.strip() for item in str(value or "").split(";") if item.strip()]


def _email_text(body, field, label, required=False):
    value = body.get(field)
    if value is None:
        value = ""
    if not isinstance(value, str) or len(value) > 4000:
        raise ValueError(f"{label}格式无效")
    values = [item.strip() for item in value.replace("；", ";").replace("，", ",").replace(",", ";").split(";") if item.strip()]
    if required and not values:
        raise ValueError(f"请填写{label}")
    if any(not EMAIL_PATTERN.fullmatch(item) for item in values):
        raise ValueError(f"{label}中存在无效邮箱")
    return ";".join(dict.fromkeys(values))


def _setting_payload(row, deliveries=None):
    deliveries = deliveries or {}
    return {
        "instant_enabled": bool(row.get("instant_enabled", 0)) if row else False,
        "weekly_enabled": bool(row.get("weekly_enabled", 0)) if row else False,
        "weekly_day": int(row.get("weekly_day") or 1) if row else 1,
        "weekly_time": send_time_text(row.get("weekly_time")) if row else "08:10",
        "to_recipients": row.get("to_recipients", "yuanxin@goldenchameleon.cn") if row else "yuanxin@goldenchameleon.cn",
        "cc_recipients": row.get("cc_recipients", "") if row else "",
        "bcc_recipients": row.get("bcc_recipients", "") if row else "",
        "revision": int(row.get("revision") or 0) if row else 0,
        "updated_by": row.get("updated_by") if row else None,
        "update_time": str(row.get("update_time")) if row and row.get("update_time") else None,
        "last_approval_send": deliveries.get("approval"),
        "last_weekly_send": deliveries.get("weekly"),
    }


def _read_smtp_and_setting(database):
    conn = database()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT * FROM mo_report_email_setting_yx WHERE id=1")
        smtp = cur.fetchone()
        cur.execute("SELECT * FROM mo_approval_email_setting_yx WHERE id=1")
        setting = cur.fetchone()
        return smtp, setting
    finally:
        cur.close()
        conn.close()


def _read_approvals(database, approval_id=None, latest=False):
    conn = database()
    cur = conn.cursor(dictionary=True)
    try:
        where = "status='approved'"
        params = []
        if approval_id is not None:
            where += " AND id=%s"
            params.append(approval_id)
        limit = " LIMIT 1" if latest or approval_id is not None else ""
        cur.execute(f"""SELECT id,request_no,module_type,action_type,target_key,
            before_data,after_data,applicant_name,reviewer_name,review_comment,
            apply_time,review_time FROM mo_config_approval_yx
            WHERE {where} ORDER BY review_time DESC,id DESC{limit}""", tuple(params))
        rows = cur.fetchall()
        process_ids = set()
        station_ids = set()
        for row in rows:
            for field in ("before_data", "after_data"):
                data = _json_object(row.get(field))
                row[field] = data
                for step in data.get("steps") or []:
                    if step.get("process_id"):
                        process_ids.add(step["process_id"])
                    if step.get("station_id"):
                        station_ids.add(step["station_id"])
        process_names = {}
        station_names = {}
        if process_ids:
            placeholders = ",".join(["%s"] * len(process_ids))
            cur.execute(
                f"SELECT id,process_name FROM mo_process_yx WHERE id IN ({placeholders})",
                tuple(process_ids),
            )
            process_names = {item["id"]: item["process_name"] for item in cur.fetchall()}
        if station_ids:
            placeholders = ",".join(["%s"] * len(station_ids))
            cur.execute(
                f"SELECT id,station_name FROM mo_workstation_yx WHERE id IN ({placeholders})",
                tuple(station_ids),
            )
            station_names = {item["id"]: item["station_name"] for item in cur.fetchall()}
        for row in rows:
            for field in ("before_data", "after_data"):
                for step in row[field].get("steps") or []:
                    step.setdefault("process_name", process_names.get(step.get("process_id")))
                    step.setdefault("station_name", station_names.get(step.get("station_id")))
        return rows
    finally:
        cur.close()
        conn.close()


def _send_message(database, secret_key, setting, subject, text_body, html_body, attachment=None):
    smtp, _ = _read_smtp_and_setting(database)
    if not smtp or not smtp.get("smtp_password_ciphertext"):
        raise ValueError("请先完成邮件服务配置")
    to = _addresses(setting.get("to_recipients"))
    cc = _addresses(setting.get("cc_recipients"))
    bcc = _addresses(setting.get("bcc_recipients"))
    if not to:
        raise ValueError("请先配置收件人")
    message = EmailMessage()
    message["From"] = smtp["smtp_user"]
    message["To"] = ", ".join(to)
    if cc:
        message["Cc"] = ", ".join(cc)
    message["Subject"] = subject
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")
    if attachment:
        filename, content = attachment
        message.add_attachment(
            content,
            maintype="application",
            subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename,
        )
    password = decrypt_smtp_password(smtp["smtp_password_ciphertext"], secret_key)
    client_type = smtplib.SMTP_SSL if smtp.get("smtp_use_ssl") else smtplib.SMTP
    with client_type(smtp["smtp_server"], int(smtp["smtp_port"]), timeout=30) as client:
        client.login(smtp["smtp_user"], password)
        client.send_message(message, to_addrs=to + cc + bcc)
    return datetime.now()


def _approval_message(row):
    name, code, changes, route_steps = _approval_details(row)
    module = MODULE_NAMES.get(row.get("module_type"), row.get("module_type") or "")
    action = ACTION_NAMES.get(row.get("action_type"), row.get("action_type") or "")
    subject = f"[审批通过] {module} · {name} · {row.get('request_no') or ''}"
    change_text = "\n".join(f"{label}：{before} → {after}" for label, before, after in changes)
    step_text = "\n".join(
        f"第{step['seq']}步 [{step['change_type']}] "
        f"{step['before_process']} / {step['before_station']} → "
        f"{step['after_process']} / {step['after_station']}"
        for step in route_steps
    )
    text = (
        f"审批单号：{row.get('request_no') or '-'}\n资料类型：{module}\n操作类型：{action}\n"
        f"对象编码：{code or '-'}\n对象名称：{name}\n申请人：{row.get('applicant_name') or '-'}\n"
        f"审批人：{row.get('reviewer_name') or '-'}\n生效时间：{row.get('review_time') or '-'}\n"
        f"审批意见：{row.get('review_comment') or '无'}"
    )
    if change_text:
        text += f"\n\n基础信息变更：\n{change_text}"
    if step_text:
        text += f"\n\n工艺步骤：\n{step_text}"
    change_rows = "".join(
        f"<tr><td style='padding:9px;border:1px solid #d8e0ec'>{html.escape(label)}</td>"
        f"<td style='padding:9px;border:1px solid #d8e0ec'>{html.escape(before)}</td>"
        f"<td style='padding:9px;border:1px solid #d8e0ec'>{html.escape(after)}</td></tr>"
        for label, before, after in changes
    )
    change_table = ""
    if change_rows:
        change_table = f"""
          <h3 style="margin:22px 0 10px;font-size:16px">基础信息变更</h3>
          <table style="width:100%;border-collapse:collapse;table-layout:fixed">
            <thead><tr style="background:#d9eaf7;color:#17365d"><th style="width:20%;padding:9px;border:1px solid #d8e0ec">变更项目</th><th style="width:40%;padding:9px;border:1px solid #d8e0ec">修改前</th><th style="width:40%;padding:9px;border:1px solid #d8e0ec">修改后</th></tr></thead>
            <tbody>{change_rows}</tbody>
          </table>"""
    step_rows = "".join(
        f"<tr style=\"background:{'#fff7e6' if step['change_type'] != '保留' else '#ffffff'}\">"
        f"<td style='padding:8px;border:1px solid #d8e0ec;text-align:center'>{step['seq']}</td>"
        f"<td style='padding:8px;border:1px solid #d8e0ec'>{html.escape(step['before_process'])}</td>"
        f"<td style='padding:8px;border:1px solid #d8e0ec'>{html.escape(step['before_station'])}</td>"
        f"<td style='padding:8px;border:1px solid #d8e0ec'>{html.escape(step['after_process'])}</td>"
        f"<td style='padding:8px;border:1px solid #d8e0ec'>{html.escape(step['after_station'])}</td>"
        f"<td style='padding:8px;border:1px solid #d8e0ec;text-align:center;font-weight:bold'>{step['change_type']}</td>"
        "</tr>"
        for step in route_steps
    )
    step_table = ""
    if step_rows:
        step_table = f"""
          <h3 style="margin:22px 0 10px;font-size:16px">工艺步骤对照</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:#d9eaf7;color:#17365d">
              <th style="padding:8px;border:1px solid #d8e0ec">步骤</th>
              <th style="padding:8px;border:1px solid #d8e0ec">修改前工序</th>
              <th style="padding:8px;border:1px solid #d8e0ec">修改前工站</th>
              <th style="padding:8px;border:1px solid #d8e0ec">修改后工序</th>
              <th style="padding:8px;border:1px solid #d8e0ec">修改后工站</th>
              <th style="padding:8px;border:1px solid #d8e0ec">结果</th>
            </tr></thead><tbody>{step_rows}</tbody>
          </table>
          <p style="margin:8px 0 0;color:#8a6d3b;font-size:12px">浅黄色表示本次新增、调整或删除的步骤。</p>"""
    content = f"""<!doctype html><html><body style="font-family:Microsoft YaHei,Arial;color:#18283b">
      <div style="max-width:900px;margin:auto;border:1px solid #e8edf5;border-radius:10px;overflow:hidden">
        <div style="padding:18px 22px;background:#edf3ff"><h2 style="margin:0;font-size:20px">审批已通过</h2></div>
        <div style="padding:20px 22px">
          <table style="width:100%;border-collapse:collapse;background:#f8fafc">
            <tr><td style="width:120px;padding:7px 10px;color:#667085">审批单号</td><td style="padding:7px 10px"><b>{html.escape(str(row.get('request_no') or '-'))}</b></td><td style="width:120px;padding:7px 10px;color:#667085">生效时间</td><td style="padding:7px 10px">{html.escape(str(row.get('review_time') or '-'))}</td></tr>
            <tr><td style="padding:7px 10px;color:#667085">资料类型</td><td style="padding:7px 10px">{html.escape(module)}</td><td style="padding:7px 10px;color:#667085">操作类型</td><td style="padding:7px 10px">{html.escape(action)}</td></tr>
            <tr><td style="padding:7px 10px;color:#667085">对象编码</td><td style="padding:7px 10px">{html.escape(code or '-')}</td><td style="padding:7px 10px;color:#667085">对象名称</td><td style="padding:7px 10px">{html.escape(name)}</td></tr>
            <tr><td style="padding:7px 10px;color:#667085">申请人</td><td style="padding:7px 10px">{html.escape(str(row.get('applicant_name') or '-'))}</td><td style="padding:7px 10px;color:#667085">审批人</td><td style="padding:7px 10px">{html.escape(str(row.get('reviewer_name') or '-'))}</td></tr>
            <tr><td style="padding:7px 10px;color:#667085">审批意见</td><td colspan="3" style="padding:7px 10px">{html.escape(str(row.get('review_comment') or '无'))}</td></tr>
          </table>
          {change_table}
          {step_table}
        </div>
      </div></body></html>"""
    return subject, text, content


def _weekly_message(rows, now):
    filename, content, highlighted = _weekly_workbook(rows, now)
    start, end = _previous_week(now)
    subject = f"[审批变更清单] 截至 {now.strftime('%Y-%m-%d')} · 共{len(rows)}条"
    text = (
        f"附件为截至{now.strftime('%Y-%m-%d %H:%M')}的全部已生效审批变更，"
        f"共{len(rows)}条。\n上一自然周（{start} 至 {end}）共{highlighted}条，已在Excel中用浅黄色标记。"
    )
    html_body = f"""<!doctype html><html><body style="font-family:Microsoft YaHei,Arial;color:#18283b">
      <div style="max-width:680px;margin:auto;border:1px solid #e8edf5;border-radius:10px;padding:22px">
        <h2 style="margin-top:0">审批变更全量清单</h2>
        <p>截至 {now.strftime('%Y-%m-%d %H:%M')}，共 <b>{len(rows)}</b> 条已生效变更。</p>
        <p>上一自然周（{start} 至 {end}）共 <b>{highlighted}</b> 条，附件中已用<span style="background:#fff2cc;padding:2px 6px">浅黄色</span>整行标记。</p>
        <p style="color:#7a8497">清单按审批时间倒序排列，最新记录在最上方。</p>
      </div></body></html>"""
    return subject, text, html_body, (filename, content), highlighted


def _start_delivery(database, mail_type, approval_id, recipients, subject, requested_by, delivery_key=None):
    conn = database()
    cur = conn.cursor()
    try:
        key = delivery_key or f"manual:{mail_type}:{uuid.uuid4().hex}"
        cur.execute("""INSERT INTO mo_approval_email_delivery_yx
            (delivery_key,mail_type,approval_id,status,recipients,subject,attempts,requested_by)
            VALUES (%s,%s,%s,'sending',%s,%s,1,%s)""", (
            key, mail_type, approval_id, recipients, subject, requested_by,
        ))
        delivery_id = cur.lastrowid
        conn.commit()
        return delivery_id
    finally:
        cur.close()
        conn.close()


def _finish_delivery(database, delivery_id, status, error="", sent_time=None):
    conn = database()
    cur = conn.cursor()
    try:
        cur.execute("""UPDATE mo_approval_email_delivery_yx
            SET status=%s,last_error=%s,sent_time=%s WHERE id=%s""", (
            status, error[:500], sent_time, delivery_id,
        ))
        conn.commit()
    finally:
        cur.close()
        conn.close()


def _send_manual_approval(database, secret_key, setting, row, requested_by):
    subject, text, html_body = _approval_message(row)
    delivery_id = _start_delivery(
        database, "approval_manual", row["id"], setting.get("to_recipients", ""),
        subject, requested_by,
    )
    try:
        sent_at = _send_message(database, secret_key, setting, subject, text, html_body)
        _finish_delivery(database, delivery_id, "success", sent_time=sent_at)
        return sent_at
    except Exception as error:
        _finish_delivery(database, delivery_id, "failed", str(error))
        raise


def _send_manual_weekly(database, secret_key, setting, rows, requested_by, now=None):
    current = now or datetime.now()
    subject, text, html_body, attachment, highlighted = _weekly_message(rows, current)
    delivery_id = _start_delivery(
        database, "weekly_manual", None, setting.get("to_recipients", ""),
        subject, requested_by,
    )
    try:
        sent_at = _send_message(
            database, secret_key, setting, subject, text, html_body, attachment,
        )
        _finish_delivery(database, delivery_id, "success", sent_time=sent_at)
        return sent_at, highlighted
    except Exception as error:
        _finish_delivery(database, delivery_id, "failed", str(error))
        raise


def enqueue_approval_email(cur, approval_id):
    cur.execute("SELECT instant_enabled FROM mo_approval_email_setting_yx WHERE id=1")
    setting = cur.fetchone()
    if not setting or not setting.get("instant_enabled"):
        return False
    cur.execute("""INSERT IGNORE INTO mo_approval_email_delivery_yx
        (delivery_key,mail_type,approval_id,status,recipients,requested_by)
        SELECT %s,'approval',%s,'pending',to_recipients,'system'
        FROM mo_approval_email_setting_yx WHERE id=1""", (
        f"approval:{approval_id}", approval_id,
    ))
    return cur.rowcount == 1


def _claim_delivery(database, delivery_id):
    conn = database()
    cur = conn.cursor()
    try:
        cur.execute("""UPDATE mo_approval_email_delivery_yx
            SET status='sending',attempts=attempts+1,last_error=''
            WHERE id=%s AND status IN ('pending','failed') AND attempts<3""", (delivery_id,))
        claimed = cur.rowcount == 1
        conn.commit()
        return claimed
    finally:
        cur.close()
        conn.close()


def _pending_deliveries(database):
    conn = database()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""SELECT id,mail_type,approval_id FROM mo_approval_email_delivery_yx
            WHERE mail_type IN ('approval','weekly')
              AND status IN ('pending','failed') AND attempts<3
            ORDER BY id LIMIT 20""")
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def _queue_due_weekly(database, now):
    conn = database()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT * FROM mo_approval_email_setting_yx WHERE id=1")
        setting = cur.fetchone()
        if (
            not setting or not setting.get("weekly_enabled")
            or int(setting.get("weekly_day") or 1) != now.isoweekday()
            or send_time_text(setting.get("weekly_time")) != now.strftime("%H:%M")
        ):
            return
        slot = now.strftime("weekly:%G-%V")
        cur.execute("""INSERT IGNORE INTO mo_approval_email_delivery_yx
            (delivery_key,mail_type,status,recipients,requested_by)
            VALUES (%s,'weekly','pending',%s,'system')""", (
            slot, setting.get("to_recipients") or "",
        ))
        conn.commit()
    finally:
        cur.close()
        conn.close()


def run_due_approval_emails(database, secret_key, now=None):
    current = now or datetime.now()
    _queue_due_weekly(database, current)
    _, setting = _read_smtp_and_setting(database)
    if not setting:
        return
    for delivery in _pending_deliveries(database):
        if not _claim_delivery(database, delivery["id"]):
            continue
        try:
            if delivery["mail_type"] == "approval":
                rows = _read_approvals(database, approval_id=delivery["approval_id"])
                if not rows:
                    raise ValueError("审批记录不存在或未通过")
                subject, text, html_body = _approval_message(rows[0])
                attachment = None
            else:
                rows = _read_approvals(database)
                subject, text, html_body, attachment, _ = _weekly_message(rows, current)
            sent_at = _send_message(
                database, secret_key, setting, subject, text, html_body, attachment,
            )
            _finish_delivery(database, delivery["id"], "success", sent_time=sent_at)
        except Exception as error:
            _finish_delivery(database, delivery["id"], "failed", str(error))
            current_app.logger.error("approval email delivery failed: %s", error)


def _audit(cur, action, data):
    cur.execute("""INSERT INTO mo_admin_audit_log_yx
        (username,action_name,request_method,request_path,target_id,
         request_data,result_code,result_message,ip_address)
        VALUES (%s,%s,%s,%s,%s,%s,0,'',%s)""", (
        g.audit_username, action, request.method, request.path,
        str(data.get("approval_id") or 1), json.dumps(data, ensure_ascii=False),
        request.remote_addr or "",
    ))


def approval_email_blueprint(database, secret_key):
    bp = Blueprint("approval_email", __name__)

    @bp.get("/api/admin/basic-settings/approval-email")
    def get_settings():
        conn = database()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("SELECT * FROM mo_approval_email_setting_yx WHERE id=1")
            setting = cur.fetchone()
            cur.execute("""SELECT mail_type,status,sent_time,last_error,subject
                FROM mo_approval_email_delivery_yx
                ORDER BY id DESC LIMIT 30""")
            deliveries = {}
            for item in cur.fetchall():
                key = "weekly" if item["mail_type"].startswith("weekly") else "approval"
                if key not in deliveries:
                    deliveries[key] = {
                        "status": item.get("status"),
                        "sent_time": str(item.get("sent_time")) if item.get("sent_time") else None,
                        "last_error": item.get("last_error"),
                        "subject": item.get("subject"),
                    }
            return jsonify({"code": 0, "data": _setting_payload(setting, deliveries)})
        except Exception:
            return jsonify({"code": 503, "msg": "审批邮件配置暂不可用"}), 503
        finally:
            cur.close()
            conn.close()

    @bp.post("/api/admin/basic-settings/approval-email/save")
    def save_settings():
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"code": 400, "msg": "请求内容必须是对象"}), 400
        try:
            instant = body.get("instant_enabled")
            weekly = body.get("weekly_enabled")
            if instant not in (True, False, 0, 1) or weekly not in (True, False, 0, 1):
                raise ValueError("发送开关无效")
            weekly_day = body.get("weekly_day")
            if isinstance(weekly_day, bool) or not isinstance(weekly_day, int) or not 1 <= weekly_day <= 7:
                raise ValueError("每周发送日期无效")
            weekly_time = body.get("weekly_time")
            if not isinstance(weekly_time, str) or len(weekly_time) != 5 or weekly_time[2] != ":":
                raise ValueError("每周发送时间无效")
            hour, minute = (int(value) for value in weekly_time.split(":"))
            if not 0 <= hour <= 23 or not 0 <= minute <= 59:
                raise ValueError("每周发送时间无效")
            to = _email_text(body, "to_recipients", "收件人", required=True)
            cc = _email_text(body, "cc_recipients", "抄送人")
            bcc = _email_text(body, "bcc_recipients", "密送人")
            revision = body.get("revision")
            if isinstance(revision, bool) or not isinstance(revision, int) or revision < 0:
                raise ValueError("配置版本无效")
        except (TypeError, ValueError) as error:
            return jsonify({"code": 400, "msg": str(error)}), 400
        conn = database()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("SELECT * FROM mo_approval_email_setting_yx WHERE id=1 FOR UPDATE")
            before = cur.fetchone()
            current_revision = int(before.get("revision") or 0) if before else 0
            if revision != current_revision:
                raise ValueError("审批邮件配置已变化，请刷新后重试")
            next_revision = current_revision + 1
            values = (
                int(bool(instant)), int(bool(weekly)), weekly_day, weekly_time,
                to, cc, bcc, next_revision, g.audit_username,
            )
            if before:
                cur.execute("""UPDATE mo_approval_email_setting_yx SET
                    instant_enabled=%s,weekly_enabled=%s,weekly_day=%s,weekly_time=%s,
                    to_recipients=%s,cc_recipients=%s,bcc_recipients=%s,
                    revision=%s,updated_by=%s WHERE id=1""", values)
            else:
                cur.execute("""INSERT INTO mo_approval_email_setting_yx
                    (id,instant_enabled,weekly_enabled,weekly_day,weekly_time,
                     to_recipients,cc_recipients,bcc_recipients,revision,updated_by)
                    VALUES (1,%s,%s,%s,%s,%s,%s,%s,%s,%s)""", values)
            saved = {
                "instant_enabled": bool(instant), "weekly_enabled": bool(weekly),
                "weekly_day": weekly_day, "weekly_time": weekly_time,
                "to_recipients": to, "cc_recipients": cc, "bcc_recipients": bcc,
                "revision": next_revision, "updated_by": g.audit_username,
            }
            _audit(cur, "修改审批邮件配置", saved)
            conn.commit()
            return jsonify({"code": 0, "data": _setting_payload(saved)})
        except ValueError as error:
            conn.rollback()
            return jsonify({"code": 400, "msg": str(error)}), 400
        except Exception:
            conn.rollback()
            return jsonify({"code": 503, "msg": "审批邮件配置保存失败"}), 503
        finally:
            cur.close()
            conn.close()

    @bp.post("/api/admin/basic-settings/approval-email/send-latest")
    def send_latest():
        try:
            _, setting = _read_smtp_and_setting(database)
            if not setting:
                raise ValueError("请先保存审批邮件配置")
            rows = _read_approvals(database, latest=True)
            if not rows:
                raise ValueError("暂无已通过的审批记录")
            sent_at = _send_manual_approval(
                database, secret_key, setting, rows[0], g.audit_username,
            )
            conn = database()
            cur = conn.cursor(dictionary=True)
            try:
                _audit(cur, "手动发送最近审批邮件", {"approval_id": rows[0]["id"]})
                conn.commit()
            finally:
                cur.close()
                conn.close()
            return jsonify({"code": 0, "data": {
                "request_no": rows[0].get("request_no"),
                "sent_at": sent_at.strftime("%Y-%m-%d %H:%M:%S"),
            }})
        except ValueError as error:
            return jsonify({"code": 400, "msg": str(error)}), 400
        except Exception:
            current_app.logger.exception("manual latest approval email failed")
            return jsonify({"code": 503, "msg": "最近审批邮件发送失败"}), 503

    @bp.post("/api/admin/basic-settings/approval-email/send-weekly")
    def send_weekly():
        try:
            _, setting = _read_smtp_and_setting(database)
            if not setting:
                raise ValueError("请先保存审批邮件配置")
            rows = _read_approvals(database)
            sent_at, highlighted = _send_manual_weekly(
                database, secret_key, setting, rows, g.audit_username,
            )
            conn = database()
            cur = conn.cursor(dictionary=True)
            try:
                _audit(cur, "手动发送审批每周清单", {"total": len(rows)})
                conn.commit()
            finally:
                cur.close()
                conn.close()
            return jsonify({"code": 0, "data": {
                "total": len(rows), "highlighted": highlighted,
                "sent_at": sent_at.strftime("%Y-%m-%d %H:%M:%S"),
            }})
        except ValueError as error:
            return jsonify({"code": 400, "msg": str(error)}), 400
        except Exception:
            current_app.logger.exception("manual weekly approval email failed")
            return jsonify({"code": 503, "msg": "审批每周清单发送失败"}), 503

    return bp
