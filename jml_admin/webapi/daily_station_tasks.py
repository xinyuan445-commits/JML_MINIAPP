"""PMC daily assignments, isolated from MRP/APS and all reporting writes."""
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal, InvalidOperation
from io import BytesIO
import json

from flask import Blueprint, current_app, g, jsonify, request, send_file

import daily_task_snapshots as lifecycle

GRADES = ('qty_a', 'qty_a1', 'qty_a2', 'qty_c')
ZERO = Decimal('0')


def qty(value):
    return Decimal(str(value or 0))


def positive_quantity(value):
    try:
        number = Decimal(str(value))
        if not number.is_finite() or number <= 0 or number > Decimal('999999999999'):
            raise ValueError()
        if number != number.quantize(Decimal('0.0001')):
            raise ValueError()
        return number
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError('安排数量须大于0，最多4位小数') from None


def work_date(value):
    try:
        result = date.fromisoformat(str(value))
        if not 2020 <= result.year <= 2100:
            raise ValueError()
        return result
    except ValueError:
        raise ValueError('执行日期无效') from None


def key(row, station=True):
    values = (str(row['mo_code']), int(row['sort_seq']), int(row['route_id']),
              int(row['seq']), row.get('kind', 'normal'))
    return (*values, int(row.get('station_id') or 0)) if station else values


def json_data(value):
    return json.dumps(value, ensure_ascii=False, default=str)


def unpack(value):
    return json.loads(value) if isinstance(value, str) else (value or {})


def serialize(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat(sep=' ') if isinstance(value, datetime) else value.isoformat()
    if isinstance(value, dict):
        return {k: serialize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [serialize(v) for v in value]
    return value


def remaining(item, actual):
    if item['status'] != 'active':
        return ZERO
    return max(ZERO, qty(item['quantity']) - qty(item['transferred_qty']) - qty(actual.get('done')))


def load_actuals(cursor, since, until, as_of=None):
    """Dates use the existing Beijing business DATETIME, not server-local timezone.

    Only completion batches are attributed to a day; cumulative historical totals
    are never guessed onto their last completion date. Receipts use event increments
    with source existence checks, to avoid counting cancelled source rows.
    """
    result = {}
    completion_limit = 'AND c.create_time < %s' if as_of is not None else ''
    receipt_limit = 'AND l.created_at < %s' if as_of is not None else ''
    params = (since, until, as_of) if as_of is not None else (since, until)
    cursor.execute(f'''
        SELECT DATE(c.complete_time) work_date,e.mo_code,e.sort_seq,e.route_id,e.seq,
               e.station_id,e.process_name,e.station_name,'normal' kind,
               SUM(c.qty_a) qty_a,SUM(c.qty_a1) qty_a1,SUM(c.qty_a2) qty_a2,SUM(c.qty_c) qty_c
        FROM mo_execution_completion_yx c JOIN mo_execution_yx e ON e.id=c.execution_id
        WHERE c.complete_time >= %s AND c.complete_time < %s
          {completion_limit}
        GROUP BY DATE(c.complete_time),e.mo_code,e.sort_seq,e.route_id,e.seq,
                 e.station_id,e.process_name,e.station_name
        UNION ALL
        SELECT DATE(c.complete_time),r.mo_code,r.sort_seq,r.route_id,r.seq,
               e.station_id,e.process_name,e.station_name,'rework',
               SUM(c.qty_a),SUM(c.qty_a1),SUM(c.qty_a2),SUM(c.qty_c)
        FROM mo_rework_completion_yx c JOIN mo_rework_yx r ON r.id=c.rework_id
        JOIN mo_execution_yx e ON e.id=r.source_execution_id
        WHERE c.complete_time >= %s AND c.complete_time < %s
          {completion_limit}
        GROUP BY DATE(c.complete_time),r.mo_code,r.sort_seq,r.route_id,r.seq,
                 e.station_id,e.process_name,e.station_name
    ''', (*params, *params))
    for row in cursor.fetchall():
        group = (str(row['work_date']), key(row))
        target = result.setdefault(group, {**row, 'done': ZERO, **{f: ZERO for f in GRADES}, 'received': ZERO})
        for field in GRADES:
            target[field] += qty(row[field])
        target['done'] += sum((qty(row[f]) for f in GRADES), ZERO)
    cursor.execute(f'''
        SELECT DATE(l.occurred_at) work_date,l.mo_code,l.sort_seq,l.route_id,l.seq,
               COALESCE(l.station_id,h.to_station_id,e.station_id,0) station_id,
               l.process_name,l.station_name,
               CASE WHEN l.event_type='rework_start' THEN 'rework' ELSE 'normal' END kind,
               SUM(l.qty) received
        FROM mo_operation_log_yx l
        LEFT JOIN mo_handover_yx h ON l.source_type='handover' AND h.id=l.source_id
        LEFT JOIN (SELECT mo_code,sort_seq,route_id,seq,
                   CASE WHEN COUNT(*)=1 THEN MIN(station_id) ELSE NULL END station_id
                   FROM mo_execution_yx GROUP BY mo_code,sort_seq,route_id,seq) e
             ON e.mo_code=l.mo_code AND e.sort_seq=l.sort_seq
             AND e.route_id=l.route_id AND e.seq=l.seq
        WHERE l.occurred_at >= %s AND l.occurred_at < %s
          {receipt_limit}
          AND l.event_type IN ('receive_first','receive','receive_more','receive_work_start','rework_start')
          AND l.route_id IS NOT NULL AND l.seq IS NOT NULL
          AND ((l.source_type='handover' AND h.id IS NOT NULL)
            OR (l.source_type='makeup' AND EXISTS (SELECT 1 FROM mo_makeup_record_yx m WHERE m.id=l.source_id))
            OR (l.source_type='receive_work' AND EXISTS (SELECT 1 FROM mo_receive_work_yx r WHERE r.id=l.source_id))
            OR (l.source_type='rework' AND EXISTS (SELECT 1 FROM mo_rework_yx r WHERE r.id=l.source_id)))
        GROUP BY DATE(l.occurred_at),l.mo_code,l.sort_seq,l.route_id,l.seq,
                 COALESCE(l.station_id,h.to_station_id,e.station_id,0),l.process_name,l.station_name,
                 CASE WHEN l.event_type='rework_start' THEN 'rework' ELSE 'normal' END
    ''', params)
    for row in cursor.fetchall():
        group = (str(row['work_date']), key(row))
        target = result.setdefault(group, {**row, 'done': ZERO, **{f: ZERO for f in GRADES}, 'received': ZERO})
        target['received'] += qty(row['received'])
    return result


def load_stations(cursor):
    cursor.execute('''SELECT w.id,w.station_name,w.is_active,s.name leader_name
        FROM mo_workstation_yx w
        LEFT JOIN mo_station_staff_config_yx c ON c.station_id=w.id
        LEFT JOIN jml_staff s ON s.id=c.leader_staff_id
        ORDER BY w.station_name,w.id''')
    return cursor.fetchall()


def load_items(cursor, day=None):
    live_filter = ' WHERE h.work_date=%s' if day is not None else ''
    params = (day,) if day is not None else ()
    cursor.execute('''SELECT i.*,h.sheet_id,h.work_date,h.dept_name,h.revision,h.status header_status,s.result_cutoff
        FROM mo_daily_task_item_yx i JOIN mo_daily_task_yx h ON h.id=i.task_id
        JOIN mo_daily_task_sheet_yx s ON s.id=h.sheet_id''' + live_filter + ' ORDER BY h.work_date,i.sort_order,i.id', params)
    rows = cursor.fetchall()
    cursor.execute('SELECT id,work_date,result_cutoff,plan_data FROM mo_daily_task_sheet_yx WHERE plan_data IS NOT NULL'
                   + (' AND work_date=%s' if day is not None else ''), params)
    for sheet in cursor.fetchall():
        rows = [i for i in rows if i['sheet_id'] != sheet['id']]
        rows.extend(dict(i, work_date=sheet['work_date'], result_cutoff=sheet['result_cutoff'])
                    for i in unpack(sheet['plan_data'])['items'])
    return rows


def export_day_data(cursor, day, service, nonorder_sheet_data):
    cursor.execute("SELECT * FROM mo_daily_task_sheet_yx WHERE work_date=%s ORDER BY sheet_kind<>'main',id", (day,))
    sheets = cursor.fetchall()
    if not sheets:
        raise ValueError('此执行日期没有安排单')

    open_sheets = {sheet['id'] for sheet in sheets if not sheet.get('result_data')}
    live = defaultdict(list)
    if open_sheets:
        planned = load_items(cursor, day)
        live_plans = [item for item in planned if item['sheet_id'] in open_sheets]
        if live_plans:
            start = datetime.combine(day, time.min)
            actuals = lifecycle.allocate_actuals(planned, load_actuals(cursor, start, start + timedelta(days=1)), key)
            for item in enrich_items(live_plans, actuals, []):
                live[item['sheet_id']].append(item)

    items, nonorder_by_assignment = [], {}
    current_stations = None

    def station_map():
        nonlocal current_stations
        if current_stations is None:
            current_stations = {station['id']: station for station in load_stations(cursor)}
        return current_stations

    for sheet in sheets:
        label = '主单' if sheet['sheet_kind'] == 'main' else f"补充安排 #{sheet['id']}"
        frozen = unpack(sheet.get('result_data') or sheet.get('plan_data'))
        workorders = unpack(sheet['result_data'])['items'] if sheet.get('result_data') else live[sheet['id']]
        if workorders:
            stations = {row['id']: row for row in frozen['stations']} if frozen else station_map()
            for item in workorders:
                station = stations.get(item['station_id'], {})
                name = station.get('station_name') or str(item['station_id'])
                leader = station.get('leader_name') if 'leader_name' in station else station_map().get(item['station_id'], {}).get('leader_name')
                if leader:
                    name += '\n' + leader
                items.append(dict(item, export_station_name=name, export_sheet_label=label))
        if service:
            for item in nonorder_sheet_data(service, sheet, export=True)['items']:
                assignment_id = item['assignment_id']
                previous = nonorder_by_assignment.get(assignment_id)
                if not previous or item['status'] == 'published' or previous['status'] != 'published':
                    nonorder_by_assignment[assignment_id] = dict(item, export_sheet_label=label)
    return {'date': str(day), 'items': items, 'stations': [], 'export_scope': 'day',
            'nonorder': {'items': list(nonorder_by_assignment.values())}}


def candidate_waiting_reason(step, previous, kind, ready, maximum):
    if ready is None:
        return 'unknown'
    if maximum <= ready:
        return None
    if kind != 'normal':
        return 'unknown'
    if previous is None:
        return 'material' if step.get('first_issued_qty') is not None else 'unknown'
    if previous.get('normal_done_qty') is None or previous.get('transferable_qty') is None or step.get('normal_done_qty') is None:
        return 'unknown'
    supplied = qty(step['normal_done_qty']) + ready
    needed = qty(step['normal_done_qty']) + maximum
    # If usable upstream output already exceeds the downstream supply recorded,
    # check the handover instead of claiming that all missing supply is unfinished.
    if qty(previous['transferable_qty']) > supplied + Decimal('0.0001'):
        return 'unknown'
    return 'upstream' if qty(previous['normal_done_qty']) < needed else 'unknown'


def candidates(snapshot, station_rows, allowed_rows):
    stations = {int(s['id']): s for s in station_rows if s['is_active']}
    allowed = defaultdict(list)
    for row in allowed_rows:
        if int(row['station_id']) in stations:
            allowed[(int(row['route_id']), int(row['seq']))].append(int(row['station_id']))
    result = []
    for order in snapshot['orders']:
        if order.get('is_closed') or order.get('erp_deleted'):
            continue
        steps = sorted(order['steps'], key=lambda step: int(step['seq']))
        last_seq = int(steps[-1]['seq']) if steps else 0
        for index, step in enumerate(steps):
            previous = steps[index - 1] if index else None
            assigned_station = int(step.get('station_id') or 0)
            options = allowed[(int(order['route_id']), int(step['seq']))]
            # Once received/started, the physical work cannot be reassigned by dragging.
            if qty(step.get('normal_received_qty')) > 0 or qty(step.get('normal_done_qty')) > 0 or step.get('has_active_execution'):
                options = [assigned_station] if assigned_station in stations else []
            for kind in ('normal', 'rework'):
                received = step.get('normal_remaining_qty') if kind == 'normal' else step.get('rework_remaining_qty')
                available = step.get('receive_available_qty') if kind == 'normal' else 0
                ready = None if received is None or available is None else qty(received) + qty(available)
                balance = (max(ZERO, qty(order['plan_qty']) - qty(step.get('normal_done_qty')))
                           if kind == 'normal' and order.get('plan_qty') is not None else None)
                if kind == 'rework':
                    balance = qty(received)
                # Preserve known shop-floor work even if the other balance is unknown.
                maximum = max(balance or ZERO, qty(received) + qty(available))
                uncertain_active = kind == 'normal' and received is None and bool(step.get('has_active_execution'))
                if maximum <= 0 and not uncertain_active:
                    continue
                result.append({
                    'mo_code': order['mo_code'], 'sort_seq': order['sort_seq'], 'route_id': order['route_id'],
                    'seq': step['seq'], 'kind': kind, 'process_name': step['process_name'],
                    'is_last_step': int(step['seq']) == last_seq,
                    'waiting_reason': candidate_waiting_reason(step, previous, kind, ready, maximum),
                    'waiting_process_name': previous.get('process_name') if previous else None,
                    'dept_name': order.get('dept_name') or '未标部门',
                    'plan_start_date': order.get('plan_start_date'),
                    'has_active_execution': bool(step.get('has_active_execution')),
                    'inv_code': order.get('inv_code'), 'inv_name': order.get('inv_name'), 'inv_std': order.get('inv_std'),
                    'unit_name': order.get('unit_name') or '未标单位', 'allowed_station_ids': options,
                    'received_remaining': received, 'receivable': available, 'ready': ready,
                    'maximum': maximum, 'waiting': None if ready is None else max(ZERO, maximum-ready),
                    'standard_unit_minutes': step.get('standard_unit_minutes')
                        if step.get('capacity_unit') == order.get('unit_name') else None,
                    'capacity_station_id': assigned_station,
                    'capacity_state': step.get('capacity_state'),
                })
    return result


def enrich_items(items, actuals, pool):
    current = {key(row, False): row for row in pool}
    result = []
    for item in items:
        actual = lifecycle.actual_for(actuals, item, key)
        source = current.get(key(item, False))
        # Missing candidates can also mean fully completed; route validity is checked separately.
        result.append({**unpack(item['snapshot']), **item, 'snapshot': unpack(item['snapshot']),
                       'actual': actual, 'remaining': remaining(item, actual),
                       'difference': qty(actual.get('done')) - qty(item['quantity']),
                       'current': source})
    return result


def daily_tasks_blueprint(database, operations):
    import nonorder_daily as nonorder
    from nonorder_core.storage import RuleError

    blueprint = Blueprint('daily_station_tasks', __name__)

    def sheets(write=False):
        """Header-only entry: listing/creating a sheet does not load shop-floor data."""
        connection = cursor = None
        locked = False
        try:
            body = request.get_json(silent=True) or {}
            if write:
                if not isinstance(body, dict):
                    raise ValueError('请求内容无效')
                selected_date = work_date(body.get('date'))
                if selected_date < lifecycle.beijing_now().date():
                    raise ValueError('不能新建历史日期的安排单')
            connection = database()
            cursor = connection.cursor(dictionary=True)
            if write:
                cursor.execute("SELECT GET_LOCK('jml_pmc_daily_tasks',10) locked")
                locked = cursor.fetchone()['locked'] == 1
                if not locked:
                    raise ValueError('其他人员正在保存，请稍后重试')
                header, created = lifecycle.create_sheet(cursor, selected_date, g.audit_username,
                                                         lifecycle.beijing_now(), body.get('parent_id'))
                response = jsonify({'code': 0, 'data': {'sheet': serialize(lifecycle.metadata(header, lifecycle.beijing_now())), 'created': created}})
                connection.commit()
                return response
            rows = lifecycle.list_sheets(cursor, lifecycle.beijing_now())
            if getattr(g, 'admin_account', None):
                rows = lifecycle.with_creator_names(cursor, rows)
            return jsonify({'code': 0, 'data': serialize(nonorder.annotate_sheets(cursor, rows))})
        except ValueError as exc:
            if connection:
                connection.rollback()
            return jsonify({'code': 400, 'msg': str(exc)}), 400
        except Exception:
            if connection:
                connection.rollback()
            current_app.logger.exception('daily task sheets failed')
            return jsonify({'code': 503, 'msg': '任务安排单读取或创建失败，请重试'}), 503
        finally:
            if cursor:
                if locked:
                    cursor.execute("SELECT RELEASE_LOCK('jml_pmc_daily_tasks')")
                    cursor.fetchone()
                cursor.close()
            if connection:
                connection.close()

    def output(result, cursor):
        if any('leader_name' not in s for s in result['stations']):
            leaders = {s['id']: s.get('leader_name') for s in load_stations(cursor)}
            result = dict(result, stations=[dict(s, leader_name=s.get('leader_name', leaders.get(s['id'])))
                                           for s in result['stations']])
        if request.path.endswith('/export'):
            dept = request.args.get('dept_name')
            if dept:
                result = dict(result, items=[i for i in result['items'] if i['dept_name'] == dept],
                              unplanned=[i for i in result['unplanned'] if i['dept_name'] == dept], nonorder=None)
            return export_excel(result)
        return jsonify({'code': 0, 'data': serialize(dict(result, supports_day_export=True, supports_day_print=True))})

    def run(write=False):
        connection = cursor = None
        locked = nonorder_locked = False
        plan_service = None
        nonorder_targets = []
        try:
            now = lifecycle.beijing_now()
            body = request.get_json(silent=True) or {} if write else request.args
            if write and not isinstance(body, dict):
                raise ValueError('请求内容无效')
            selected_date = work_date(body.get('date'))
            sheet_id = body.get('sheet_id')
            if not write and sheet_id is not None:
                sheet_id = int(sheet_id)
            connection = database()
            cursor = connection.cursor(dictionary=True)
            # Reads can finalize due snapshots, so they share the write lock.
            cursor.execute("SELECT GET_LOCK('jml_pmc_daily_tasks',10) locked")
            locked = cursor.fetchone()['locked'] == 1
            if not locked:
                raise ValueError('其他人员正在保存，请稍后重试')
            lifecycle.capture_due(cursor, lifecycle.beijing_now())
            if not write and request.path.endswith('/export') and body.get('scope') == 'day':
                result = export_day_data(cursor, selected_date, nonorder.service_for(cursor), nonorder.sheet_data)
                if dept := body.get('dept_name'):
                    result.update(items=[item for item in result['items'] if item['dept_name'] == dept], nonorder=None)
                connection.commit()
                if body.get('format') == 'print':
                    return jsonify({'code': 0, 'data': task_sheet_table(result)})
                return export_excel(result)
            sheet = lifecycle.find_sheet(cursor, selected_date, sheet_id)
            if write:
                lifecycle.assert_editable(sheet, lifecycle.beijing_now())
            def with_nonorder(result):
                service = plan_service or nonorder.service_for(cursor)
                if not service:
                    return result
                data = (nonorder.sheet_data(service, sheet, export=True) if request.path.endswith('/export')
                        else nonorder.sheet_data(service, sheet))
                return dict(result, nonorder=data)

            if sheet.get('result_data'):
                result = unpack(sheet['result_data'])
                result['sheet'] = lifecycle.metadata(sheet, lifecycle.beijing_now())
                result = with_nonorder(result)
                connection.commit()
                return output(result, cursor)
            snapshot = operations(now)
            connection.commit()  # Refresh the consistent read before a possible midnight capture.
            now = lifecycle.beijing_now()
            if write:
                lifecycle.assert_editable(sheet, now)
            # An ERP read may cross midnight. Snapshot before doing any mutations.
            lifecycle.capture_due(cursor, now)
            sheet = lifecycle.find_sheet(cursor, selected_date, sheet['id'])
            if sheet.get('result_data'):
                result = unpack(sheet['result_data'])
                result['sheet'] = lifecycle.metadata(sheet, now)
                result = with_nonorder(result)
                connection.commit()
                return output(result, cursor)
            stations = load_stations(cursor)
            cursor.execute('''SELECT s.route_id,s.seq,ss.station_id FROM mo_route_step_yx s
                JOIN mo_step_station_yx ss ON ss.step_id=s.id''')
            pool = candidates(snapshot, stations, cursor.fetchall())
            items = load_items(cursor)
            since = min([selected_date] + [i['work_date'] for i in items])
            until = max([selected_date, now.date()] + [i['work_date'] for i in items]) + timedelta(days=1)
            actuals = load_actuals(cursor, datetime.combine(since, time.min), datetime.combine(until, time.min))
            actuals = lifecycle.allocate_actuals(items, actuals, key)
            items = [i for i in items if i['result_cutoff'] > now]
            if write:
                body = dict(body, sheet_id=sheet['id'])
                only_nonorder = body.get('nonorder_only', False)
                changes = body.get('nonorder_changes', [])
                creations = body.get('nonorder_creations', [])
                publish = body.get('nonorder_publish', False)
                if type(only_nonorder) is not bool or only_nonorder and (
                    body.get('action') != 'batch_sheet' or not (changes or creations) or body.get('batches') != []
                ):
                    raise ValueError('无工单安排明细无效')
                if any(key in body for key in ('nonorder_changes', 'nonorder_creations', 'nonorder_publish')):
                    if body.get('action') != 'batch_sheet' or not isinstance(changes, list) or not isinstance(creations, list) or type(publish) is not bool:
                        raise ValueError('无工单安排明细无效')
                    if changes or creations:
                        nonorder_locked = nonorder.acquire(cursor)
                        plan_service = nonorder.service_for(cursor)
                        nonorder_targets = (nonorder.save(plan_service, sheet, changes, creations=creations, publish=publish)
                                            if creations else nonorder.save(plan_service, sheet, changes))
                if not only_nonorder and body.get('action') == 'batch_sheet':
                    save_sheet_batch(cursor, body, selected_date, items, actuals, pool, snapshot, now.date())
                elif not only_nonorder and body.get('action') == 'batch':
                    save_batch(cursor, body, selected_date, items, actuals, pool, snapshot, now.date())
                elif not only_nonorder:
                    mutate(cursor, body, selected_date, items, actuals, pool, snapshot, now.date())
                items = [i for i in load_items(cursor) if i['result_cutoff'] > now]
                actuals = lifecycle.allocate_actuals(items, {k: v for k, v in actuals.items() if k[0] not in ('item', '_allocated')}, key)
            cursor.execute('SELECT * FROM mo_daily_task_yx WHERE sheet_id=%s ORDER BY dept_name', (sheet['id'],))
            headers = cursor.fetchall()
            enriched = enrich_items(items, actuals, pool)
            reservations_by_step = defaultdict(list)
            for item in enriched:
                if item['remaining'] > 0:
                    reservations_by_step[key(item, False)].append(item)
            for source in pool:
                reservations = reservations_by_step[key(source, False)]
                source['reserved'] = sum((i['remaining'] for i in reservations), ZERO)
                source['unassigned'] = max(ZERO, source['maximum'] - source['reserved'])
                source['reservations'] = [{'id': i['id'], 'date': str(i['work_date']), 'quantity': i['remaining']} for i in reservations]
            today_items = [i for i in enriched if i['sheet_id'] == sheet['id']]
            orders = {(o['mo_code'], int(o['sort_seq']), int(o['route_id'])): o for o in snapshot['orders']}
            for item in today_items:
                order = orders.get((item['mo_code'], item['sort_seq'], item['route_id']))
                item['issue'] = ('工单关闭、删除或路线已变更，请核对' if not order or order.get('is_closed') or order.get('erp_deleted')
                                 else ('工序已变更，请核对' if not any(s['seq'] == item['seq'] for s in order['steps']) else ''))
            matched = {key(i) for i in enriched if str(i['work_date']) == str(selected_date) and i['status'] == 'active'}
            unplanned = []
            for (day, group), actual in actuals.items():
                if sheet['sheet_kind'] == 'main' and day == str(selected_date) and group not in matched:
                    order = orders.get((actual['mo_code'], actual['sort_seq'], actual['route_id']), {})
                    unplanned.append({**actual, 'dept_name': order.get('dept_name') or '未标部门',
                                      'inv_name': order.get('inv_name'), 'unit_name': order.get('unit_name') or '未标单位'})
            cursor.execute('''SELECT c.* FROM mo_daily_task_change_yx c JOIN mo_daily_task_yx h ON h.id=c.task_id
                WHERE h.sheet_id=%s ORDER BY c.id DESC''', (sheet['id'],))
            changes = cursor.fetchall()
            cursor.execute("SELECT h.work_date,h.dept_name,h.revision FROM mo_daily_task_yx h JOIN mo_daily_task_sheet_yx s ON s.id=h.sheet_id WHERE s.sheet_kind='main'")
            target_headers = cursor.fetchall()
            result = {'date': str(selected_date), 'headers': headers, 'candidates': pool,
                      'stations': stations, 'items': today_items, 'unplanned': unplanned,
                      'changes': changes, 'target_headers': target_headers,
                      'generated_at': now, 'warnings': snapshot.get('warnings', [])}
            if sheet.get('plan_data'):
                plan = unpack(sheet['plan_data'])
                frozen_items = enrich_items(plan['items'], actuals, pool)
                result.update(headers=plan['headers'], items=frozen_items, stations=plan['stations'], changes=plan['changes'], candidates=[])
            result = with_nonorder(result)
            if write:
                # The entire transaction is rejected if validation crossed the cutoff.
                lifecycle.assert_editable(sheet, lifecycle.beijing_now())
                for target in getattr(g, 'daily_task_targets', []):
                    lifecycle.assert_editable(target, lifecycle.beijing_now())
                if plan_service:
                    plan_service.db.stamp_events()
                    checked_at = plan_service.db.now()
                    for target in [sheet, *nonorder_targets]:
                        lifecycle.assert_editable(target, checked_at)
            result['sheet'] = lifecycle.metadata(sheet, lifecycle.beijing_now())
            connection.commit()
            return output(result, cursor)
        except (ValueError, RuleError) as exc:
            if connection:
                connection.rollback()
            status = exc.status if isinstance(exc, RuleError) else 400
            return jsonify({'code': status, 'msg': str(exc)}), status
        except Exception:
            if connection:
                connection.rollback()
            current_app.logger.exception('daily station tasks failed')
            return jsonify({'code': 503, 'msg': '工站每日任务读取或保存失败，请稍后重试'}), 503
        finally:
            if cursor:
                if nonorder_locked:
                    nonorder.release(cursor)
                if locked:
                    cursor.execute("SELECT RELEASE_LOCK('jml_pmc_daily_tasks')")
                    cursor.fetchone()
                cursor.close()
            if connection:
                connection.close()

    @blueprint.get('/api/mo/daily-tasks')
    def get_tasks():
        if request.args.get('view') == 'sheets':
            return sheets()
        return run()

    @blueprint.get('/api/mo/daily-tasks/export')
    def download():
        return run()

    @blueprint.post('/api/mo/daily-tasks/save')
    def save():
        body = request.get_json(silent=True)
        if isinstance(body, dict) and body.get('action') == 'create':
            return sheets(True)
        return run(True)

    return blueprint


def target_sheet(cursor, day):
    sheet, _ = lifecycle.create_sheet(cursor, day, g.audit_username, lifecycle.beijing_now())
    lifecycle.assert_editable(sheet, lifecycle.beijing_now())
    g.daily_task_targets = [*getattr(g, 'daily_task_targets', []), sheet]
    return sheet['id']


def insert_header(cursor, day, dept, sheet_id=None, ignore=False):
    verb = 'INSERT IGNORE' if ignore else 'INSERT'
    if sheet_id:
        cursor.execute(f'{verb} INTO mo_daily_task_yx (sheet_id,work_date,dept_name,created_by) VALUES (%s,%s,%s,%s)',
                       (sheet_id, day, dept, g.audit_username))
    else:
        cursor.execute(f'{verb} INTO mo_daily_task_yx (work_date,dept_name,created_by) VALUES (%s,%s,%s)',
                       (day, dept, g.audit_username))
    return cursor.lastrowid


def save_sheet_batch(cursor, body, selected_date, items, actuals, pool, snapshot, today):
    """One visible sheet spans departments; all department batches share a transaction."""
    batches = body.get('batches')
    if not isinstance(batches, list) or len(batches) > 200:
        raise ValueError('安排单明细无效')
    departments = [b.get('dept_name') for b in batches if isinstance(b, dict)]
    if len(departments) != len(batches) or any(not isinstance(d, str) or not d.strip() for d in departments):
        raise ValueError('明细所属部门无效')
    if len(set(departments)) != len(departments):
        raise ValueError('安排单部门重复')
    cursor.execute("SELECT dept_name,revision FROM mo_daily_task_yx WHERE work_date=%s AND dept_name<>''"
                   + (" AND sheet_id=%s" if body.get('sheet_id') else "") + " FOR UPDATE",
                   (selected_date, body['sheet_id']) if body.get('sheet_id') else (selected_date,))
    revisions = {h['dept_name']: h['revision'] for h in cursor.fetchall()}
    if not set(revisions).issubset(departments):
        raise ValueError('安排单已增加部门，请刷新核对，本地草稿已保留')
    for batch in batches:
        if batch.get('revision') != revisions.get(batch['dept_name'], 0):
            raise ValueError('安排单已被修改，请刷新核对，本地草稿已保留')
    for batch in batches:
        save_batch(cursor, dict(batch, sheet_id=body.get('sheet_id')), selected_date, items, actuals, pool, snapshot, today)
        items = load_items(cursor)
        if body.get('sheet_id'):
            items = [i for i in items if i['result_cutoff'] > lifecycle.beijing_now()]
            actuals = lifecycle.allocate_actuals(items, {k: v for k, v in actuals.items() if k[0] not in ('item', '_allocated')}, key)


def save_batch(cursor, body, selected_date, items, actuals, pool, snapshot, today):
    """Validate the final draft, then commit all edits/transfers in the caller's transaction.

    Client negative IDs identify new rows only. Identities, actuals, transferred totals,
    capacity/availability and all source snapshots remain server-owned.
    """
    dept = str(body.get('dept_name') or '').strip()
    rows, carries = body.get('items'), body.get('carries', [])
    if not dept or len(dept) > 100 or type(body.get('revision')) is not int:
        raise ValueError('部门或任务版本无效')
    if not isinstance(rows, list) or not isinstance(carries, list) or len(rows) > 2000 or len(carries) > 500:
        raise ValueError('本地草稿格式无效或任务过多')
    if type(body.get('publish', False)) is not bool:
        raise ValueError('发布参数无效')
    cursor.execute('SELECT * FROM mo_daily_task_yx WHERE work_date=%s AND dept_name=%s'
                   + (' AND sheet_id=%s' if body.get('sheet_id') else '') + ' FOR UPDATE',
                   (selected_date, dept, body['sheet_id']) if body.get('sheet_id') else (selected_date, dept))
    header = cursor.fetchone()
    if body['revision'] != (header['revision'] if header else 0):
        raise ValueError('服务器任务已被修改，未保存任何修改；本地草稿保留，请刷新核对或放弃本地修改后重做')
    old = {i['id']: i for i in items if header and i['task_id'] == header['id']}
    source_map = {key(p, False): p for p in pool}
    final, identities, affected = {}, set(), set()

    def fail(row, message):
        raise ValueError(f'{row.get("mo_code", "任务")} · 第{row.get("sort_seq", "?")}行 · 工序{row.get("seq", "?")}：{message}')

    for row in rows:
        if not isinstance(row, dict) or type(row.get('id')) is not int or row['id'] == 0 or row['id'] in final:
            raise ValueError('草稿任务标识无效或重复')
        previous = old.get(row['id'])
        if row['id'] > 0 and not previous:
            fail(row, '任务不属于此日期和部门，请刷新')
        if any(type(row.get(f)) is not int or row[f] <= 0 for f in ('sort_seq','route_id','seq','station_id')) or row.get('kind') not in {'normal','rework'} or not isinstance(row.get('mo_code'), str):
            fail(row, '工单、工序或工站无效')
        if previous and key(row) != key(previous):
            fail(row, '不能修改原任务的工单、工序或工站')
        if key(row) in identities:
            fail(row, '同一工站的任务重复')
        identities.add(key(row))
        if row.get('status') not in {'active','cancelled'} or type(row.get('sort_order')) is not int or not 0 <= row['sort_order'] <= 100000:
            fail(row, '状态或顺序无效')
        try:
            amount = positive_quantity(row.get('quantity'))
        except ValueError as exc:
            fail(row, str(exc))
        remark = str(row.get('remark') or '').strip()
        if len(remark) > 500:
            fail(row, '备注最多500字')
        source = source_map.get(key(row, False))
        check_supply = row['status'] == 'active' and (not previous or previous['status'] != 'active' or amount > qty(previous['quantity']))
        if check_supply:
            if selected_date < today:
                fail(row, '历史日期不能新增或增加安排')
            if not source or source['dept_name'] != dept or row['station_id'] not in source['allowed_station_ids']:
                fail(row, '工单已完成、关闭、路线变化或工站不可用，请刷新核对')
            affected.add(key(row,False))
        if not previous and (not source or source['dept_name'] != dept):
            fail(row, '工单工序已失效')
        final[row['id']] = {**(previous or {}), **{f:row[f] for f in ('id','mo_code','sort_seq','route_id','seq','station_id','kind','status','sort_order')},
                            'quantity':amount,'remark':remark,'transferred_qty':qty(previous['transferred_qty']) if previous else ZERO,
                            'work_date':selected_date,'dept_name':dept,
                            'snapshot': previous['snapshot'] if previous else json_data(source)}
    if not set(old).issubset(final):
        raise ValueError('草稿缺少已有任务；请使用取消保留记录，或刷新核对')

    targets, transfer_events = {}, []
    for transfer in carries:
        if not isinstance(transfer,dict) or type(transfer.get('id')) is not int or transfer['id'] not in final:
            raise ValueError('结转来源任务无效')
        origin = final[transfer['id']]
        target_date = work_date(transfer.get('target_date'))
        if origin['status'] != 'active' or target_date <= selected_date or target_date < today:
            fail(origin, '结转任务或日期无效')
        amount = positive_quantity(transfer.get('quantity'))
        actual = lifecycle.actual_for(actuals, dict(origin, work_date=selected_date), key)
        if amount > remaining(origin,actual):
            fail(origin, '结转量超过最新未完成数量')
        source = source_map.get(key(origin,False))
        if not source or source['dept_name'] != dept or origin['station_id'] not in source['allowed_station_ids']:
            fail(origin, '工单或工序已变化，不能结转')
        if target_date not in targets:
            target_id = target_sheet(cursor, target_date) if body.get('sheet_id') else None
            cursor.execute('SELECT * FROM mo_daily_task_yx WHERE work_date=%s AND dept_name=%s'
                           + (' AND sheet_id=%s' if target_id else '') + ' FOR UPDATE',
                           (target_date,dept,target_id) if target_id else (target_date,dept))
            target_header = cursor.fetchone()
            targets[target_date] = {'sheet_id':target_id, 'header':target_header, 'items':{}, 'revision':target_header['revision'] if target_header else 0}
        target = targets[target_date]
        if type(transfer.get('target_revision')) is not int or transfer['target_revision'] != target['revision']:
            fail(origin, f'{target_date}目标任务已变化，请刷新核对，本地草稿已保留')
        if target['header'] and target['header']['status'] != 'draft':
            fail(origin, f'{target_date}已发布，不能直接结转')
        group = key(origin)
        if group not in target['items']:
            existing = next((i for i in items if target['header'] and i['task_id']==target['header']['id'] and key(i)==group),None)
            if existing and existing['status']!='active':
                fail(origin, '目标日期该任务已取消，请先核对目标安排')
            target['items'][group] = {**(existing or origin), 'id':existing['id'] if existing else None,
                                       'quantity':qty(existing['quantity']) if existing else ZERO,
                                       'transferred_qty':qty(existing['transferred_qty']) if existing else ZERO,
                                       'work_date':target_date,'before':existing}
        target['items'][group]['quantity'] += amount
        origin['transferred_qty'] += amount
        affected.add(key(origin,False))
        transfer_events.append((origin['id'],target_date,group,amount))

    for item in final.values():
        previous = old.get(item['id'])
        actual = lifecycle.actual_for(actuals, dict(item, work_date=selected_date), key)
        if item['status']=='active' and (not previous or item['quantity']!=previous['quantity'] or item['transferred_qty']!=previous['transferred_qty'] or previous['status']!='active'):
            if item['quantity'] < qty(actual.get('done')) + item['transferred_qty']:
                fail(item,'安排量小于最新已完工与已转出数量之和，请调整数量')
    target_rows = [i for target in targets.values() for i in target['items'].values()]
    changed_ids = set(old) | {i['id'] for i in target_rows if i['id']}
    all_final = [i for i in items if i['id'] not in changed_ids] + list(final.values()) + target_rows
    if body.get('publish'):
        for item in final.values():
            if remaining(item,lifecycle.actual_for(actuals, dict(item, work_date=selected_date), key))>0:
                source=source_map.get(key(item,False))
                if not source or item['station_id'] not in source['allowed_station_ids']:
                    fail(item,'最新可安排量或工站已变化，请核对后发布')
                affected.add(key(item,False))
    for group in affected:
        source = source_map[group]
        group_rows = [i for i in all_final if key(i,False)==group and remaining(i,lifecycle.actual_for(actuals, i, key))>0]
        total = sum((remaining(i,lifecycle.actual_for(actuals, i, key)) for i in group_rows),ZERO)
        if total > source['maximum']:
            fail(source, f'最新可安排余量{source["maximum"]}，各日期合计占用{total}，请减少安排')
        if len({i['station_id'] for i in group_rows})>1:
            fail(source,'同一工序不能同时占用多个工站，请取消或修改重复安排')
    if body.get('publish'):
        active = [i for i in final.values() if i['status']=='active']
        if not active or selected_date<today:
            raise ValueError('没有可发布任务或日期已过')
        valid = {(o['mo_code'],o['sort_seq'],o['route_id'],s['seq']) for o in snapshot['orders'] if not o.get('is_closed') and not o.get('erp_deleted') for s in o['steps']}
        for item in active:
            if (item['mo_code'],item['sort_seq'],item['route_id'],item['seq']) not in valid:
                fail(item,'工单关闭、删除或路线变化，不能发布')

    # All final quantities and both ends of every carry have passed validation.
    def create_header(day):
        return insert_header(cursor, day, dept, body.get('sheet_id') if day == selected_date else targets[day].get('sheet_id'))

    task_id = header['id'] if header else create_header(selected_date)
    ids = {}
    def write_item(item, parent, previous):
        if previous:
            cursor.execute('UPDATE mo_daily_task_item_yx SET quantity=%s,remark=%s,status=%s,sort_order=%s,transferred_qty=%s WHERE id=%s',
                           (item['quantity'],item['remark'],item['status'],item['sort_order'],item['transferred_qty'],previous['id']))
            return previous['id']
        cursor.execute('''INSERT INTO mo_daily_task_item_yx
            (task_id,mo_code,sort_seq,route_id,seq,kind,station_id,quantity,sort_order,remark,snapshot,status,transferred_qty)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
            (parent,*key(item),item['quantity'],item['sort_order'],item['remark'],item['snapshot'],item['status'],item['transferred_qty']))
        return cursor.lastrowid

    for client_id,item in final.items():
        previous = old.get(client_id)
        if previous and all(item[f]==previous[f] for f in ('quantity','remark','status','sort_order','transferred_qty')):
            ids[client_id]=client_id
            continue
        ids[client_id]=write_item(item,task_id,previous)
        action = 'add' if not previous else 'cancel' if item['status']=='cancelled' else 'restore' if previous['status']=='cancelled' else 'edit'
        if previous and action=='edit' and all(item[f]==previous[f] for f in ('quantity','remark','status','transferred_qty')):
            action='reorder'
        record_change(cursor,task_id,ids[client_id],action,previous,item)
    for day,target in targets.items():
        target_id = target['header']['id'] if target['header'] else create_header(day)
        target['id']=target_id
        for item in target['items'].values():
            item['saved_id']=write_item(item,target_id,item['before'])
        cursor.execute('UPDATE mo_daily_task_yx SET revision=revision+1 WHERE id=%s',(target_id,))
    for origin_id,day,group,amount in transfer_events:
        target = targets[day]
        dest_id=target['items'][group]['saved_id']
        record_change(cursor,task_id,ids[origin_id],'carry',None,{'quantity':amount,'target_date':str(day)},dest_id)
        record_change(cursor,target['id'],dest_id,'carry_in',None,{'quantity':amount,'source_id':ids[origin_id]},ids[origin_id])
    cursor.execute('UPDATE mo_daily_task_yx SET revision=revision+1 WHERE id=%s',(task_id,))
    if body.get('publish'):
        cursor.execute("UPDATE mo_daily_task_yx SET status='published',published_by=%s,published_at=NOW() WHERE id=%s",(g.audit_username,task_id))
        record_change(cursor,task_id,None,'publish',None,{'date':str(selected_date)})


def mutate(cursor, body, selected_date, items, actuals, pool, snapshot, today):
    action = body.get('action')
    if action not in {'add', 'edit', 'cancel', 'reorder', 'publish', 'carry'}:
        raise ValueError('操作无效')
    if action == 'add':
        if not isinstance(body.get('mo_code'), str) or not body['mo_code'].strip():
            raise ValueError('工单无效')
        if any(type(body.get(field)) is not int or body[field] <= 0 for field in ('sort_seq','route_id','seq','station_id')):
            raise ValueError('工单行、路线、工序或工站无效')
        if body.get('kind') not in {'normal','rework'}:
            raise ValueError('任务类型无效')
    if type(body.get('revision')) is not int or body['revision'] < 0:
        raise ValueError('任务版本无效，请刷新')
    dept = str(body.get('dept_name') or '').strip()
    if not dept or len(dept) > 100:
        raise ValueError('请选择生产部门')
    cursor.execute('SELECT * FROM mo_daily_task_yx WHERE work_date=%s AND dept_name=%s'
                   + (' AND sheet_id=%s' if body.get('sheet_id') else '') + ' FOR UPDATE',
                   (selected_date, dept, body['sheet_id']) if body.get('sheet_id') else (selected_date, dept))
    header = cursor.fetchone()
    if int(body.get('revision') or 0) != (header['revision'] if header else 0):
        raise ValueError('任务已被其他人员修改，请刷新后重试')
    if not header:
        if action != 'add':
            raise ValueError('请先添加任务')
        header_id = insert_header(cursor, selected_date, dept, body.get('sheet_id'))
        header = {'id': header_id, 'revision': 1, 'status': 'draft'}
    task_id = header['id']
    selected = next((i for i in items if i['id'] == body.get('id') and i['task_id'] == task_id), None)
    if action in {'edit', 'cancel', 'carry'} and (not selected or selected['status'] != 'active'):
        raise ValueError('任务不存在或已取消，请刷新')
    before = dict(selected) if selected else None
    related = None
    item_id = selected['id'] if selected else None
    if action in {'add', 'edit'}:
        if selected_date < today:
            raise ValueError('历史任务不能新增或修改数量，可取消或结转余量')
        identity = selected if selected else body
        source = next((p for p in pool if key(p, False) == key(identity, False)), None)
        if not source or source['dept_name'] != dept:
            raise ValueError('工单工序已完成、关闭或发生变化，请刷新待安排区')
        station = int(identity.get('station_id') or 0)
        if station not in source['allowed_station_ids']:
            raise ValueError('此工序不能安排到该工站，已接收任务不可换站')
        if any(i['status']=='active' and key(i,False)==key(source,False) and i['station_id']!=station
               and remaining(i,lifecycle.actual_for(actuals, i, key)) > 0 for i in items):
            raise ValueError('同一工序还有其他工站的未完成安排，请先核对或取消原任务')
        duplicate = next((i for i in items if i['task_id'] == task_id and key(i) == key(identity)), None)
        if action == 'add' and duplicate:
            if duplicate['status'] != 'cancelled':
                raise ValueError('当天已有此任务，请双击任务修改数量')
            selected = duplicate
            item_id = duplicate['id']
            before = dict(duplicate)
            action = 'restore'
        actual = lifecycle.actual_for(actuals, dict(identity, work_date=selected_date), key)
        transferred = qty(selected.get('transferred_qty')) if selected else ZERO
        others = sum((remaining(i, lifecycle.actual_for(actuals, i, key))
                      for i in items if key(i, False) == key(source, False) and i['id'] != item_id), ZERO)
        if body.get('auto_quantity') is True and action in {'add', 'restore'}:
            available = max(ZERO, source['maximum'] - others)
            if available <= 0:
                raise ValueError('当前没有可安排余量，请刷新后核对')
            quantity = positive_quantity(available + qty(actual.get('done')) + transferred)
        else:
            quantity = positive_quantity(body.get('quantity'))
        if quantity < qty(actual.get('done')) + transferred:
            raise ValueError('安排数量不能小于当天已完工与已转出数量之和')
        needed = max(ZERO, quantity - qty(actual.get('done')) - transferred)
        if needed + others > source['maximum']:
            raise ValueError(f'超过可安排余量；其他任务占用{others}，本次最多安排{max(ZERO,source["maximum"]-others)+qty(actual.get("done"))+transferred}')
        remark = str(body.get('remark', selected.get('remark') if selected else '') or '').strip()
        if len(remark) > 500:
            raise ValueError('备注最多500字')
        if selected:
            cursor.execute("UPDATE mo_daily_task_item_yx SET quantity=%s,remark=%s,status='active' WHERE id=%s", (quantity, remark, item_id))
        else:
            cursor.execute('''INSERT INTO mo_daily_task_item_yx
                (task_id,mo_code,sort_seq,route_id,seq,station_id,kind,quantity,sort_order,remark,snapshot)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
                (task_id, source['mo_code'], source['sort_seq'], source['route_id'], source['seq'], station,
                 source['kind'], quantity, max([i['sort_order'] for i in items if i['task_id']==task_id]+[0])+1,
                 remark, json_data(source)))
            item_id = cursor.lastrowid
    elif action == 'cancel':
        cursor.execute("UPDATE mo_daily_task_item_yx SET status='cancelled' WHERE id=%s", (item_id,))
    elif action == 'publish':
        active = [i for i in items if i['task_id'] == task_id and i['status'] == 'active']
        if not active:
            raise ValueError('没有可发布任务')
        if selected_date < today:
            raise ValueError('历史日期不能发布新安排')
        valid = {(o['mo_code'], o['sort_seq'], o['route_id'],s['seq']) for o in snapshot['orders']
                 if not o.get('is_closed') and not o.get('erp_deleted') for s in o['steps']}
        if any((i['mo_code'],i['sort_seq'],i['route_id'],i['seq']) not in valid for i in active):
            raise ValueError('存在关闭、删除或路线变化的工单，请先取消异常任务')
        cursor.execute("UPDATE mo_daily_task_yx SET status='published',published_by=%s,published_at=NOW() WHERE id=%s",
                       (g.audit_username, task_id))
    elif action == 'reorder':
        ids = body.get('ids')
        station = int(body.get('station_id') or 0)
        expected = {i['id'] for i in items if i['task_id'] == task_id and i['station_id'] == station and i['status'] == 'active'}
        if not isinstance(ids, list) or len(ids) != len(set(ids)) or set(ids) != expected:
            raise ValueError('工站任务已变化，请刷新后排序')
        before = [i['id'] for i in items if i['id'] in expected]
        for rank, identity in enumerate(ids, 1):
            cursor.execute('UPDATE mo_daily_task_item_yx SET sort_order=%s WHERE id=%s', (rank, identity))
    elif action == 'carry':
        target_date = work_date(body.get('target_date'))
        if target_date <= selected_date or target_date < today:
            raise ValueError('结转日期须晚于原日期，且不能早于今天')
        amount = positive_quantity(body.get('quantity'))
        actual = lifecycle.actual_for(actuals, dict(selected, work_date=selected_date), key)
        if amount > remaining(selected, actual):
            raise ValueError('结转数量超过当前未完成余量，请刷新')
        source = next((p for p in pool if key(p, False) == key(selected, False)), None)
        if not source or selected['station_id'] not in source['allowed_station_ids']:
            raise ValueError('工单或工序已变化，不能结转')
        others = sum((remaining(i, lifecycle.actual_for(actuals, i, key))
                      for i in items if key(i, False) == key(selected, False) and i['id'] != item_id), ZERO)
        if amount + others > source['maximum']:
            raise ValueError('实际余量不足，可能已经在其他日期生产，请先核对')
        target_id = target_sheet(cursor, target_date) if body.get('sheet_id') else None
        insert_header(cursor, target_date, dept, target_id, ignore=True)
        cursor.execute('SELECT * FROM mo_daily_task_yx WHERE work_date=%s AND dept_name=%s'
                       + (' AND sheet_id=%s' if target_id else '') + ' FOR UPDATE',
                       (target_date, dept, target_id) if target_id else (target_date, dept))
        target = cursor.fetchone()
        if target['status'] != 'draft':
            raise ValueError('目标日期已发布，请先在目标日期处理安排，避免结转直接改变已发布任务')
        cursor.execute('''SELECT * FROM mo_daily_task_item_yx WHERE task_id=%s AND mo_code=%s
            AND sort_seq=%s AND route_id=%s AND seq=%s AND kind=%s AND station_id=%s''', (target['id'], *key(selected)))
        existing = cursor.fetchone()
        if existing and existing['status'] != 'active':
            raise ValueError('目标日期该任务已取消，请选择其他日期')
        if existing:
            related = existing['id']
            cursor.execute('UPDATE mo_daily_task_item_yx SET quantity=quantity+%s WHERE id=%s', (amount, related))
        else:
            cursor.execute('''INSERT INTO mo_daily_task_item_yx
                (task_id,mo_code,sort_seq,route_id,seq,kind,station_id,quantity,sort_order,remark,snapshot)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
                (target['id'], *key(selected), amount, selected['sort_order'], selected['remark'], json_data(source)))
            related = cursor.lastrowid
        cursor.execute('UPDATE mo_daily_task_item_yx SET transferred_qty=transferred_qty+%s WHERE id=%s', (amount, item_id))
        cursor.execute('UPDATE mo_daily_task_yx SET revision=revision+1 WHERE id=%s', (target['id'],))
        record_change(cursor, target['id'], related, 'carry_in', existing, {'quantity': amount, 'source_id': item_id}, item_id)
    cursor.execute('UPDATE mo_daily_task_yx SET revision=revision+1 WHERE id=%s', (task_id,))
    after = body
    if item_id:
        cursor.execute('SELECT * FROM mo_daily_task_item_yx WHERE id=%s', (item_id,))
        after = cursor.fetchone()
    record_change(cursor, task_id, item_id, action, before, after, related)
    return {'id': item_id, 'revision': header['revision'] + 1}


def record_change(cursor, task_id, item_id, action, before, after, related=None):
    cursor.execute('''INSERT INTO mo_daily_task_change_yx
        (task_id,item_id,related_item_id,action,before_data,after_data,actor)
        VALUES (%s,%s,%s,%s,%s,%s,%s)''',
        (task_id, item_id, related, action, json_data(before), json_data(after), g.audit_username))


def task_sheet_table(data):
    """Build one ordered table for Excel and print, including workorder station groups."""
    identity = data.get('sheet', {})
    title = '补充安排' if identity.get('sheet_kind') == 'supplement' else '任务安排'
    day_export = data.get('export_scope') == 'day'
    heading = f'当日任务安排 · {data["date"]}' if day_export else f'{title} #{identity.get("id", "")} · {data["date"]}'
    source_column = ['派单类型'] if day_export else []
    headers = ['生产线名称', '开线状态', '计划数量', '备注', '工单号', *source_column]
    rows = []
    stations = {s['id']: s for s in data['stations']}
    groups = defaultdict(list)
    for item in data['items']:
        if item['status'] == 'active':
            groups[item['station_id'], item.get('export_station_name')].append(item)
    for (station_id, saved_station_name), items in groups.items():
        station = stations.get(station_id, {})
        name = saved_station_name or station.get('station_name') or str(station_id)
        if not saved_station_name and station.get('leader_name'):
            name += '\n' + station['leader_name']
        for index, item in enumerate(items):
            actual = item['actual']
            done = qty(actual.get('done'))
            status = ('已完成' if done >= qty(item['quantity']) else
                      '已开工' if done > 0 or qty(actual.get('received')) > 0 else '未开工')
            order = (f'{item["mo_code"]} · 第{item["sort_seq"]}行\n'
                     f'料号：{item.get("inv_code") or "—"}\n'
                     f'描述：{item.get("inv_name") or "—"}')
            source = [f'任务派单\n{item["export_sheet_label"]}'] if day_export else []
            rows.append({
                'values': [name, status, float(item['quantity']), item.get('remark') or '', order, *source],
                'station_span': len(items) if index == 0 else 0,
                'unit': (item.get('unit_name') or '').replace('"', ''),
                'status_color': {'未开工': '666666', '已开工': '1565C0', '已完成': '237804'}[status],
            })
    nonorder_rows = [row for row in (data.get('nonorder') or {}).get('items', [])
                     if not row.get('cancelled_at') and row['status'] in {'draft', 'published'}]
    for row in sorted(nonorder_rows, key=lambda item: (item['group']['type'] != 'station', item['group']['name'], item['sort_order'], item['id'])):
        production_line = row['group']['name'] if row['group']['type'] == 'station' else '无工站'
        if leader := row['task'].get('responsible_name'):
            production_line += '\n' + leader
        published = row['status'] == 'published'
        remark = f'执行人：{row["assignment"]["staff_name"]}\n个人职责：{row["assignment"]["responsibility"]}'
        if row.get('remark'):
            remark += f'\n安排备注：{row["remark"]}'
        source = [f'无工单排单\n{row["export_sheet_label"]}'] if day_export else []
        rows.append({
            'values': [production_line, '已发布' if published else '未发布', None, remark, row['division']['content'], *source],
            'station_span': 1, 'unit': '', 'status_color': '237804' if published else '666666',
        })
    return {'title': heading, 'headers': headers, 'rows': rows}


def export_excel(data):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter

    table = task_sheet_table(data)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = '任务安排'
    column_count = len(table['headers'])
    last_column = get_column_letter(column_count)
    sheet.append([table['title']])
    sheet.merge_cells(f'A1:{last_column}1')
    sheet['A1'].font = Font(size=14, bold=True, color='17365D')
    sheet.row_dimensions[1].height = 30
    sheet.append(table['headers'])
    merges = []
    for row in table['rows']:
        sheet.append(row['values'])
        number = sheet.max_row
        # Keep user-entered text, including leading '=', as literal cells.
        for cell in sheet[number]:
            if isinstance(cell.value, str):
                cell.data_type = 's'
        if row['values'][2] is not None:
            unit = row['unit']
            sheet.cell(number, 3).number_format = '#,##0.####' + (f'" {unit}"' if unit else '')
        sheet.cell(number, 2).font = Font(bold=True, color=row['status_color'])
        if row['station_span'] > 1:
            merges.append((number, number + row['station_span'] - 1))
    for start, end in merges:
        sheet.merge_cells(start_row=start, start_column=1, end_row=end, end_column=1)
    sheet.freeze_panes = 'A3'
    sheet.auto_filter.ref = f'A2:{last_column}{sheet.max_row}'
    for cell in sheet[2]:
        cell.fill = PatternFill('solid', fgColor='D9EAF7')
        cell.font = Font(color='17365D', bold=True)
    sheet.row_dimensions[2].height = 26
    widths = (24, 16, 18, 42, 42, 20)[:column_count]
    for index, width in enumerate(widths, 1):
        sheet.column_dimensions[get_column_letter(index)].width = width
    for row in sheet.iter_rows(min_row=3, max_row=sheet.max_row, max_col=column_count):
        for cell in row:
            cell.alignment = Alignment(vertical='center',wrap_text=True)
        sheet.row_dimensions[row[0].row].height = max(48, 16 * max(
            len(str(cell.value or '').splitlines()) + len(str(cell.value or '')) // 28 for cell in row))
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.page_setup.orientation = 'landscape'
    sheet.page_setup.paperSize = sheet.PAPERSIZE_A4
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    sheet.print_title_rows = '1:2'
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return send_file(output, as_attachment=True, download_name=f'工站每日任务_{data["date"]}.xlsx',
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
