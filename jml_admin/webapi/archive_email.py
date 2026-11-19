from datetime import datetime
from zoneinfo import ZoneInfo

from flask import Blueprint, current_app, g, jsonify, request

from admin_permissions import can_view_material_coding
from report_email_sender import _render, send_configured_report
from report_email_settings import _audit, _emails

ARCHIVES = {
    'archive-process': ('工艺档案',
        '随信附上截至 {datetime}（北京时间）的《工艺档案》。请查阅附件，核对现场使用的工艺资料。\n\n'
        '如发现资料需要更新，请回复本邮件并注明涉及的路线、工站或工序。'),
    'archive-material-coding': ('物料编码规则',
        '随信附上截至 {datetime}（北京时间）的《物料编码规则》。新增物料或核对现有编码时，请查阅附件中的编码规则和明细。\n\n'
        '如发现编码或资料有差异，请回复本邮件并注明物料类别和编码。'),
}
MAIL_CATALOG = tuple((key, name) for key, (name, _) in ARCHIVES.items())
SUBJECT = '【生产档案】{report_name} · {date}'
RECIPIENTS = (('to_recipients', '收件人'), ('cc_recipients', '抄送人'), ('bcc_recipients', '密送人'))


def _body(key):
    return f'各位同事，大家好！\n\n{ARCHIVES[key][1]}\n\n谢谢。'


def _now():
    return datetime.now(ZoneInfo('Asia/Shanghai')).replace(tzinfo=None)


def _can_view(key):
    if key == 'archive-process':
        return any(f'{part}.view' in g.admin_permissions and part not in g.disabled_pages
                   for part in ('route', 'workstation', 'process'))
    return can_view_material_coding(g.admin_permissions, g.disabled_pages)


def _saved_config(cur, key, *, lock=False):
    query = 'SELECT * FROM mo_report_delivery_setting_yx WHERE report_key=%s'
    cur.execute(query + (' FOR UPDATE' if lock else ''), (key,))
    return cur.fetchone() or {}


def _payload(key, row):
    now = _now()
    name = ARCHIVES[key][0]
    return {
        **{field: row.get(field, '') for field, _ in RECIPIENTS},
        'revision': row.get('revision', 0),
        'subject': _render(row.get('email_subject', SUBJECT), name, now),
        'body': _render(row.get('email_body', _body(key)), name, now),
    }


def archive_email_blueprint(database, secret_key, build_attachment):
    bp = Blueprint('archive_email', __name__)

    @bp.get('/api/admin/archive-email')
    @bp.post('/api/admin/archive-email/save')
    @bp.post('/api/admin/archive-email/send')
    def archive_email():
        reading = request.method == 'GET'
        body = request.args if reading else request.get_json(silent=True)
        key = body.get('archive') if reading or isinstance(body, dict) else None
        if not isinstance(key, str) or key not in ARCHIVES:
            return jsonify({'code': 400, 'msg': '请选择档案'}), 400
        if not _can_view(key):
            return jsonify({'code': 403, 'msg': '当前账号没有档案查看权限'}), 403
        action = request.path.rsplit('/', 1)[-1]
        try:
            if reading:
                with database() as conn, conn.cursor(dictionary=True) as cur:
                    return jsonify({'success': True, 'code': 0, 'data': _payload(key, _saved_config(cur, key))})
            revision = body.get('revision')
            if type(revision) is not int or revision < 0:
                raise ValueError('请重新打开邮件发送确认')
            if action == 'send':
                if not revision:
                    raise ValueError('请先保存收件人')
                sent_at = send_configured_report(
                    database, secret_key, build_attachment, key, catalog=MAIL_CATALOG,
                    expected_revision=revision, now=_now(),
                )
                try:
                    with database() as conn, conn.cursor() as cur:
                        _audit(cur, '手动发送档案邮件', {'report_key': key, 'sent_at': sent_at})
                        conn.commit()
                except Exception:
                    current_app.logger.exception('Archive email delivery audit failed')
                return jsonify({'success': True, 'code': 0, 'data': {'sent_at': sent_at}})

            recipients = {field: _emails(body, field, label) for field, label in RECIPIENTS}
            with database() as conn, conn.cursor(dictionary=True) as cur:
                row = _saved_config(cur, key, lock=True)
                if revision != row.get('revision', 0):
                    return jsonify({'code': 409, 'msg': '收件人已变更，请重新打开邮件发送确认'}), 409
                revision += 1
                values = (*recipients.values(), SUBJECT, _body(key), revision, g.audit_username, key)
                if row:
                    cur.execute("""UPDATE mo_report_delivery_setting_yx
                        SET to_recipients=%s,cc_recipients=%s,bcc_recipients=%s,email_subject=%s,email_body=%s,
                            revision=%s,updated_by=%s,send_mode='manual',is_enabled=1 WHERE report_key=%s""", values)
                else:
                    cur.execute("""INSERT INTO mo_report_delivery_setting_yx
                        (to_recipients,cc_recipients,bcc_recipients,email_subject,email_body,
                         revision,updated_by,report_key,send_mode,is_enabled)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'manual',1)""", values)
                _audit(cur, '维护档案邮件收件人', {'report_key': key, 'revision': revision})
                conn.commit()
            data = _payload(key, {**recipients, 'revision': revision})
            return jsonify({'success': True, 'code': 0, 'data': data})
        except ValueError as error:
            return jsonify({'code': 400, 'msg': str(error)}), 400
        except Exception:
            current_app.logger.exception('Archive email %s failed for %s', action, key)
            message = '档案邮件发送失败' if action == 'send' else '档案邮件配置暂不可用'
            return jsonify({'code': 503, 'msg': message}), 503

    return bp
