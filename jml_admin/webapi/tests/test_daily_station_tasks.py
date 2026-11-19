from datetime import date, datetime
from decimal import Decimal
from unittest.mock import MagicMock

from flask import Flask, g
import pytest

from admin_permissions import permits, page_request_enabled
from daily_station_tasks import (
    candidates, candidate_waiting_reason, enrich_items, key, load_actuals, mutate, positive_quantity, remaining, save_batch,
)


def fixture_rows():
    order = {'mo_code': 'TEST', 'sort_seq': 1, 'route_id': 3, 'plan_qty': 100,
             'dept_name': '部门甲', 'unit_name': '面', 'steps': [
                 {'seq': 1, 'process_name': '水性', 'station_id': 7,
                  'normal_received_qty': 60, 'normal_done_qty': 40,
                  'normal_remaining_qty': 20, 'receive_available_qty': 40,
                  'rework_remaining_qty': 5, 'capacity_unit': '面', 'standard_unit_minutes': 1.2}]}
    snapshot = {'orders': [order]}
    stations = [{'id': 7, 'station_name': '水性一', 'is_active': 1, 'leader_name': None},
                {'id': 8, 'station_name': '水性二', 'is_active': 1, 'leader_name': None}]
    allowed = [{'route_id': 3, 'seq': 1, 'station_id': x} for x in (7, 8)]
    return snapshot, stations, allowed


def task(**overrides):
    return {'id': 1, 'task_id': 11, 'mo_code': 'TEST', 'sort_seq': 1, 'route_id': 3,
            'seq': 1, 'kind': 'normal', 'station_id': 7, 'quantity': Decimal('100'),
            'transferred_qty': Decimal('0'), 'status': 'active', 'sort_order': 1,
            'work_date': date(2026, 11, 12), 'dept_name': '部门甲', 'snapshot': '{}',
            'remark': '', **overrides}


def test_export_arrangement_columns_leader_status_and_remarks():
    from io import BytesIO
    from openpyxl import load_workbook
    from daily_station_tasks import export_excel

    items = [task(id=index, process_name='修色', quantity=Decimal('0.5'), unit_name='张',
                  actual=actual, remark='=现场核对', transferred_qty=Decimal('0.5'),
                  inv_code='INV-001', inv_name='产品描述')
             for index, actual in enumerate(({}, {'received': 0.5}, {'done': 0.25},
                                             {'done': 0.5}, {'done': 0.6}), 1)]
    items.append(task(id=6, status='cancelled'))
    data = {'date': '2026-11-12', 'items': items,
            'stations': [{'id': 7, 'station_name': '修色', 'leader_name': '员工A'}]}
    with Flask('export').test_request_context():
        response = export_excel(data)
        response.direct_passthrough = False
        workbook = load_workbook(BytesIO(response.get_data()))
        response.close()
    sheet = workbook.active
    assert workbook.sheetnames == ['任务安排']
    assert [c.value for c in sheet[2]] == ['生产线名称', '开线状态', '计划数量', '备注', '工单号']
    assert sheet.max_row == 7
    assert sheet['A3'].value == '修色\n员工A'
    assert 'A3:A7' in {str(r) for r in sheet.merged_cells.ranges}
    assert [sheet.cell(row, 2).value for row in range(3, 8)] == ['未开工', '已开工', '已开工', '已完成', '已完成']
    assert sheet['C3'].value == 0.5
    assert '张' in sheet['C3'].number_format
    assert sheet['D3'].value == '=现场核对' and sheet['D3'].data_type == 's'
    assert sheet['E3'].value == 'TEST · 第1行\n料号：INV-001\n描述：产品描述'
    assert sheet['A2'].fill.fgColor.rgb == '00D9EAF7'


def test_export_old_snapshot_without_leader_and_empty_sheet():
    from io import BytesIO
    from openpyxl import load_workbook
    from daily_station_tasks import export_excel

    for items in ([], [task(process_name='修色', actual={}, quantity=1)]):
        data = {'date': '2026-11-12', 'items': items,
                'stations': [{'id': 7, 'station_name': '修色'}]}
        with Flask('export').test_request_context():
            response = export_excel(data)
            response.direct_passthrough = False
            sheet = load_workbook(BytesIO(response.get_data())).active
            response.close()
        assert sheet.max_row == 2 + len(items)
        if items:
            assert sheet['A3'].value == '修色'


@pytest.mark.parametrize('value', [0, -1, 'NaN', 'Infinity', None, 'abc', '0.00001', '1000000000000'])
def test_invalid_quantities_rejected(value):
    with pytest.raises(ValueError):
        positive_quantity(value)


def test_decimal_receipt_and_normal_rework_separation():
    assert positive_quantity('0.5') == Decimal('0.5')
    snapshot, stations, allowed = fixture_rows()
    normal, rework = candidates(snapshot, stations, allowed)
    assert normal['received_remaining'] == 20
    assert normal['receivable'] == 40
    assert normal['ready'] == 60
    assert rework['ready'] == 5
    assert normal['allowed_station_ids'] == [7]  # already received, cannot drag elsewhere


def test_last_step_uses_full_route_even_when_the_later_step_is_already_completed():
    snapshot, stations, allowed = fixture_rows()
    order = snapshot['orders'][0]
    last = dict(order['steps'][0], seq=4, normal_done_qty=100,
                normal_remaining_qty=0, receive_available_qty=0, rework_remaining_qty=0)
    order['steps'].append(last)
    rows = candidates(snapshot, stations, allowed)
    assert rows and all(row['seq'] == 1 for row in rows)
    assert all(row['is_last_step'] is False for row in rows)
    last.update(normal_done_qty=0, normal_remaining_qty=100)
    assert next(row for row in candidates(snapshot, stations, allowed) if row['seq'] == 4)['is_last_step'] is True


def test_waiting_reason_distinguishes_material_upstream_and_uncertain_handover():
    step = dict(normal_done_qty=0, first_issued_qty=20)
    assert candidate_waiting_reason(step, None, 'normal', Decimal(20), Decimal(30)) == 'material'
    assert candidate_waiting_reason(step, None, 'normal', None, Decimal(30)) == 'unknown'
    assert candidate_waiting_reason({}, None, 'normal', Decimal(0), Decimal(30)) == 'unknown'
    assert candidate_waiting_reason(step, None, 'normal', Decimal(30), Decimal(30)) is None
    previous = dict(normal_done_qty=20, transferable_qty=20)
    assert candidate_waiting_reason(step, previous, 'normal', Decimal(20), Decimal(30)) == 'upstream'
    # The previous step has already supplied 20, but handover reports zero.
    assert candidate_waiting_reason(step, previous, 'normal', Decimal(0), Decimal(30)) == 'unknown'
    # All 30 are completed but only 20 can flow forward (e.g. C-grade shortage).
    assert candidate_waiting_reason(step, dict(previous, normal_done_qty=30), 'normal', Decimal(20), Decimal(30)) == 'unknown'
    assert candidate_waiting_reason(step, previous, 'rework', Decimal(20), Decimal(30)) == 'unknown'


def test_waiting_source_uses_route_order_not_literal_sequence_one():
    snapshot, stations, allowed = fixture_rows()
    first = dict(snapshot['orders'][0]['steps'][0], seq=5, first_issued_qty=20,
                 normal_received_qty=0, normal_done_qty=0, normal_remaining_qty=0,
                 receive_available_qty=20, transferable_qty=0, rework_remaining_qty=0)
    later = dict(first, seq=9, process_name='修色', first_issued_qty=None, receive_available_qty=0)
    snapshot['orders'][0]['steps'] = [later, first]
    rows = candidates(snapshot, stations, allowed)
    assert rows[0]['seq'] == 5 and rows[0]['waiting_reason'] == 'material'
    assert rows[1]['seq'] == 9 and rows[1]['waiting_reason'] == 'upstream'
    assert rows[1]['waiting_process_name'] == first['process_name']


def test_unstarted_task_allows_route_stations_and_future_supply():
    snapshot, stations, allowed = fixture_rows()
    step = snapshot['orders'][0]['steps'][0]
    step.update(normal_received_qty=0, normal_done_qty=0, normal_remaining_qty=0, receive_available_qty=30)
    row = candidates(snapshot, stations, allowed)[0]
    assert row['maximum'] == 100 and row['waiting'] == 70
    assert row['allowed_station_ids'] == [7, 8]


def test_closed_and_deleted_orders_not_in_candidate_pool():
    for field in ('is_closed', 'erp_deleted'):
        snapshot, stations, allowed = fixture_rows()
        snapshot['orders'][0][field] = True
        assert candidates(snapshot, stations, allowed) == []


def test_candidates_include_plan_start_and_keep_known_work_without_plan_or_other_balance():
    snapshot,stations,allowed=fixture_rows()
    snapshot['orders'][0].update(plan_qty=None,plan_start_date='2026-11-10')
    snapshot['orders'][0]['steps'][0].update(normal_remaining_qty=20,receive_available_qty=None)
    result=candidates(snapshot,stations,allowed)[0]
    assert result['plan_start_date']=='2026-11-10'
    assert result['maximum']==20
    assert result['ready'] is None
    assert result['received_remaining']==20


def test_active_unknown_receipts_remain_visible_without_inventing_available_quantity():
    snapshot,stations,allowed=fixture_rows()
    snapshot['orders'][0]['plan_qty']=None
    snapshot['orders'][0]['steps'][0].update(normal_remaining_qty=None,receive_available_qty=None,rework_remaining_qty=0,has_active_execution=True)
    rows=candidates(snapshot,stations,allowed)
    assert len(rows)==1 and rows[0]['has_active_execution']
    assert rows[0]['maximum']==0 and rows[0]['ready'] is None
    snapshot['orders'][0]['is_closed']=True
    assert candidates(snapshot,stations,allowed)==[]


def test_unknown_receipt_not_treated_as_zero_and_unit_mismatch_no_duration():
    snapshot, stations, allowed = fixture_rows()
    snapshot['orders'][0]['steps'][0].update(normal_remaining_qty=None, capacity_unit='张')
    row = candidates(snapshot, stations, allowed)[0]
    assert row['ready'] is None and row['waiting'] is None
    assert row['standard_unit_minutes'] is None


def test_same_process_name_different_sequence_and_date_do_not_double_count():
    first = task(quantity=Decimal('10'))
    second = task(id=2, seq=2)
    third = task(id=3, work_date=date(2026,11,13))
    actuals = {('2026-11-12', key(first)): {'done': Decimal('0.5'), 'qty_a': Decimal('0.5')}}
    enriched = enrich_items([first, second, third], actuals, [])
    assert [r['remaining'] for r in enriched] == [Decimal('9.5'), 100, 100]
    assert enriched[0]['difference'] == Decimal('-9.5')


def test_carry_releases_only_transferred_quantity_and_preserves_original_difference():
    row = task(transferred_qty=40)
    actuals = {('2026-11-12',key(row)):{'done':60}}
    enriched = enrich_items([row], actuals, [])[0]
    assert enriched['remaining'] == 0
    assert enriched['quantity'] == 100
    assert enriched['difference'] == -40
    assert remaining(task(status='cancelled'), {}) == 0


def test_receipt_sql_does_not_multiply_multiple_execution_rows():
    cursor = MagicMock()
    cursor.fetchall.side_effect = [[], []]
    load_actuals(cursor, date(2026,11,12), date(2026,11,13))
    sql = cursor.execute.call_args_list[1].args[0]
    assert 'CASE WHEN COUNT(*)=1 THEN MIN(station_id) ELSE NULL END' in sql
    assert "EXISTS (SELECT 1 FROM mo_receive_work_yx" in sql


def test_batch_grades_define_daily_output_without_rework_mixing():
    cursor = MagicMock()
    normal = {**task(), 'work_date': date(2026,11,12), 'qty_a': 59, 'qty_a1': 1, 'qty_a2': 0, 'qty_c': 2}
    rework = {**normal, 'kind': 'rework', 'qty_a': 2, 'qty_a1': 0, 'qty_c': 0}
    cursor.fetchall.side_effect = [[normal, rework], []]
    result = load_actuals(cursor, date(2026,11,12), date(2026,11,13))
    assert result[('2026-11-12',key(normal))]['done'] == 62
    assert result[('2026-11-12',key(rework))]['done'] == 2


def save(body, items=(), revision=1, actuals=None):
    snapshot, stations, allowed = fixture_rows()
    pool = candidates(snapshot, stations, allowed)
    cursor = MagicMock()
    cursor.fetchone.side_effect = [{'id':11,'revision':revision,'status':'draft'}, dict(body)]
    with Flask(__name__).test_request_context('/'):
        g.audit_username = 'test'
        result = mutate(cursor, {'date':'2026-11-12','dept_name':'部门甲','revision':1, **body},
                        date(2026,11,12), list(items), actuals or {}, pool, snapshot, date(2026,11,11))
    return result, cursor


def test_stale_revision_rejected():
    with pytest.raises(ValueError, match='其他人员'):
        save({'action':'cancel', 'id':1}, [task()], revision=2)


def test_duplicate_task_rejected_instead_of_double_attribution():
    with pytest.raises(ValueError, match='已有此任务'):
        save({**task(), 'action':'add','quantity':10}, [task()])


def test_readd_cancelled_task_restores_same_id_and_preserves_transfer_and_history():
    cancelled = task(status='cancelled', transferred_qty=5, remark='保留备注')
    body = {k: cancelled[k] for k in ('mo_code','sort_seq','route_id','seq','kind','station_id')}
    result, cursor = save({**body, 'action':'add', 'auto_quantity':True}, [cancelled],
                          actuals={('2026-11-12',key(cancelled)):{'done':10}})
    assert result['id'] == cancelled['id']
    updates = [c for c in cursor.execute.call_args_list if 'SET quantity=%s' in c.args[0]]
    assert updates[0].args[1] == (Decimal('75'), '保留备注', cancelled['id'])
    assert "status='active'" in updates[0].args[0]
    assert not any('INSERT INTO mo_daily_task_item_yx' in c.args[0] for c in cursor.execute.call_args_list)
    audit = next(c for c in cursor.execute.call_args_list if 'INSERT INTO mo_daily_task_change_yx' in c.args[0])
    assert audit.args[1][3] == 'restore'
    assert 'cancelled' in audit.args[1][4]


def test_auto_quantity_uses_latest_unreserved_balance():
    other = task(id=2,task_id=12,quantity=Decimal('59.5'),work_date=date(2026,11,13))
    _, cursor = save({**task(), 'action':'add', 'auto_quantity':True}, [other])
    insert = next(c for c in cursor.execute.call_args_list if 'INSERT INTO mo_daily_task_item_yx' in c.args[0])
    assert insert.args[1][7] == Decimal('0.5')
    with pytest.raises(ValueError, match='没有可安排余量'):
        save({**task(), 'action':'add', 'auto_quantity':True}, [dict(other,quantity=60)])


def test_cancelled_readd_still_validates_manual_quantity():
    cancelled = task(status='cancelled',transferred_qty=5)
    with pytest.raises(ValueError, match='不能小于当天已完工'):
        save({**task(), 'action':'add','quantity':4}, [cancelled])


def test_other_dates_reserve_remaining_quantity():
    other = task(id=2,task_id=12,quantity=50,work_date=date(2026,11,13))
    with pytest.raises(ValueError, match='超过可安排余量'):
        save({**task(), 'action':'add','quantity':11}, [other])
    result, cursor = save({**task(), 'action':'add','quantity':10}, [other])
    assert result['revision'] == 2
    assert any('mo_daily_task_change_yx' in c.args[0] for c in cursor.execute.call_args_list)
    assert not any('UPDATE mo_execution_yx' in c.args[0] for c in cursor.execute.call_args_list)


def test_cross_station_drag_rejected_for_received_work():
    with pytest.raises(ValueError, match='不能安排到该工站'):
        save({**task(station_id=8), 'action':'add','quantity':10})


def test_carry_cannot_use_completed_or_preceding_date():
    with pytest.raises(ValueError, match='晚于原日期'):
        save({'action':'carry','id':1,'quantity':10,'target_date':'2026-11-12'}, [task()])
    with pytest.raises(ValueError, match='超过当前未完成'):
        save({'action':'carry','id':1,'quantity':101,'target_date':'2026-11-13'}, [task()])


def test_reorder_requires_complete_current_station_task_set():
    with pytest.raises(ValueError, match='任务已变化'):
        save({'action':'reorder','station_id':7,'ids':[]}, [task()])


def test_permissions_are_independent_and_page_switch_applies():
    assert permits({'daily-tasks.view'}, '/api/mo/daily-tasks', 'GET')
    assert not permits({'daily-tasks.view'}, '/api/mo/daily-tasks/save', 'POST')
    assert permits({'daily-tasks.manage'}, '/api/mo/daily-tasks/save', 'POST')
    assert not permits({'production-scheduling.manage'}, '/api/mo/daily-tasks/save', 'POST')
    assert not page_request_enabled({'daily-tasks'}, '/api/mo/daily-tasks/export', 'GET')


def batch(rows, existing=(), *, revision=1, actuals=None, carries=None, publish=False):
    snapshot, stations, allowed = fixture_rows()
    pool = candidates(snapshot, stations, allowed)
    cursor = MagicMock()
    cursor.lastrowid = 99
    cursor.fetchone.side_effect = [{'id':11,'revision':revision,'status':'draft'}, None]
    with Flask(__name__).test_request_context('/'):
        g.audit_username = 'batch-test'
        save_batch(cursor, {'dept_name':'部门甲','revision':1,'items':rows,'carries':carries or [],'publish':publish},
                   date(2026,11,12),list(existing),actuals or {},pool,snapshot,date(2026,11,11))
    return cursor


def test_batch_validates_final_quantities_and_writes_revision_once():
    cursor = batch([task(id=-1,quantity=Decimal('0.5'))])
    insert = next(c for c in cursor.execute.call_args_list if 'INSERT INTO mo_daily_task_item_yx' in c.args[0])
    assert insert.args[1][7] == Decimal('0.5')
    assert sum('UPDATE mo_daily_task_yx SET revision' in c.args[0] for c in cursor.execute.call_args_list)==1


def test_batch_restores_cancelled_row_without_creating_duplicate():
    cursor=batch([task(quantity=20)], [task(status='cancelled')])
    assert not any('INSERT INTO mo_daily_task_item_yx' in c.args[0] for c in cursor.execute.call_args_list)
    log=next(c for c in cursor.execute.call_args_list if 'INSERT INTO mo_daily_task_change_yx' in c.args[0])
    assert log.args[1][3]=='restore'


def test_batch_stale_version_keeps_all_edits_unwritten():
    with pytest.raises(ValueError,match='本地草稿保留'):
        batch([task(quantity=20)],[task()],revision=2)


def test_batch_uses_latest_actuals_not_client_supplied_values():
    original=task(quantity=60)
    with pytest.raises(ValueError,match='最新已完工'):
        batch([task(quantity=10,actual={'done':0})],[original],actuals={('2026-11-12',key(original)):{'done':12}})


def test_batch_cannot_drop_existing_rows_or_reidentify_them():
    with pytest.raises(ValueError,match='缺少已有任务'):
        batch([], [task()])
    with pytest.raises(ValueError,match='不能修改原任务'):
        batch([task(seq=2)],[task()])


def test_batch_future_reservations_still_limit_entire_draft():
    future=task(id=3,task_id=12,quantity=50,work_date=date(2026,11,13))
    with pytest.raises(ValueError,match='合计占用61'):
        batch([task(id=-1,quantity=11)],[future])


def test_batch_transfer_checks_target_revision():
    with pytest.raises(ValueError,match='目标任务已变化'):
        batch([task(quantity=60)],[task(quantity=60)], carries=[{'id':1,'quantity':10,'target_date':'2026-11-13','target_revision':2}])


def test_batch_transfer_retains_total_occupation_and_both_audit_links():
    cursor=batch([task(quantity=60)],[task(quantity=60)], carries=[{'id':1,'quantity':10,'target_date':'2026-11-13','target_revision':0}])
    calls=[c for c in cursor.execute.call_args_list if 'INSERT INTO mo_daily_task_change_yx' in c.args[0]]
    assert {'carry','carry_in'}.issubset({c.args[1][3] for c in calls})
    assert all(c.args[1][-1]=='batch-test' for c in calls)


def test_batch_save_and_publish_are_one_validated_operation():
    cursor=batch([task(id=-1,quantity=1)],publish=True)
    assert any("SET status='published'" in c.args[0] for c in cursor.execute.call_args_list)


def test_batch_http_rollback_on_write_failure_and_single_snapshot(monkeypatch):
    import daily_station_tasks as module
    monkeypatch.setattr(module.lifecycle, 'capture_due', lambda *args: None)
    monkeypatch.setattr(module.lifecycle, 'find_sheet', lambda *args: dict(id=4,sheet_kind='main',plan_cutoff=datetime(2099,11,12),result_cutoff=datetime(2099,11,13)))
    snapshot,stations,allowed=fixture_rows()
    snapshot['orders'][0]['steps'].append({**snapshot['orders'][0]['steps'][0],'seq':2})
    allowed.append({'route_id':3,'seq':2,'station_id':7})
    pool=candidates(snapshot,stations,allowed)
    conn=MagicMock();cursor=conn.cursor.return_value
    cursor.fetchone.side_effect=[{'locked':1},{'id':11,'revision':1,'status':'draft'},{'released':1}]
    cursor.fetchall.side_effect=[stations,allowed]
    cursor.lastrowid=99
    inserts=[]
    def execute(sql,params=None):
        if 'INSERT INTO mo_daily_task_item_yx' in sql:
            inserts.append(params)
            if len(inserts)==2: raise RuntimeError('injected database failure')
    cursor.execute.side_effect=execute
    monkeypatch.setattr(module,'load_items',lambda c:[])
    monkeypatch.setattr(module,'load_actuals',lambda c,s,u:{})
    monkeypatch.setattr(module,'candidates',lambda s,w,a:pool)
    operations=MagicMock(return_value=snapshot)
    api=Flask('batch-rollback')
    api.register_blueprint(module.daily_tasks_blueprint(lambda:conn,operations))
    @api.before_request
    def actor():
        g.audit_username='test'
    with api.test_client() as client:
        response=client.post('/api/mo/daily-tasks/save',json={'action':'batch','date':'2099-11-12','dept_name':'部门甲',
            'revision':1,'items':[dict(task(id=-1,quantity=10),work_date='2099-11-12'),dict(task(id=-2,seq=2,quantity=10),work_date='2099-11-12')]})
    assert response.status_code==503
    assert len(inserts)==2
    conn.rollback.assert_called()
    conn.commit.assert_called_once()
    assert operations.call_count==1


def test_batch_response_returns_refreshed_board_without_second_operations_read(monkeypatch):
    import daily_station_tasks as module
    monkeypatch.setattr(module.lifecycle, 'capture_due', lambda *args: None)
    monkeypatch.setattr(module.lifecycle, 'find_sheet', lambda *args: dict(id=4,sheet_kind='main',plan_cutoff=datetime(2099,11,12),result_cutoff=datetime(2099,11,13)))
    snapshot,stations,allowed=fixture_rows()
    conn=MagicMock();cursor=conn.cursor.return_value
    cursor.fetchone.side_effect=[{'locked':1},{'released':1}]
    cursor.fetchall.side_effect=[stations,allowed,[{'id':11,'revision':2,'dept_name':'部门甲','status':'draft'}],[],[]]
    monkeypatch.setattr(module,'load_items',MagicMock(side_effect=[[],[task(work_date=date(2099,11,12),quantity=1,header_status='draft',sheet_id=4,result_cutoff=datetime(2099,11,13))]]))
    monkeypatch.setattr(module,'load_actuals',lambda c,s,u:{})
    monkeypatch.setattr(module,'save_batch',MagicMock())
    operations=MagicMock(return_value=snapshot)
    api=Flask('batch-response')
    api.register_blueprint(module.daily_tasks_blueprint(lambda:conn,operations))
    with api.test_client() as client:
        response=client.post('/api/mo/daily-tasks/save',json={'action':'batch','date':'2099-11-12'})
    assert response.status_code==200
    assert response.json['data']['headers'][0]['revision']==2
    assert response.json['data']['items'][0]['quantity']==1
    assert operations.call_count==1
    assert conn.commit.call_count == 2


@pytest.mark.parametrize('cutoff,expected_reserved', [
    (datetime(2099, 11, 13), 0),
    (datetime(2099, 11, 14), 10),
])
def test_expired_arrangements_release_quantity_without_carry_or_deleting_history(monkeypatch, cutoff, expected_reserved):
    import daily_station_tasks as module
    from copy import deepcopy
    now = datetime(2099, 11, 13)
    monkeypatch.setattr(module.lifecycle, 'beijing_now', lambda: now)
    monkeypatch.setattr(module.lifecycle, 'capture_due', lambda *args: None)
    monkeypatch.setattr(module.lifecycle, 'find_sheet', lambda *args: dict(
        id=5, sheet_kind='main', plan_cutoff=datetime(2099, 11, 14), result_cutoff=datetime(2099, 11, 14)))
    snapshot, stations, allowed = fixture_rows()
    old = task(work_date=date(2099, 11, 12), quantity=10, sheet_id=4,
               header_status='published', result_cutoff=cutoff)
    before = deepcopy(old)
    conn = MagicMock()
    cursor = conn.cursor.return_value
    cursor.fetchone.side_effect = [{'locked': 1}, {'released': 1}]
    cursor.fetchall.side_effect = [stations, allowed, [], [], []]
    monkeypatch.setattr(module, 'load_items', lambda _: [old])
    monkeypatch.setattr(module, 'load_actuals', lambda *args: {})
    api = Flask('expired-reservation')
    api.register_blueprint(module.daily_tasks_blueprint(lambda: conn, lambda _: snapshot))
    with api.test_client() as client:
        response = client.get('/api/mo/daily-tasks?date=2099-11-13&sheet_id=5')
    assert response.status_code == 200
    row = next(row for row in response.json['data']['candidates'] if row['kind'] == 'normal')
    assert row['reserved'] == expected_reserved
    assert row['unassigned'] == 60 - expected_reserved
    assert response.json['data']['items'] == []
    assert old == before
    assert not any(call.args[0].lstrip().upper().startswith(('DELETE', 'UPDATE', 'INSERT'))
                   for call in cursor.execute.call_args_list)
