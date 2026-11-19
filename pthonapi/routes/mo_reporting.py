"""Completion batches visible under the existing employee/station policy."""
from datetime import date, datetime, timedelta
import json
import logging
from zoneinfo import ZoneInfo

from flask import Blueprint, jsonify, request, g, make_response
from services.mo_station_access import AccessError, staff_from_cache, business_db, policy, positive_id, DeferredConnection

mo_reporting_bp = Blueprint('mo_reporting', __name__)
logger = logging.getLogger(__name__)


def report_access_allowed(scope):
    """Keep page rollout separate from the data scope inside the report."""
    mode = scope.get('report_access_mode', 'exempt')
    if mode == 'all':
        return True
    if mode == 'station':
        return scope.get('kind') in ('all', 'station')
    return scope.get('kind') == 'all'


def view_scope(cur, staff_id):
    access = policy(cur, staff_id)
    if access['enabled'] and access['exempt']:
        kind, label = 'all', '全部工站'
    elif access['enabled'] and access['allowed']:
        kind, label = 'station', '我负责的工站' if access['leader'] else '我的工站'
    else:
        kind, label = 'self', '我提交的'
    return {'kind': kind, 'label': label, 'station_ids': sorted(access['allowed']) if kind != 'self' else [],
            'report_access_mode': access.get('report_access_mode', 'exempt'),
            'stations': [{'id': key, 'name': name} for key, name in access['stations'].items()
                         if kind == 'all' or (kind == 'station' and key in access['allowed'])]}


def visibility(scope, staff_id):
    if scope['kind'] == 'all':
        return '1=1', []
    if scope['kind'] == 'station':
        ids = scope['station_ids']
        return 'e.station_id IN (' + ','.join(['%s'] * len(ids)) + ')', ids
    return 'c.operator_id=%s', [staff_id]


def batch_sql(visible='c.operator_id=%s', dated=True):
    # Never turn execution counters into fabricated completion batches.
    return """
        SELECT 'completion' AS source_type,'normal' AS kind,c.id AS source_id,
               e.id AS execution_id,e.mo_code,e.sort_seq,e.seq,e.process_name,
               e.start_time,c.complete_time,c.qty_done,c.qty_a,c.qty_a1,c.qty_a2,c.qty_c,
               c.reason,c.photo_url,c.quality_report_photo_urls,c.operator_id,
               NULL AS rework_id,e.station_id,e.station_name,c.is_final,
               (SELECT COUNT(*) FROM mo_execution_completion_yx prev_batch
                WHERE prev_batch.execution_id=e.id AND prev_batch.id<=c.id) AS batch_index
        FROM mo_execution_completion_yx c JOIN mo_execution_yx e ON e.id=c.execution_id
        WHERE {visible} {dates}
        UNION ALL
        SELECT 'rework_completion','rework',c.id,e.id,e.mo_code,e.sort_seq,e.seq,
               e.process_name,r.start_time,c.complete_time,c.qty_done,
               c.qty_a,c.qty_a1,c.qty_a2,c.qty_c,c.remark,c.photo_url,
               c.quality_report_photo_urls,c.operator_id,r.id,e.station_id,e.station_name,c.is_final,
               (SELECT COUNT(*) FROM mo_rework_completion_yx prev_batch
                WHERE prev_batch.rework_id=r.id AND prev_batch.id<=c.id)
        FROM mo_rework_completion_yx c JOIN mo_rework_yx r ON r.id=c.rework_id
        JOIN mo_execution_yx e ON e.id=r.source_execution_id
        WHERE {visible} {dates}
    """.format(visible=visible, dates='AND c.complete_time>=%s AND c.complete_time<%s' if dated else '')


def query_args(args, staff_id, scope=None):
    today = date.today().isoformat()
    start = date.fromisoformat(args.get('start_date', today))
    end = date.fromisoformat(args.get('end_date', today))
    if start > end or (end - start).days > 366:
        raise ValueError('日期范围不正确，最多查询一年')
    page = int(args.get('page', '1'))
    if page < 1 or page > 10000:
        raise ValueError('页码不正确')
    kind = args.get('kind', '')
    printed = args.get('printed', '')
    if kind not in ('', 'normal', 'rework') or printed not in ('', 'printed', 'pending', 'unknown'):
        raise ValueError('筛选条件不正确')
    _, scope_params = visibility(scope or {'kind': 'self'}, staff_id)
    params = (scope_params + [start, end + timedelta(days=1)]) * 2
    where = []
    if args.get('mine', '0') not in ('0', '1'):
        raise ValueError('筛选条件不正确')
    if args.get('mine') == '1':
        where.append('operator_id=%s')
        params.append(staff_id)
    if args.get('station_id'):
        if not str(args['station_id']).isdigit() or int(args['station_id']) < 1:
            raise ValueError('工站编号不正确')
        where.append('station_id=%s')
        params.append(int(args['station_id']))
    keyword = args.get('keyword', '').strip()[:100]
    if keyword:
        where.append('(mo_code LIKE %s OR inv_code LIKE %s OR inv_name LIKE %s)')
        params.extend(['%' + keyword + '%'] * 3)
    for field, value in (('kind', kind), ('process_name', args.get('process', '').strip()[:100]), ('print_status', printed)):
        if value:
            where.append(field + '=%s')
            params.append(value)
    return params, ' AND '.join(where) or '1=1', page


def json_value(value, default):
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value) if value else default
    except (ValueError, TypeError):
        return default


def format_row(row):
    item = dict(row)
    for key in ('qty_done', 'qty_a', 'qty_a1', 'qty_a2', 'qty_c'):
        item[key] = float(item.get(key) or 0)
    for key in ('start_time', 'complete_time'):
        value = item.get(key)
        item[key] = value.strftime('%Y-%m-%d %H:%M:%S') if isinstance(value, datetime) else value
    item['key'] = f"{item['source_type']}:{item['source_id']}"
    item['photos'] = [url.strip() for url in (item.get('photo_url') or '').split(',') if url.strip()]
    item['quality_report_photo_urls'] = json_value(
        item.get('quality_report_photo_urls'), []
    )
    return item


def print_fields_sql():
    # Only an explicit source pair proves a batch was printed. Old unscoped logs
    # before this completion cannot belong to this batch, even in the same step.
    return """
        (SELECT COUNT(*) FROM mo_operation_log_yx p
         WHERE p.event_type='label_print' AND p.source_type=b.source_type
           AND p.source_id=b.source_id) AS print_count,
        CASE WHEN EXISTS (
            SELECT 1 FROM mo_operation_log_yx p WHERE p.event_type='label_print'
              AND p.source_type=b.source_type AND p.source_id=b.source_id
        ) THEN 'printed' WHEN EXISTS (
            SELECT 1 FROM mo_execution_print_log_yx p WHERE p.execution_id=b.execution_id
              AND p.print_time>=b.complete_time
              AND NOT EXISTS (SELECT 1 FROM mo_operation_log_yx o
                  WHERE o.event_key=CONCAT('label_print:',p.id))
        ) THEN 'unknown' ELSE 'pending' END AS print_status
    """


def printing_reminders(cur, rows, staff_id, own_only):
    """Compare completion/print counts for the whole execution, not one batch."""
    execution_ids = sorted({row['execution_id'] for row in rows})
    if not execution_ids:
        return {}
    completion_owner = ' AND c.operator_id=%s' if own_only else ''
    print_owner = ' AND p.operator_id=%s' if own_only else ''
    marks = ','.join(['%s'] * len(execution_ids))
    cur.execute(f'''SELECT e.id AS execution_id,
        ((SELECT COUNT(*) FROM mo_execution_completion_yx c
          WHERE c.execution_id=e.id{completion_owner}) +
         (SELECT COUNT(*) FROM mo_rework_completion_yx c JOIN mo_rework_yx r ON r.id=c.rework_id
          WHERE r.source_execution_id=e.id{completion_owner})) AS completion_count,
        (SELECT COUNT(*) FROM mo_execution_print_log_yx p
         WHERE p.execution_id=e.id{print_owner}) AS execution_print_count
        FROM mo_execution_yx e WHERE e.id IN ({marks})''',
        ([staff_id] * 3 if own_only else []) + execution_ids)
    reminders = {}
    for row in cur.fetchall():
        completed = int(row['completion_count'])
        printed = int(row['execution_print_count'])
        reminders[row['execution_id']] = ('unprinted' if printed == 0
            else 'missing' if printed < completed else 'printed')
    return reminders


@mo_reporting_bp.get('/reporting/access')
def reporting_access():
    staff_id = request.headers.get('staff-id', '').strip()
    if not staff_id or request.args.get('user_id', staff_id) != staff_id:
        return jsonify(code=401, msg='请先登录'), 401
    conn = cur = None
    try:
        conn = business_db()
        cur = conn.cursor(dictionary=True, buffered=True)
        staff_from_cache(cur, staff_id)
        scope = view_scope(cur, staff_id)
        response = jsonify(code=0, data={'can_view': report_access_allowed(scope)})
        response.headers['Cache-Control'] = 'no-store'
        return response
    except AccessError as exc:
        return jsonify(code=exc.status, msg=str(exc)), exc.status
    except Exception:
        logger.exception('report access query failed')
        return jsonify(code=503, msg='报表权限暂时无法读取'), 503
    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.rollback()
            conn.close()


@mo_reporting_bp.get('/reporting/summary')
@mo_reporting_bp.get('/reporting/board')
def reporting_summary():
    staff_id = request.headers.get('staff-id', '').strip()
    if not staff_id or request.args.get('user_id', staff_id) != staff_id:
        return jsonify(code=401, msg='请先登录'), 401
    try:
        query_args(request.args, staff_id)
    except (ValueError, TypeError):
        return jsonify(code=400, msg='日期范围不正确，最多查询一年'), 400
    conn = cur = None
    try:
        conn = business_db()
        cur = conn.cursor(dictionary=True, buffered=True)
        staff_from_cache(cur, staff_id)
        scope = view_scope(cur, staff_id)
        if not report_access_allowed(scope):
            raise AccessError(403, '暂无报表查看权限')
        visible, params = visibility(scope, staff_id)
        if request.path.endswith('/board'):
            from services.mo_dashboard_snapshot import include_unreported_orders, load_operation_rows
            from services.mo_reporting_board import (
                product_context, scoped_snapshot, sync_panel_reporting,
            )
            now = datetime.now(ZoneInfo('Asia/Shanghai')).replace(tzinfo=None)
            data = load_operation_rows(conn, now)
            personal = {}
            if scope['kind'] == 'self':
                cur.execute(f'''SELECT execution_id,
                    SUM(CASE WHEN kind='normal' THEN qty_done ELSE 0 END) AS normal_qty,
                    SUM(CASE WHEN kind='rework' THEN qty_done ELSE 0 END) AS rework_qty,
                    MAX(complete_time) AS last_time FROM ({batch_sql(visible, dated=False)}) b
                    GROUP BY execution_id''', params * 2)
                personal = {r['execution_id']: {**r, 'normal_qty': float(r['normal_qty']),
                    'rework_qty': float(r['rework_qty'])} for r in cur.fetchall()}
            products, warning = product_context(cur, data, scope)
            try:
                if sync_panel_reporting(conn, data, products):
                    conn.commit()
                    data = load_operation_rows(conn, now)
                    include_unreported_orders(data, products)
            except Exception:
                conn.rollback()
                logger.exception('拼皮线报工自动补录失败')
                warning = '；'.join(filter(None, [warning, '拼皮线报工自动补录暂未完成']))
            result = scoped_snapshot(data, products, now, scope, personal)
            result['notice'] = warning
        else:
            from services.mo_reporting_summary import summarize
            start = date.fromisoformat(request.args.get('start_date', date.today().isoformat()))
            end = date.fromisoformat(request.args.get('end_date', date.today().isoformat()))
            since = min(start, end - timedelta(days=6))
            batches = batch_sql(visible)
            values = (params + [since, end + timedelta(days=1)]) * 2
            cur.execute(f'''SELECT DATE(complete_time) AS day,kind,process_name,COUNT(*) AS batch_count,
                SUM(qty_done) AS qty,SUM(qty_a) AS qty_a,SUM(qty_a1) AS qty_a1,
                SUM(qty_a2) AS qty_a2,SUM(qty_c) AS qty_c
                FROM ({batches}) b GROUP BY DATE(complete_time),kind,process_name''', values)
            rows = cur.fetchall()
            cur.execute(f'SELECT COUNT(DISTINCT mo_code) AS total FROM ({batches}) b',
                (params + [start, end + timedelta(days=1)]) * 2)
            order_count = int(cur.fetchone()['total'])
            cur.execute(f'''SELECT DISTINCT b.mo_code,b.sort_seq,e.route_id,e.seq,b.process_name,ctx.plan_qty
                FROM ({batches}) b JOIN mo_execution_yx e ON e.id=b.execution_id
                LEFT JOIN mo_workorder_context_yx ctx ON ctx.mo_code=b.mo_code AND ctx.sort_seq=b.sort_seq
                WHERE b.kind='normal' ''', (params + [start, end + timedelta(days=1)]) * 2)
            result = summarize(rows, start, end, order_count, cur.fetchall())
            result['scope'] = scope
        return jsonify(code=0, data=result)
    except AccessError as exc:
        return jsonify(code=exc.status, msg=str(exc)), exc.status
    except Exception:
        logger.exception('report summary query failed')
        return jsonify(code=503, msg='报表暂时无法读取'), 503
    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.rollback()
            conn.close()


@mo_reporting_bp.get('/reporting/records')
def reporting_records():
    staff_id = request.headers.get('staff-id', '').strip()
    if not staff_id or request.args.get('user_id', staff_id) != staff_id:
        return jsonify(code=401, msg='请先登录'), 401
    try:
        params, where, page = query_args(request.args, staff_id)
    except (ValueError, TypeError):
        return jsonify(code=400, msg='查询条件不正确，日期范围最多一年'), 400
    conn = cur = None
    try:
        conn = business_db()
        cur = conn.cursor(dictionary=True, buffered=True)
        staff_from_cache(cur, staff_id)
        scope = view_scope(cur, staff_id)
        params, where, page = query_args(request.args, staff_id, scope)
        visible, scope_params = visibility(scope, staff_id)
        batches = batch_sql(visible)
        enriched = f"""
            SELECT b.*,ctx.inv_code,ctx.inv_name,ctx.inv_std,ctx.customer_name,
                {print_fields_sql()},
                evt.details AS event_details
            FROM ({batches}) b
            LEFT JOIN mo_workorder_context_yx ctx ON ctx.mo_code=b.mo_code AND ctx.sort_seq=b.sort_seq
            LEFT JOIN mo_operation_log_yx evt ON evt.event_key=CONCAT(b.source_type,':',b.source_id)
        """
        cur.execute(f'SELECT COUNT(*) AS total FROM ({enriched}) q WHERE {where}', params)
        total = int(cur.fetchone()['total'])
        cur.execute(f'SELECT * FROM ({enriched}) q WHERE {where} ORDER BY complete_time DESC,source_type,source_id DESC LIMIT %s OFFSET %s',
                    params + [20, (page - 1) * 20])
        rows = cur.fetchall()
        reminders = printing_reminders(cur, rows, staff_id, scope['kind'] == 'self')
        # Small fixed-size page; worker snapshots remain separate from the submitter.
        for row in rows:
            row['label_reminder'] = reminders.get(row['execution_id'], '')
            details = json_value(row.pop('event_details', None), {})
            if row['kind'] == 'rework':
                table, key, record_id = 'mo_rework_worker_yx', 'rework_id', row['rework_id']
            elif details.get('receive_id'):
                table, key, record_id = 'mo_receive_worker_yx', 'receive_id', details['receive_id']
            else:
                table, key, record_id = 'mo_execution_worker_yx', 'execution_id', row['execution_id']
            cur.execute(f'SELECT user_name_snapshot AS name FROM {table} WHERE {key}=%s ORDER BY id', (record_id,))
            row['workers'] = list(dict.fromkeys(w['name'] for w in cur.fetchall() if w['name']))
            cur.execute("""SELECT o.occurred_at,p.printer_name,p.operator_name
                FROM mo_execution_print_log_yx p
                JOIN mo_operation_log_yx o ON o.event_key=CONCAT('label_print:',p.id)
                WHERE o.source_type=%s AND o.source_id=%s AND o.event_type='label_print'
                ORDER BY p.id DESC""",
                        (row['source_type'], row['source_id']))
            row['prints'] = [{**p, 'occurred_at': str(p['occurred_at'])} for p in cur.fetchall()]
        base_params = params[:2 * (len(scope_params) + 2)]
        cur.execute(f'SELECT DISTINCT process_name FROM ({batches}) b ORDER BY process_name', base_params)
        processes = [r['process_name'] for r in cur.fetchall() if r['process_name']]
        return jsonify(code=0, data={'items': [format_row(r) for r in rows],
                                     'total': total, 'page': page, 'processes': processes,
                                     'scope': scope, 'stations': scope['stations']})
    except (ValueError, TypeError):
        return jsonify(code=400, msg='筛选条件不正确'), 400
    except AccessError as exc:
        return jsonify(code=exc.status, msg=str(exc)), exc.status
    except Exception:
        logger.exception('completion batch query failed')
        return jsonify(code=503, msg='报工记录暂时无法读取'), 503
    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()


def authorized_batch(cur, staff_id, args):
    scope = view_scope(cur, staff_id)
    visible, params = visibility(scope, staff_id)
    source = args.get('source_type')
    if source not in ('completion', 'rework_completion'):
        raise AccessError(400, '报工批次参数不正确')
    source_id = positive_id(args.get('source_id'))
    execution_id = positive_id(args.get('id') or args.get('execution_id'))
    if args.get('execution_id') is not None and positive_id(args['execution_id']) != execution_id:
        raise AccessError(400, '工序编号不一致')
    cur.execute(f'''SELECT b.*,ctx.inv_code,ctx.inv_name,ctx.inv_std,ctx.plan_qty,ctx.customer_name,
            {print_fields_sql()}
        FROM ({batch_sql(visible, dated=False)}) b
        LEFT JOIN mo_workorder_context_yx ctx ON ctx.mo_code=b.mo_code AND ctx.sort_seq=b.sort_seq
        WHERE b.source_type=%s AND b.source_id=%s AND b.execution_id=%s''',
        params * 2 + [source, source_id, execution_id])
    batch = cur.fetchone()
    if not batch:
        raise AccessError(403, '无权查看该报工记录')
    return scope, batch


def batch_header(batch):
    return {'MoCode_a': batch['mo_code'], 'SortSeq_b': batch['sort_seq'],
            'InvCode_b': batch.get('inv_code'), 'cInvName': batch.get('inv_name'),
            'cInvStd': batch.get('inv_std'), 'Qty_b': float(batch.get('plan_qty') or 0),
            'CustomerName': batch.get('customer_name')}


def authorized_latest_batch(cur, staff_id, args):
    execution_id = positive_id(args.get('id'))
    scope = view_scope(cur, staff_id)
    # Resolve the actual latest completion, not the caller's latest visible one.
    # Event IDs break ties when normal/rework completions share a timestamp.
    cur.execute(f'''SELECT b.*,ctx.inv_code,ctx.inv_name,ctx.inv_std,ctx.plan_qty,ctx.customer_name
        FROM ({batch_sql('1=1', dated=False)}) b
        LEFT JOIN mo_workorder_context_yx ctx ON ctx.mo_code=b.mo_code AND ctx.sort_seq=b.sort_seq
        LEFT JOIN mo_operation_log_yx evt ON evt.event_key=CONCAT(b.source_type,':',b.source_id)
        WHERE b.execution_id=%s
        ORDER BY b.complete_time DESC,evt.id DESC,b.source_type DESC,b.source_id DESC LIMIT 1''', (execution_id,))
    batch = cur.fetchone()
    if not batch:
        raise AccessError(404, '暂无完工流转标签')
    if ((scope['kind'] == 'self' and batch['operator_id'] != staff_id)
            or (scope['kind'] == 'station' and batch['station_id'] not in scope['station_ids'])):
        raise AccessError(403, '无权查看最新流转标签')
    return scope, batch


def personal_detail(batch, selected, workers, duration):
    """Use the same completion-detail shape without exposing coworkers' batches."""
    data = {key: selected.get(key) for key in
            ('process_name', 'station_name', 'start_time', 'qty_done', 'qty_a', 'qty_a1', 'qty_a2', 'qty_c')}
    data.update(id=batch['execution_id'], status='done', end_time=selected.get('complete_time'),
                duration_text=duration, workers=workers, completion_records=[{
                    **selected, 'id': batch['source_id'], 'photo_url': batch.get('photo_url'),
                }], rework_records=[], receive_work_records=[], makeup_records=[],
                can_continue_completion=False, has_next=False)
    return data


@mo_reporting_bp.get('/reporting/detail')
@mo_reporting_bp.get('/reporting/label')
@mo_reporting_bp.get('/reporting/latest-label')
@mo_reporting_bp.post('/reporting/print-log')
@mo_reporting_bp.post('/reporting/label-pdf')
def reporting_batch_view():
    """Reporting entry points recheck current station scope on every request."""
    staff_id = request.headers.get('staff-id', '').strip()
    args = request.args if request.method == 'GET' else (request.get_json(silent=True) or {})
    if not isinstance(args, dict) and request.method == 'POST':
        return jsonify(code=400, msg='报工参数不正确'), 400
    if not staff_id or (request.method == 'POST' and args.get('user_id') != staff_id):
        return jsonify(code=401, msg='请先登录'), 401
    conn = cur = None
    try:
        conn = business_db()
        cur = conn.cursor(dictionary=True, buffered=True)
        staff_from_cache(cur, staff_id)
        action = request.path.rsplit('/', 1)[-1]
        scope, batch = (authorized_latest_batch(cur, staff_id, args) if action == 'latest-label'
                        else authorized_batch(cur, staff_id, args))
        from routes import mo
        deferred = DeferredConnection(conn)
        g.mo_station_connection = deferred
        g.mo_reporting_readonly = True
        if action == 'detail':
            if scope['kind'] != 'self':
                response = make_response(mo.execution_detail())
                result = response.get_json()
                if response.status_code != 200 or result.get('code') != 0:
                    return response
                data = result['data']
            cur.execute('SELECT details FROM mo_operation_log_yx WHERE event_key=%s',
                        (f"{batch['source_type']}:{batch['source_id']}",))
            event = cur.fetchone()
            details = json_value(event['details'] if event else None, {})
            if batch['kind'] == 'rework':
                table, key, value = 'mo_rework_worker_yx', 'rework_id', batch['rework_id']
            elif details.get('receive_id'):
                table, key, value = 'mo_receive_worker_yx', 'receive_id', details['receive_id']
            else:
                table, key, value = 'mo_execution_worker_yx', 'execution_id', batch['execution_id']
            cur.execute(f'SELECT user_name_snapshot AS name FROM {table} WHERE {key}=%s ORDER BY id', (value,))
            selected = format_row(batch)
            names = list(dict.fromkeys(r['name'] for r in cur.fetchall() if r['name']))
            selected['worker_text'] = '、'.join(names) or '未记录'
            if scope['kind'] == 'self':
                data = personal_detail(batch, selected, [{'user_id': str(i), 'user_name': name} for i, name in enumerate(names)],
                                       mo._format_duration(batch.get('start_time'), batch.get('complete_time')))
            data.update(reporting_batch=selected, reporting_header=batch_header(batch),
                        reporting_own_only=scope['kind'] == 'self')
            return jsonify(code=0, data=data)
        if action in ('label', 'latest-label'):
            response = make_response(mo.execution_label({
                'id': str(batch['execution_id']), 'source_type': batch['source_type'],
                'source_id': str(batch['source_id'])
            }) if action == 'latest-label' else mo.execution_label())
            result = response.get_json()
            if result.get('code') == 0:
                result['data']['reporting_header'] = batch_header(batch)
                if action == 'label':
                    result['data']['print_count'] = int(batch.get('print_count') or 0)
                    result['data']['print_status'] = batch.get('print_status', 'pending')
                else:
                    result['data']['latest_label'] = True
                return jsonify(result)
            return response
        if action == 'label-pdf':
            label = args.get('label') or {}
            if (label.get('mo_code') != batch['mo_code']
                    or str(label.get('sort_seq')) != str(batch['sort_seq'])):
                raise AccessError(400, '标签与报工记录不匹配')
            return mo.execution_label_pdf()
        response = make_response(mo.execution_print_log())
        if response.status_code == 200 and response.get_json().get('code') == 0 and deferred.committed and not deferred.rolled_back:
            cur.execute("""SELECT COUNT(*) AS print_count FROM mo_operation_log_yx
                WHERE event_type='label_print' AND source_type=%s AND source_id=%s""",
                (batch['source_type'], batch['source_id']))
            count = int(cur.fetchone()['print_count'])
            conn.commit()
            result = response.get_json()
            result['data']['print_count'] = count
            return jsonify(result)
        return response
    except AccessError as exc:
        return jsonify(code=exc.status, msg=str(exc)), exc.status
    except Exception:
        logger.exception('reporting batch access failed')
        return jsonify(code=503, msg='报工记录暂时无法读取'), 503
    finally:
        g.pop('mo_station_connection', None)
        g.pop('mo_reporting_readonly', None)
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.rollback()
            conn.close()


def record_batch_print(cur, execution, log_id, source_type, source_id, user_id, operator_name):
    """Attach a batch only when explicitly provided; old logs stay unclassified."""
    if not source_type and not source_id:
        return
    sources = {
        'completion': ('SELECT id FROM mo_execution_completion_yx WHERE id=%s AND execution_id=%s'),
        'rework_completion': ('''SELECT c.id FROM mo_rework_completion_yx c
            JOIN mo_rework_yx r ON r.id=c.rework_id WHERE c.id=%s AND r.source_execution_id=%s'''),
        'receive': ('SELECT id FROM mo_receive_work_yx WHERE id=%s AND execution_id=%s'),
        'rework': ('SELECT id FROM mo_rework_yx WHERE id=%s AND source_execution_id=%s'),
    }
    if source_type not in sources or not str(source_id).isdigit():
        raise ValueError('标签批次参数不正确')
    cur.execute(sources[source_type], (source_id, execution['id']))
    if not cur.fetchone():
        raise ValueError('标签批次与工序不匹配')
    cur.execute('SELECT source_type,source_id FROM mo_operation_log_yx WHERE event_key=%s', (f'label_print:{log_id}',))
    existing = cur.fetchone()
    if existing:
        if existing['source_type'] != source_type or int(existing['source_id']) != int(source_id):
            raise ValueError('打印任务已关联其他批次')
        return
    from services.mo_operation_log import write_operation_log
    write_operation_log(cur, event_key=f'label_print:{log_id}', event_type='label_print',
        event_name='打印流转标签', occurred_at=datetime.now(), operator_id=user_id,
        operator_name=operator_name, mo_code=execution['mo_code'], sort_seq=execution['sort_seq'],
        route_id=execution['route_id'], seq=execution['seq'], process_name=execution['process_name'],
        source_type=source_type, source_id=source_id)
