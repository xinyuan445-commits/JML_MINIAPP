"""Reuse the web dashboard's quantity model, then redact by station scope."""
import logging
import math
import os
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError
import requests

from services.mo_dashboard_snapshot import (
    build_operations_snapshot,
    include_unreported_orders,
    tracked_order_rows,
)
from services.mo_operation_log import write_operation_log

logger = logging.getLogger(__name__)
PRODUCTION_STATUS_BATCH_URL = os.getenv(
    'MO_PRODUCTION_STATUS_BATCH_URL',
    'https://api.jinmilong.cn/api/mo/workorder/production-status/batch',
)
PANEL_DEPARTMENT = '拼皮线'
PANEL_SYNC_OPERATOR_ID = 'SYSTEM:PANEL_SYNC'
FILL_PANEL_PLAN_SQL = """
    INSERT INTO mo_workorder_context_yx (mo_code,sort_seq,plan_qty)
    VALUES (%s,%s,%s)
    ON DUPLICATE KEY UPDATE plan_qty=COALESCE(plan_qty,VALUES(plan_qty))
"""


def step_visible(scope, records, handover, configured_station_ids=()):
    return scope['kind'] == 'all' or (scope['kind'] == 'station' and (
        (bool(records) and all(r.get('station_id') in scope['station_ids'] for r in records))
        or (not records and handover.get('to_station_id') in scope['station_ids'])
        or (not records and not handover and any(
            station_id in scope['station_ids'] for station_id in configured_station_ids
        ))))


def first_material_keys(data, scope):
    """Only query first stations visible to this viewer; personal totals exclude ERP balances."""
    keys = set()
    step_stations = {}
    for row in data.get('step_stations', []):
        step_stations.setdefault(
            (int(row['route_id']), int(row['seq'])), []
        ).append(row['station_id'])
    for tracked in tracked_order_rows(data):
        key = (str(tracked['mo_code']), int(tracked['sort_seq']), int(tracked['route_id']))
        records = [r for r in data.get('executions', [])
                   if (str(r['mo_code']), int(r['sort_seq']), int(r['route_id'])) == key]
        handovers = [h for h in data.get('handovers', [])
                    if (str(h['mo_code']), int(h['sort_seq']), int(h['route_id'])) == key]
        seqs = [int(s['seq']) for s in data.get('steps', []) if int(s['route_id']) == key[2]]
        seqs += [int(r['seq']) for r in records] + [int(h['to_seq']) for h in handovers]
        first = min(seqs, default=1)
        incoming = max((h for h in handovers if int(h['to_seq']) == first), key=lambda h: h['id'], default={})
        if step_visible(
            scope,
            [r for r in records if int(r['seq']) == first],
            incoming,
            step_stations.get((key[2], first), []),
        ):
            keys.add(key[:2])
    return keys


def read_first_issue_context(key):
    # Reuse the existing pure calculation, NOT _fetch_workorder_detail which can persist context.
    from routes.mo import MO_WORKORDER_DETAIL_URL, _first_step_order_materials
    response = requests.get(MO_WORKORDER_DETAIL_URL, params={'mo_code': key[0], 'sort_seq': key[1]}, timeout=(2, 5))
    response.raise_for_status()
    payload = response.json()
    data = payload.get('data') or {}
    header = data.get('header') or {}
    if (payload.get('code') != 0 or not isinstance(data.get('components'), list)
            or str(header.get('MoCode_a')) != key[0] or str(header.get('SortSeq_b')) != str(key[1])):
        raise ValueError('Invalid ERP material response')
    lines, issued, calculation = _first_step_order_materials(data)
    if not lines:
        raise ValueError('No ERP material basis')
    if not math.isfinite(issued):
        raise ValueError('Invalid ERP material quantity')
    return {'issued_qty': issued, 'calculation': calculation}


def read_first_issued_qty(key):
    return read_first_issue_context(key)['issued_qty']


def read_production_statuses(keys):
    response = requests.post(
        PRODUCTION_STATUS_BATCH_URL,
        json={'items': [
            {'mo_code': key[0], 'sort_seq': key[1]}
            for key in sorted(keys)
        ]},
        timeout=(2, 12),
    )
    response.raise_for_status()
    payload = response.json()
    rows = payload.get('data')
    if payload.get('code') != 0 or not isinstance(rows, list):
        raise ValueError('Invalid ERP production status response')
    result = {}
    for row in rows:
        key = (str(row.get('mo_code') or ''), int(row.get('sort_seq') or 0))
        if key not in keys:
            continue
        result[key] = row
    return result


def load_first_materials(products, keys):
    keys = [key for key in keys if products.get(key, {}).get('erp_open')]
    if not keys:
        return
    try:
        statuses = read_production_statuses(set(keys))
        for key, row in statuses.items():
            product = products[key]
            calculation = row.get('first_issue_calculation')
            dept_code = str(row.get('department_code') or '').strip()
            is_panel = dept_code == '04125' or (not dept_code and row.get('department_name') == PANEL_DEPARTMENT)
            if not is_panel or (calculation or {}).get('mode') == 'panel_area':
                product['first_issued_qty'] = row.get('first_issued_qty')
                product['first_issue_calculation'] = calculation
            product['panel_department'] = row.get('department_name') or ''
            product['panel_cut_start_time'] = row.get('cut_start_time')
            product['panel_receipt_qty'] = row.get('receipt_qty')
            product['panel_receipt_end_time'] = row.get('receipt_end_time')
        return
    except Exception:
        logger.warning('Mobile dashboard batch production status read unavailable')
    executor = ThreadPoolExecutor(max_workers=4)
    futures = {executor.submit(read_first_issue_context, key): key for key in keys}
    try:
        for future in as_completed(futures, timeout=12):
            try:
                result = future.result()
                products[futures[future]]['first_issued_qty'] = result['issued_qty']
                products[futures[future]]['first_issue_calculation'] = result['calculation']
            except Exception:
                # Unknown stays null. A failed read must never become zero or a cached balance.
                logger.warning('Mobile dashboard first-station material read unavailable')
    except TimeoutError:
        logger.warning('Mobile dashboard material query deadline exceeded')
    finally:
        for future in futures:
            future.cancel()
        executor.shutdown(wait=False, cancel_futures=True)


def panel_sync_candidates(data, products):
    states = {
        (str(row['mo_code']), int(row['sort_seq'])): row
        for row in data.get('states', [])
    }
    route_steps = {}
    for row in data.get('steps', []):
        route_steps.setdefault(int(row['route_id']), []).append(row)
    step_stations = {}
    for row in data.get('step_stations', []):
        step_stations.setdefault(
            (int(row['route_id']), int(row['seq'])), []
        ).append(row['station_id'])
    candidates = []
    for key, product in products.items():
        if (product.get('panel_department') or '').strip() != PANEL_DEPARTMENT:
            continue
        if not product.get('panel_cut_start_time'):
            continue
        state = states.get(key)
        route_id = int(state.get('route_id') or 0) if state else 0
        steps = sorted(route_steps.get(route_id, []), key=lambda row: int(row['seq']))
        if route_id <= 0 or len(steps) != 1:
            continue
        step = steps[0]
        stations = step_stations.get((route_id, int(step['seq'])), [])
        try:
            plan_qty = float(product.get('plan_qty') or 0)
        except (TypeError, ValueError):
            plan_qty = 0
        candidates.append({
            'mo_code': key[0],
            'sort_seq': key[1],
            'route_id': route_id,
            'seq': int(step['seq']),
            'process_id': step.get('process_id'),
            'process_name': step.get('process_name') or '',
            'station_id': stations[0] if len(stations) == 1 else None,
            'start_time': product['panel_cut_start_time'],
            'receipt_qty': max(0, float(product.get('panel_receipt_qty') or 0)),
            'receipt_end_time': product.get('panel_receipt_end_time'),
            'issued_qty': max(0, float(product.get('first_issued_qty') or 0)),
            'plan_qty': plan_qty if math.isfinite(plan_qty) and plan_qty > 0 else 0,
        })
    return candidates


def sync_panel_reporting(conn, data, products):
    """Backfill only exact 拼皮线 external facts; manual reporting always wins."""
    candidates = panel_sync_candidates(data, products)
    if not candidates:
        return 0
    cur = conn.cursor(dictionary=True)
    changed = 0
    try:
        for item in candidates:
            marker = f"panel-sync:start:{item['mo_code']}:{item['sort_seq']}"
            cur.execute("""
                SELECT e.id,e.qty_done,e.status,log.source_id AS sync_source_id
                FROM mo_execution_yx e
                LEFT JOIN mo_operation_log_yx log ON log.event_key=%s
                WHERE e.mo_code=%s AND e.sort_seq=%s
                ORDER BY e.id LIMIT 1 FOR UPDATE
            """, (marker, item['mo_code'], item['sort_seq']))
            execution = cur.fetchone()
            if execution and int(execution.get('sync_source_id') or 0) != int(execution['id']):
                continue
            if not execution:
                cur.execute("""
                    SELECT id FROM mo_handover_yx
                    WHERE mo_code=%s AND sort_seq=%s
                    ORDER BY id LIMIT 1 FOR UPDATE
                """, (item['mo_code'], item['sort_seq']))
                if cur.fetchone():
                    continue
                cur.execute("SELECT station_name FROM mo_workstation_yx WHERE id=%s", (item['station_id'],))
                station = cur.fetchone() or {}
                station_name = station.get('station_name') or ''
                cur.execute("""
                    INSERT IGNORE INTO mo_execution_yx
                      (mo_code,sort_seq,route_id,seq,process_id,station_id,
                       process_name,station_name,operator_id,operator_name,
                       qty_done,qty_a,qty_a1,qty_a2,qty_c,start_time,status)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,0,0,0,0,%s,'processing')
                """, (
                    item['mo_code'], item['sort_seq'], item['route_id'], item['seq'],
                    item['process_id'], item['station_id'], item['process_name'],
                    station_name or None, PANEL_SYNC_OPERATOR_ID, '木皮裁切同步',
                    item['start_time'],
                ))
                if cur.rowcount != 1:
                    continue
                execution_id = cur.lastrowid
                execution = {'id': execution_id, 'qty_done': 0, 'status': 'processing'}
                received = max(item['issued_qty'], item['receipt_qty'])
                cur.execute("""
                    INSERT INTO mo_handover_yx
                      (mo_code,sort_seq,route_id,from_seq,to_seq,to_station_id,
                       qty_out,qty_out_a,qty_out_a1,qty_out_a2,
                       qty_in,qty_in_a,qty_in_a1,qty_in_a2,
                       receipt_reason,operator_out,operator_in,status,confirm_time)
                    VALUES (%s,%s,%s,0,%s,%s,%s,%s,0,0,%s,%s,0,0,
                            %s,'ERP领料','木皮裁切同步','confirmed',%s)
                """, (
                    item['mo_code'], item['sort_seq'], item['route_id'], item['seq'],
                    item['station_id'], received, received, received, received,
                    '拼皮线自动同步', item['start_time'],
                ))
                cur.execute("""
                    INSERT INTO mo_wo_state_yx
                      (mo_code,sort_seq,route_id,current_seq,status)
                    VALUES (%s,%s,%s,%s,'processing')
                    ON DUPLICATE KEY UPDATE route_id=%s,current_seq=%s,status='processing'
                """, (
                    item['mo_code'], item['sort_seq'], item['route_id'], item['seq'],
                    item['route_id'], item['seq'],
                ))
                write_operation_log(
                    cur,
                    event_key=marker,
                    event_type='start',
                    event_name='开工（木皮裁切同步）',
                    occurred_at=item['start_time'],
                    operator_id=PANEL_SYNC_OPERATOR_ID,
                    operator_name='木皮裁切同步',
                    mo_code=item['mo_code'], sort_seq=item['sort_seq'],
                    route_id=item['route_id'], seq=item['seq'],
                    process_name=item['process_name'], station_id=item['station_id'],
                    station_name=station_name,
                    source_type='execution', source_id=execution_id,
                    details={'source': 'YX_TEST.MupiMaterialIssueItem_yx'},
                )
                changed += 1

            # Fill a missing snapshot even when the existing auto batch has no new output.
            if item['plan_qty'] > 0:
                cur.execute(FILL_PANEL_PLAN_SQL, (item['mo_code'], item['sort_seq'], item['plan_qty']))
                changed += int(cur.rowcount > 0)

            if not item['receipt_end_time'] or item['receipt_qty'] <= 0:
                continue
            execution_id = int(execution['id'])
            cur.execute("""
                SELECT COUNT(*) AS total FROM mo_execution_completion_yx
                WHERE execution_id=%s
                  AND COALESCE(operator_id,'')<>%s
            """, (execution_id, PANEL_SYNC_OPERATOR_ID))
            if int((cur.fetchone() or {}).get('total') or 0) > 0:
                continue
            completed = float(execution.get('qty_done') or 0)
            delta = item['receipt_qty'] - completed
            if delta > 0.0001:
                is_final = int(item['plan_qty'] > 0 and item['receipt_qty'] + 0.0001 >= item['plan_qty'])
                cur.execute("""
                    INSERT INTO mo_execution_completion_yx
                      (execution_id,qty_a,qty_a1,qty_a2,qty_c,qty_done,reason,
                       operator_id,operator_name,is_final,complete_time)
                    VALUES (%s,%s,0,0,0,%s,%s,%s,%s,%s,%s)
                """, (
                    execution_id, delta, delta, '拼皮线ERP入库自动同步',
                    PANEL_SYNC_OPERATOR_ID, 'ERP入库同步', is_final,
                    item['receipt_end_time'],
                ))
                completion_id = cur.lastrowid
                cur.execute("""
                    UPDATE mo_execution_yx
                    SET status='done',qty_done=%s,qty_a=%s,qty_a1=0,qty_a2=0,qty_c=0,
                        complete_reason=%s,complete_operator_id=%s,
                        complete_operator_name='ERP入库同步',end_time=%s
                    WHERE id=%s
                """, (
                    item['receipt_qty'], item['receipt_qty'], '拼皮线ERP入库自动同步',
                    PANEL_SYNC_OPERATOR_ID, item['receipt_end_time'], execution_id,
                ))
                state_status = 'done' if is_final else 'processing'
                cur.execute("""
                    UPDATE mo_wo_state_yx SET status=%s,current_seq=%s
                    WHERE mo_code=%s AND sort_seq=%s
                """, (state_status, item['seq'], item['mo_code'], item['sort_seq']))
                write_operation_log(
                    cur,
                    event_key=f"panel-sync:completion:{completion_id}",
                    event_type='complete',
                    event_name='完工（ERP入库同步）',
                    occurred_at=item['receipt_end_time'],
                    operator_id=PANEL_SYNC_OPERATOR_ID,
                    operator_name='ERP入库同步',
                    mo_code=item['mo_code'], sort_seq=item['sort_seq'],
                    route_id=item['route_id'], seq=item['seq'],
                    process_name=item['process_name'], station_id=item['station_id'],
                    qty=delta, qty_a=delta, qty_a1=0, qty_a2=0, qty_c=0,
                    reason='拼皮线ERP入库自动同步',
                    source_type='completion', source_id=completion_id,
                    details={'source': 'U8.rdall_yx', 'cumulative_qty': item['receipt_qty']},
                )
                changed += 1
        return changed
    finally:
        cur.close()


def product_context(cur, data, scope=None):
    keys = {(str(r['mo_code']), int(r['sort_seq'])) for r in tracked_order_rows(data)}
    cur.execute('SELECT * FROM mo_workorder_context_yx')
    products = {(str(r['mo_code']), int(r['sort_seq'])): dict(
        r, first_issued_qty=None, first_issue_calculation=None
    )
                for r in cur.fetchall() if (str(r['mo_code']), int(r['sort_seq'])) in keys}
    warning = ''
    try:
        response = requests.get('https://api.jinmilong.cn/api/mo/workorder/list', timeout=8)
        response.raise_for_status()
        payload = response.json()
        if payload.get('code') != 0 or not isinstance(payload.get('data'), list):
            raise ValueError('Invalid ERP response')
        for row in payload['data']:
            key = (str(row['MoCode_a']), int(row['SortSeq_b']))
            old = products.get(key, {})
            products[key] = dict(old, inv_code=row.get('InvCode_b'), inv_name=row.get('cInvName'),
                inv_std=row.get('cInvStd'), plan_qty=row.get('Qty_b'), plan_start_date=row.get('StartDate_c'),
                plan_due_date=row.get('DueDate_c'),
                original_start_date=row.get('OriginalStartDate'),
                original_due_date=row.get('OriginalDueDate'),
                customer_name=row.get('CustomerName') or old.get('customer_name'),
                production_department=row.get('cDepName'),
                product_category=row.get('CategoryName') or old.get('product_category') or '',
                first_issued_qty=None, first_issue_calculation=None, erp_open=True)
    except (requests.RequestException, ValueError, TypeError, KeyError):
        # Missing from the open-order endpoint does NOT mean closed or deleted.
        warning = 'ERP实时资料暂未获取'
        logger.warning('Mobile dashboard ERP context unavailable')
    include_unreported_orders(data, products)
    if not warning:
        load_first_materials(products, first_material_keys(data, scope or {'kind': 'all'}))
    return products, warning


def scoped_snapshot(data, products, now, scope, personal=None):
    snapshot = build_operations_snapshot(data, products, now)
    slots = {}
    for row in data.get('executions', []):
        key = (str(row['mo_code']), int(row['sort_seq']), int(row['route_id']), int(row['seq']))
        slots.setdefault(key, []).append(row)
    incoming = {(str(r['mo_code']), int(r['sort_seq']), int(r['route_id']), int(r['to_seq'])): r
                for r in data.get('handovers', [])}
    step_stations = {}
    for row in data.get('step_stations', []):
        step_stations.setdefault(
            (int(row['route_id']), int(row['seq'])), []
        ).append(row['station_id'])
    orders = []
    for order in snapshot['orders']:
        key = (order['mo_code'], order['sort_seq'], order['route_id'])
        visible_count = 0
        for index, step in enumerate(order['steps']):
            records = slots.get((*key, step['seq']), [])
            handover = incoming.get((*key, step['seq']), {})
            allowed = step_visible(
                scope,
                records,
                handover,
                step_stations.get((key[2], step['seq']), []),
            )
            own = [personal[r['id']] for r in records if personal and r['id'] in personal]
            if scope['kind'] == 'self':
                allowed = bool(own)
                if allowed:
                    step.update(normal_received_qty=None, normal_remaining_qty=None, receive_available_qty=None,
                        transferable_qty=None, normal_done_qty=sum(r['normal_qty'] for r in own),
                        qty_a=None, qty_a1=None, qty_a2=None, qty_c=None,
                        rework_done_qty=sum(r['rework_qty'] for r in own), rework_remaining_qty=0,
                        receiving_qty=0, status='received_done', workers=[], rework_workers=[], personal=True,
                        first_issued_qty=None, first_issue_calculation=None,
                        first_start_time=None, last_end_time=max(str(r['last_time']) for r in own),
                        last_activity=max(str(r['last_time']) for r in own))
            if allowed:
                visible_count += 1
            else:
                order['steps'][index] = {'seq': step['seq'], 'restricted': True}
        if not visible_count and not (
            scope['kind'] == 'all'
            and order.get('has_reporting') is False
            and not order['steps']
        ):
            continue
        visible = [s for s in order['steps'] if not s.get('restricted')]
        order['has_work'] = any((s['normal_remaining_qty'] or 0) > 0 or s['status'] == 'processing' for s in visible)
        order['has_rework'] = any(s['rework_remaining_qty'] > 0 for s in visible)
        order['has_receivable'] = any((s['receive_available_qty'] or 0) > 0 for s in visible)
        order['last_activity'] = max((s.get('last_end_time') or s.get('first_start_time') or '' for s in visible), default='')
        # No global quantity/route state derived from hidden steps is returned.
        order.pop('plan_shortfall_qty', None)
        order['is_active'] = (order.get('has_reporting') is False or order['has_work']
                              or order['has_rework'] or order['has_receivable'])
        order['is_overdue'] = bool(order['is_active'] and order['plan_due_date'] and order['plan_due_date'][:10] < str(now.date()))
        order['erp_open'] = bool(products.get(key[:2], {}).get('erp_open'))
        orders.append(order)
    missing_materials = any(o['erp_open'] and any(s.get('is_first_step') and not s.get('restricted')
        and not s.get('personal') and s.get('first_issued_qty') is None for s in o['steps']) for o in orders)
    snapshot.update(orders=orders, daily=[], warnings=[], scope=scope,
        material_notice='部分首站领料暂未获取，请手动刷新' if missing_materials else '')
    return snapshot
