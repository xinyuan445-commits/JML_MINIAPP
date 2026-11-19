from datetime import date, datetime, timezone
from unittest.mock import MagicMock

import pytest
from flask import Flask
from routes import mo_reporting as reporting
from services.mo_reporting_summary import summarize
from services.mo_reporting_board import (scoped_snapshot, product_context, read_first_issued_qty,
    first_material_keys, load_first_materials, panel_sync_candidates,
    sync_panel_reporting)


@pytest.fixture(autouse=True)
def batch_status_fallback(monkeypatch):
    def unavailable(_keys):
        raise RuntimeError('batch endpoint unavailable in fallback tests')
    monkeypatch.setattr('services.mo_reporting_board.read_production_statuses', unavailable)


def row(day='2026-10-21', kind='normal', count=1, qty=10, c=0):
    return dict(day=day, kind=kind, process_name='压贴', batch_count=count,
        qty=qty, qty_a=qty-c, qty_a1=0, qty_a2=0, qty_c=c)


def test_totals_use_all_batches_keep_rework_separate_and_count_c_only_in_normal():
    result = summarize([row(count=2, qty=20, c=1), row(kind='rework', qty=1)],
        date(2026, 10, 21), date(2026, 10, 21), 1)
    assert result['normal_count'] == 2 and result['rework_count'] == 1
    assert result['order_count'] == 1 and result['c_ratio'] == 5
    assert result['grades'] == dict(a=19, a1=0, a2=0, c=1)
    assert result['processes'][0]['normal'] == 20
    assert result['processes'][0]['rework'] == 1


def test_trend_covers_seven_days_but_does_not_expand_selected_totals():
    result = summarize([row(day='2026-10-15', count=3), row()], date(2026, 10, 21), date(2026, 10, 21), 1)
    assert result['normal_count'] == 1
    assert len(result['trend']) == 7 and result['trend'][0]['normal'] == 3
    assert result['trend'][-1]['date'] == '2026-10-21'


def test_empty_report_has_no_fabricated_grade_ratio_or_batches():
    result = summarize([], date(2026, 10, 21), date(2026, 10, 21), 0)
    assert result['c_ratio'] is None
    assert result['normal_count'] == result['rework_count'] == 0
    assert result['processes'] == []


def test_new_metrics_include_a1_a2_c_as_defects_and_exclude_rework_output():
    normal = dict(row(qty=100), qty_a=80, qty_a1=10, qty_a2=6, qty_c=4)
    plan = dict(mo_code='MO', sort_seq=1, route_id=1, seq=1, process_name='压贴', plan_qty=120)
    result = summarize([normal, row(kind='rework', qty=30, c=2)], date(2026, 10, 21), date(2026, 10, 21), 1, [plan])
    assert result['plan_qty'] == 120 and result['completed_qty'] == 100
    assert result['good_qty'] == 80 and result['bad_qty'] == 20 and result['defect_rate'] == 20
    assert result['defect_breakdown'] == [dict(grade='A1', qty=10, rate=10), dict(grade='A2', qty=6, rate=6), dict(grade='C', qty=4, rate=4)]
    assert result['process_chart'] == [dict(name='压贴', plan_qty=120, completed_qty=100, good_qty=80, bad_qty=20, yield_rate=80)]


def test_split_batches_do_not_duplicate_plan_but_distinct_order_lines_and_steps_do():
    first = dict(mo_code='MO', sort_seq=1, route_id=1, seq=1, process_name='压贴', plan_qty=100)
    plans = [first, first, dict(first, sort_seq=2, plan_qty=50), dict(first, seq=2, process_name='修边')]
    result = summarize([row(count=2, qty=30)], date(2026, 10, 21), date(2026, 10, 21), 1, plans)
    assert result['process_chart'][0]['plan_qty'] == 150
    assert result['plan_qty'] == 150  # No normal completion for 修边 in this date range.
    result = summarize([row(), dict(row(), process_name='修边')], date(2026, 10, 21), date(2026, 10, 21), 1, plans)
    assert result['plan_qty'] == 250


def test_missing_planned_quantity_is_unknown_not_zero():
    plan = dict(mo_code='MO', sort_seq=1, route_id=1, seq=1, process_name='压贴', plan_qty=None)
    result = summarize([row()], date(2026, 10, 21), date(2026, 10, 21), 1, [plan])
    assert result['plan_qty'] is None and result['process_chart'][0]['plan_qty'] is None
    assert result['completed_qty'] == 10


def test_empty_new_report_has_zero_quantities_but_no_invented_quality_rate():
    result = summarize([], date(2026, 10, 21), date(2026, 10, 21), 0)
    assert result['plan_qty'] == result['completed_qty'] == result['bad_qty'] == 0
    assert result['defect_rate'] is None and result['process_chart'] == []
    assert all(g['rate'] is None for g in result['defect_breakdown'])


@pytest.fixture
def client(monkeypatch):
    app = Flask(__name__)
    app.register_blueprint(reporting.mo_reporting_bp, url_prefix='/api/mo')
    conn = MagicMock()
    cur = conn.cursor.return_value
    monkeypatch.setattr(reporting, 'business_db', lambda: conn)
    monkeypatch.setattr(reporting, 'staff_from_cache', lambda *_: dict(id='me'))
    monkeypatch.setattr(reporting, 'view_scope', lambda *_: dict(
        kind='self', label='我提交的', stations=[], report_access_mode='all'))
    cur.fetchall.side_effect = [[row()], [dict(mo_code='MO', sort_seq=1, route_id=1, seq=1, process_name='压贴', plan_qty=20)]]
    cur.fetchone.return_value = {'total': 1}
    return app.test_client(), conn, cur


@pytest.mark.parametrize('mode,kind,allowed', [
    ('exempt', 'all', True), ('exempt', 'station', False), ('exempt', 'self', False),
    ('station', 'all', True), ('station', 'station', True), ('station', 'self', False),
    ('all', 'all', True), ('all', 'station', True), ('all', 'self', True),
    ('unexpected', 'self', False),
])
def test_report_page_rollout_is_independent_from_data_scope(monkeypatch, mode, kind, allowed):
    assert reporting.report_access_allowed({
        'kind': kind, 'report_access_mode': mode,
    }) is allowed


def test_report_access_endpoint_and_summary_fail_closed_for_non_exempt(client, monkeypatch):
    http, _, _ = client
    monkeypatch.setattr(reporting, 'view_scope', lambda *_: dict(
        kind='self', label='我提交的', stations=[], report_access_mode='exempt'))
    access = http.get('/api/mo/reporting/access?user_id=me', headers={'staff-id': 'me'})
    assert access.status_code == 200 and access.json['data']['can_view'] is False
    assert access.headers['Cache-Control'] == 'no-store'
    denied = http.get('/api/mo/reporting/summary', headers={'staff-id': 'me'})
    assert denied.status_code == 403 and denied.json['msg'] == '暂无报表查看权限'


def test_report_access_endpoint_allows_exempt_scope(client, monkeypatch):
    http, _, _ = client
    monkeypatch.setattr(reporting, 'view_scope', lambda *_: dict(
        kind='all', label='全部工站', stations=[], report_access_mode='exempt'))
    response = http.get('/api/mo/reporting/access?user_id=me', headers={'staff-id': 'me'})
    assert response.status_code == 200 and response.json['data']['can_view'] is True


@pytest.mark.parametrize('path', ['summary', 'board'])
def test_missing_identity_and_invalid_date_fail_before_database(client, path):
    http, conn, _ = client
    assert http.get('/api/mo/reporting/' + path).status_code == 401
    assert http.get('/api/mo/reporting/' + path + '?user_id=other', headers={'staff-id': 'me'}).status_code == 401
    assert http.get('/api/mo/reporting/' + path + '?start_date=invalid', headers={'staff-id': 'me'}).status_code == 400
    conn.cursor.assert_not_called()


@pytest.mark.parametrize('scope,expected', [(dict(kind='self'), 'c.operator_id=%s'),
    (dict(kind='station', station_ids=[2, 5]), 'e.station_id IN (%s,%s)'), (dict(kind='all'), '1=1')])
def test_summary_applies_server_scope_to_every_query(client, monkeypatch, scope, expected):
    http, conn, cur = client
    monkeypatch.setattr(reporting, 'view_scope', lambda *_: {
        **scope, 'report_access_mode': 'all',
    })
    response = http.get('/api/mo/reporting/summary?start_date=2026-10-21&end_date=2026-10-21', headers={'staff-id': 'me'})
    assert response.status_code == 200 and response.json['data']['normal_count'] == 1
    for call in cur.execute.call_args_list:
        assert call.args[0].count(expected) == 2
        assert 'LIMIT' not in call.args[0]
        assert 'mo_execution_completion_yx' in call.args[0] and 'mo_rework_completion_yx' in call.args[0]
    conn.commit.assert_not_called()
    conn.rollback.assert_called_once()


def test_database_failure_is_closed_not_reported_as_zero(client):
    http, conn, cur = client
    cur.execute.side_effect = RuntimeError('unavailable')
    result = http.get('/api/mo/reporting/summary', headers={'staff-id': 'me'})
    assert result.status_code == 503 and 'data' not in result.json
    conn.rollback.assert_called_once()


def board_data():
    key = dict(mo_code='SCDD-TEST', sort_seq=1, route_id=1)
    executions = [dict(key, id=i, seq=i, process_name=f'工序{i}', station_id=i,
        station_name=f'工站{i}', status='processing', qty_done=i*10, qty_a=i*10,
        qty_a1=0, qty_a2=0, qty_c=0, start_time=datetime(2026, 10, 20, 8),
        end_time=None, update_time=datetime(2026, 10, 21, 8)) for i in (1, 2)]
    return dict(states=[dict(key, status='processing')], routes=[dict(id=1, route_name='路线')],
        steps=[dict(route_id=1, seq=i, process_name=f'工序{i}') for i in (1, 2)],
        executions=executions, handovers=[dict(key, id=i, from_seq=i-1, to_seq=i, status='confirmed',
            qty_out=30, qty_out_a=30, qty_out_a1=0, qty_out_a2=0, qty_in=30) for i in (1, 2)])


@pytest.mark.parametrize('hour,minute,today,overdue', [
    (15, 59, '2026-11-14', False),
    (16, 0, '2026-11-15', True),
])
def test_board_overdue_changes_at_beijing_midnight(client, monkeypatch, hour, minute, today, overdue):
    instant = datetime(2026, 11, 14, hour, minute, tzinfo=timezone.utc)

    class UtcServerClock(datetime):
        @classmethod
        def now(cls, tz=None):
            return instant.astimezone(tz) if tz else instant.replace(tzinfo=None)

    http, _, _ = client
    monkeypatch.setattr(reporting, 'datetime', UtcServerClock)
    monkeypatch.setattr(reporting, 'view_scope', lambda *_: dict(kind='all', report_access_mode='all'))
    monkeypatch.setattr('services.mo_dashboard_snapshot.load_operation_rows', lambda *_: board_data())
    monkeypatch.setattr('services.mo_reporting_board.product_context', lambda *_: ({
        ('SCDD-TEST', 1): dict(erp_open=True, plan_due_date='2026-11-14'),
    }, ''))
    monkeypatch.setattr('services.mo_reporting_board.sync_panel_reporting', lambda *_: 0)

    response = http.get('/api/mo/reporting/board', headers={'staff-id': 'me'})

    assert response.status_code == 200
    snapshot = response.get_json()['data']
    assert snapshot['today'] == today
    assert snapshot['orders'][0]['plan_due_date'] == '2026-11-14'
    assert snapshot['orders'][0]['is_overdue'] is overdue


def test_station_board_redacts_all_hidden_step_fields_and_daily_data():
    data = board_data()
    result = scoped_snapshot(data, {}, datetime(2026, 10, 21), dict(kind='station', station_ids=[1]))
    steps = result['orders'][0]['steps']
    assert steps[0]['normal_done_qty'] == 10
    assert steps[1] == {'seq': 2, 'restricted': True}
    assert result['daily'] == [] and result['warnings'] == []
    assert 'plan_shortfall_qty' not in result['orders'][0]


def test_board_step_returns_normal_completion_grade_totals():
    data = board_data()
    data['executions'][0].update(qty_a=6, qty_a1=2, qty_a2=1, qty_c=1)
    step = scoped_snapshot(data, {}, datetime(2026, 10, 21), dict(kind='all'))['orders'][0]['steps'][0]
    assert step['normal_done_qty'] == 10
    assert {field: step[field] for field in ('qty_a', 'qty_a1', 'qty_a2', 'qty_c')} == {
        'qty_a': 6, 'qty_a1': 2, 'qty_a2': 1, 'qty_c': 1,
    }


def test_personal_board_does_not_expose_other_operators_cumulative_counts_or_workers():
    result = scoped_snapshot(board_data(), {}, datetime(2026, 10, 21), dict(kind='self'),
        {1: dict(normal_qty=3, rework_qty=1, last_time='2026-10-21 08:30:00')})
    step = result['orders'][0]['steps'][0]
    assert step['normal_done_qty'] == 3 and step['rework_done_qty'] == 1
    assert step['normal_received_qty'] is None and step['normal_remaining_qty'] is None
    assert all(step[field] is None for field in ('qty_a', 'qty_a1', 'qty_a2', 'qty_c'))
    assert step['workers'] == step['rework_workers'] == []
    assert step['first_start_time'] is None
    assert result['orders'][0]['steps'][1] == {'seq': 2, 'restricted': True}


def test_mixed_station_executions_are_not_combined_into_authorized_station():
    data = board_data()
    data['executions'].append(dict(data['executions'][0], id=3, station_id=2))
    assert scoped_snapshot(data, {}, datetime(2026, 10, 21), dict(kind='station', station_ids=[1]))['orders'] == []


def test_missing_from_open_erp_list_is_not_claimed_closed_or_deleted(monkeypatch):
    cur = MagicMock()
    cur.fetchall.return_value = [dict(mo_code='SCDD-TEST', sort_seq=1, customer_name='客户')]
    response = MagicMock()
    response.json.return_value = dict(code=0, data=[])
    monkeypatch.setattr('services.mo_reporting_board.requests.get', lambda *_args, **_kw: response)
    products, warning = product_context(cur, board_data())
    assert not warning
    assert products[('SCDD-TEST', 1)]['customer_name'] == '客户'
    assert 'is_closed' not in products[('SCDD-TEST', 1)] and 'erp_deleted' not in products[('SCDD-TEST', 1)]


def test_erp_unavailable_preserves_mysql_context_without_guessing_deleted(monkeypatch):
    import requests
    cur = MagicMock()
    cur.fetchall.return_value = [dict(mo_code='SCDD-TEST', sort_seq=1, inv_name='产品')]
    def fail(*_args, **_kwargs):
        raise requests.Timeout()
    monkeypatch.setattr('services.mo_reporting_board.requests.get', fail)
    products, warning = product_context(cur, board_data())
    assert warning and products[('SCDD-TEST', 1)]['inv_name'] == '产品'
    assert products[('SCDD-TEST', 1)]['first_issued_qty'] is None


def test_open_unreported_order_is_added_without_material_fanout(monkeypatch):
    data = dict(
        states=[],
        bindings=[dict(mo_code='SCDD-NEW', sort_seq=2, route_id=1)],
        category_routes=[],
        routes=[dict(id=1, route_name='路线')],
        steps=[dict(route_id=1, seq=1, process_name='工序1')],
        step_stations=[dict(route_id=1, seq=1, station_id=7)],
    )
    cur = MagicMock()
    cur.fetchall.return_value = []
    response = MagicMock()
    response.json.return_value = dict(code=0, data=[dict(
        MoCode_a='SCDD-NEW', SortSeq_b=2, Qty_b=100,
        InvCode_b='PRODUCT-1', cInvName='待生产产品', CategoryName='测试类别',
        CustomerName='未报工客户', StartDate_c='2026-10-20', DueDate_c='2026-10-25',
        OriginalStartDate='2026-10-18', OriginalDueDate='2026-10-25',
    )])
    getter = MagicMock(return_value=response)
    monkeypatch.setattr('services.mo_reporting_board.requests.get', getter)
    monkeypatch.setattr(
        'services.mo_reporting_board.read_production_statuses',
        lambda _keys: {('SCDD-NEW', 2): dict(
            mo_code='SCDD-NEW', sort_seq=2, first_issued_qty=80,
            first_issue_calculation=None,
        )},
    )

    products, warning = product_context(cur, data, dict(kind='all'))

    assert not warning
    assert getter.call_count == 1
    assert data['states'][0]['synthetic'] is True
    assert first_material_keys(data, dict(kind='all')) == {('SCDD-NEW', 2)}
    assert products[('SCDD-NEW', 2)]['first_issued_qty'] == 80
    all_scope = scoped_snapshot(data, products, datetime(2026, 10, 22), dict(kind='all'))
    assert all_scope['orders'][0]['has_reporting'] is False
    assert all_scope['orders'][0]['is_active'] is True
    assert all_scope['orders'][0]['customer_name'] == '未报工客户'
    assert all_scope['orders'][0]['plan_start_date'] == '2026-10-20'
    assert all_scope['orders'][0]['original_start_date'] == '2026-10-18'
    assert all_scope['orders'][0]['original_due_date'] is None
    station_scope = scoped_snapshot(
        data, products, datetime(2026, 10, 22), dict(kind='station', station_ids=[7])
    )
    assert station_scope['orders'][0]['steps'][0]['process_name'] == '工序1'
    assert scoped_snapshot(
        data, products, datetime(2026, 10, 22), dict(kind='self')
    )['orders'] == []


def material_response(components, **header):
    response = MagicMock()
    response.json.return_value = dict(code=0, data=dict(
        header=dict(MoCode_a='SCDD-TEST', SortSeq_b=1, **header), components=components))
    return response


def test_material_read_reuses_original_controlled_prefix_rules_and_only_sends_get(monkeypatch):
    getter = MagicMock(return_value=material_response([
        dict(sub_code=' 1001 ', qty_plan=10, qty_issued=0),
        dict(sub_code='2001', qty_plan=20, qty_issued=12),
        dict(sub_code='3101', qty_plan=30, qty_issued=8),
        dict(sub_code='3501', qty_plan=40, qty_issued=40),
    ]))
    monkeypatch.setattr('services.mo_reporting_board.requests.get', getter)
    assert read_first_issued_qty(('SCDD-TEST', 1)) == 20
    assert getter.call_args.kwargs['params'] == dict(mo_code='SCDD-TEST', sort_seq=1)
    assert getter.call_args.kwargs['timeout'] == (2, 5)


def test_material_read_falls_back_to_all_bom_lines(monkeypatch):
    monkeypatch.setattr('services.mo_reporting_board.requests.get', lambda *_a, **_kw:
        material_response([
            dict(sub_code='4402-A', qty_plan=100, qty_issued=100),
            dict(sub_code='4402-B', qty_plan=50, qty_issued=40),
        ], Qty_b=300))
    assert read_first_issued_qty(('SCDD-TEST', 1)) == 240


@pytest.mark.parametrize('components', [[dict(sub_code='1001', qty_issued=0)],
    [dict(sub_code='1001', qty_issued=-3), dict(sub_code='3501', qty_issued=90)]])
def test_successful_zero_issue_is_known_zero(monkeypatch, components):
    monkeypatch.setattr('services.mo_reporting_board.requests.get', lambda *_a, **_kw: material_response(components))
    assert read_first_issued_qty(('SCDD-TEST', 1)) == 0


def test_missing_material_basis_stays_unknown(monkeypatch):
    monkeypatch.setattr('services.mo_reporting_board.requests.get',
        lambda *_a, **_kw: material_response([]))
    with pytest.raises(ValueError):
        read_first_issued_qty(('SCDD-TEST', 1))


@pytest.mark.parametrize('payload', [dict(code=1), dict(code=0, data={}),
    dict(code=0, data=dict(header=dict(MoCode_a='OTHER', SortSeq_b=1), components=[])),
    dict(code=0, data=dict(header=dict(MoCode_a='SCDD-TEST', SortSeq_b=1), components=None))])
def test_invalid_material_response_does_not_become_zero(monkeypatch, payload):
    response = MagicMock()
    response.json.return_value = payload
    monkeypatch.setattr('services.mo_reporting_board.requests.get', lambda *_a, **_kw: response)
    with pytest.raises(ValueError):
        read_first_issued_qty(('SCDD-TEST', 1))


def test_material_queries_only_cover_visible_first_stations():
    data = board_data()
    assert first_material_keys(data, dict(kind='all')) == {('SCDD-TEST', 1)}
    assert first_material_keys(data, dict(kind='station', station_ids=[1])) == {('SCDD-TEST', 1)}
    assert first_material_keys(data, dict(kind='station', station_ids=[2])) == set()
    assert first_material_keys(data, dict(kind='self')) == set()


def test_panel_sync_candidates_only_include_exact_panel_department():
    data = dict(
        states=[
            dict(mo_code='PANEL', sort_seq=1, route_id=1),
            dict(mo_code='OTHER', sort_seq=1, route_id=1),
            dict(mo_code='NO-CUT', sort_seq=1, route_id=1),
        ],
        steps=[dict(route_id=1, seq=1, process_id=9, process_name='拼皮')],
        step_stations=[dict(route_id=1, seq=1, station_id=6)],
    )
    products = {
        ('PANEL', 1): dict(
            panel_department='拼皮线', panel_cut_start_time='2026-10-27 08:00:00',
            panel_receipt_qty=10, panel_receipt_end_time='2026-10-27 17:00:00',
            first_issued_qty=10, plan_qty=10,
        ),
        ('OTHER', 1): dict(
            panel_department='拼皮', panel_cut_start_time='2026-10-27 08:00:00',
            panel_receipt_qty=10, panel_receipt_end_time='2026-10-27 17:00:00',
        ),
        ('NO-CUT', 1): dict(panel_department='拼皮线'),
    }

    candidates = panel_sync_candidates(data, products)

    assert len(candidates) == 1
    assert candidates[0]['mo_code'] == 'PANEL'
    assert candidates[0]['process_id'] == 9
    assert candidates[0]['station_id'] == 6


def test_panel_sync_never_overwrites_existing_manual_reporting():
    data = dict(
        states=[dict(mo_code='PANEL', sort_seq=1, route_id=1)],
        steps=[dict(route_id=1, seq=1, process_id=9, process_name='拼皮')],
        step_stations=[dict(route_id=1, seq=1, station_id=6)],
    )
    products = {('PANEL', 1): dict(
        panel_department='拼皮线', panel_cut_start_time='2026-10-27 08:00:00',
        panel_receipt_qty=10, panel_receipt_end_time='2026-10-27 17:00:00',
        first_issued_qty=10, plan_qty=10,
    )}
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchone.return_value = dict(
        id=88, qty_done=10, status='done', sync_source_id=None,
    )

    assert sync_panel_reporting(conn, data, products) == 0
    assert not any('INSERT' in call.args[0] for call in cur.execute.call_args_list)


@pytest.mark.parametrize('plan_qty,affected,expected', [(10, 0, 0), (10, 1, 1), (None, 0, 0), ('bad', 0, 0)])
def test_panel_sync_fills_only_missing_plan_when_auto_quantity_is_unchanged(plan_qty, affected, expected):
    data = dict(
        states=[dict(mo_code='PANEL', sort_seq=1, route_id=1)],
        steps=[dict(route_id=1, seq=1, process_id=9, process_name='拼皮')],
        step_stations=[dict(route_id=1, seq=1, station_id=6)],
    )
    products = {('PANEL', 1): dict(
        panel_department='拼皮线', panel_cut_start_time='2026-10-27 08:00:00',
        panel_receipt_qty=10, panel_receipt_end_time='2026-10-27 17:00:00',
        first_issued_qty=10, plan_qty=plan_qty,
    )}
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchone.side_effect = [
        dict(id=88, qty_done=10, status='done', sync_source_id=88),
        dict(total=0),
    ]
    cur.rowcount = affected

    assert sync_panel_reporting(conn, data, products) == expected
    plan_writes = [call.args for call in cur.execute.call_args_list
                   if 'INSERT INTO mo_workorder_context_yx' in call.args[0]]
    if plan_qty == 10:
        assert len(plan_writes) == 1
        assert plan_writes[0][1] == ('PANEL', 1, 10)
        assert 'COALESCE(plan_qty,VALUES(plan_qty))' in plan_writes[0][0]
    else:
        assert not plan_writes
    assert not any(
        'INSERT INTO mo_execution_completion_yx' in call.args[0]
        for call in cur.execute.call_args_list
    )


def test_panel_sync_creates_start_and_a_grade_completion_for_exact_department():
    data = dict(
        states=[dict(mo_code='PANEL', sort_seq=1, route_id=1)],
        steps=[dict(route_id=1, seq=1, process_id=9, process_name='拼皮')],
        step_stations=[dict(route_id=1, seq=1, station_id=6)],
    )
    products = {('PANEL', 1): dict(
        panel_department='拼皮线', panel_cut_start_time='2026-10-27 08:00:00',
        panel_receipt_qty=10, panel_receipt_end_time='2026-10-27 17:00:00',
        first_issued_qty=12, plan_qty=10,
    )}
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchone.side_effect = [
        None,
        None,
        dict(station_name='拼皮'),
        dict(total=0),
    ]
    cur.rowcount = 1
    cur.lastrowid = 88

    assert sync_panel_reporting(conn, data, products) == 3
    statements = [call.args[0] for call in cur.execute.call_args_list]
    assert any('INSERT IGNORE INTO mo_execution_yx' in sql for sql in statements)
    assert any('INSERT INTO mo_execution_completion_yx' in sql for sql in statements)
    assert any('INSERT INTO mo_workorder_context_yx' in sql for sql in statements)
    completion_call = next(
        call for call in cur.execute.call_args_list
        if 'INSERT INTO mo_execution_completion_yx' in call.args[0]
    )
    assert completion_call.args[1][1:3] == (10, 10)


def test_product_context_fetches_live_materials_only_for_open_visible_orders(monkeypatch):
    cur = MagicMock()
    cur.fetchall.return_value = []
    response = MagicMock()
    response.json.return_value = dict(code=0, data=[dict(MoCode_a='SCDD-TEST', SortSeq_b=1, Qty_b=100)])
    monkeypatch.setattr('services.mo_reporting_board.requests.get', lambda *_a, **_kw: response)
    reader = MagicMock(return_value={'issued_qty': 80, 'calculation': None})
    monkeypatch.setattr('services.mo_reporting_board.read_first_issue_context', reader)
    products, warning = product_context(cur, board_data(), dict(kind='station', station_ids=[1]))
    assert not warning and products[('SCDD-TEST', 1)]['first_issued_qty'] == 80
    reader.assert_called_once_with(('SCDD-TEST', 1))
    reader.reset_mock()
    product_context(cur, board_data(), dict(kind='station', station_ids=[2]))
    reader.assert_not_called()


def test_material_failure_is_isolated_and_closed_orders_are_not_queried(monkeypatch):
    products = {('OK', 1): dict(erp_open=True, first_issued_qty=None),
                ('FAILED', 1): dict(erp_open=True, first_issued_qty=None),
                ('CLOSED', 1): dict(first_issued_qty=None)}
    def reader(key):
        assert key[0] != 'CLOSED'
        if key[0] == 'FAILED':
            raise ValueError('unavailable')
        return {'issued_qty': 60, 'calculation': None}
    monkeypatch.setattr('services.mo_reporting_board.read_first_issue_context', reader)
    load_first_materials(products, set(products))
    assert products[('OK', 1)]['first_issued_qty'] == 60
    assert products[('FAILED', 1)]['first_issued_qty'] is None
    assert products[('CLOSED', 1)]['first_issued_qty'] is None


def test_material_batch_updates_all_orders_without_per_order_fanout(monkeypatch):
    products = {
        ('A', 1): dict(erp_open=True, first_issued_qty=None),
        ('B', 2): dict(erp_open=True, first_issued_qty=None),
        ('OLD', 1): dict(erp_open=True, first_issued_qty=None),
    }
    monkeypatch.setattr(
        'services.mo_reporting_board.read_production_statuses',
        lambda _keys: {
            ('A', 1): dict(first_issued_qty=8, department_name='其他部门'),
            ('B', 2): dict(first_issued_qty=9, department_name='拼皮线',
                           first_issue_calculation=dict(mode='panel_area')),
            ('OLD', 1): dict(first_issued_qty=3, department_name='拼皮线',
                             first_issue_calculation=dict(mode='bom_ratio')),
        },
    )
    reader = MagicMock(side_effect=AssertionError('不应逐单查询'))
    monkeypatch.setattr('services.mo_reporting_board.read_first_issue_context', reader)

    load_first_materials(products, set(products))

    assert products[('A', 1)]['first_issued_qty'] == 8
    assert products[('B', 2)]['first_issued_qty'] == 9
    assert products[('OLD', 1)]['first_issued_qty'] is None
    assert products[('B', 2)]['panel_department'] == '拼皮线'
    reader.assert_not_called()


def test_material_deadline_keeps_unknown_instead_of_fabricating_zero(monkeypatch):
    from concurrent.futures import TimeoutError
    products = {('OK', 1): dict(erp_open=True, first_issued_qty=None)}
    monkeypatch.setattr('services.mo_reporting_board.read_first_issue_context',
                        lambda _: {'issued_qty': 10, 'calculation': None})
    def timeout(_futures, timeout):
        assert timeout == 12
        raise TimeoutError()
    monkeypatch.setattr('services.mo_reporting_board.as_completed', timeout)
    load_first_materials(products, set(products))
    assert products[('OK', 1)]['first_issued_qty'] is None


@pytest.mark.parametrize('issued,expected', [(100, 53), (120, 73), (0, 0), (20, 0)])
def test_first_available_deducts_all_received_including_processing_receipts(issued, expected):
    data = board_data()
    key = dict(mo_code='SCDD-TEST', sort_seq=1, route_id=1, seq=1, execution_id=1)
    # The completed receipt is already included in handover.qty_in=30.
    data['receives'] = [dict(key, id=1, status='processing', qty_input=12),
                        dict(key, id=2, status='processing', qty_input=5),
                        dict(key, id=3, status='done', qty_input=10)]
    result = scoped_snapshot(data, {('SCDD-TEST', 1): dict(first_issued_qty=issued, erp_open=True)},
        datetime(2026, 10, 22), dict(kind='all'))
    first, second = result['orders'][0]['steps']
    assert first['is_first_step'] and first['first_issued_qty'] == issued
    assert first['normal_received_qty'] == 47 and first['receive_available_qty'] == expected
    assert not second['is_first_step'] and second['first_issued_qty'] is None
    assert result['material_notice'] == ''


def test_missing_receipt_or_material_does_not_guess_available_quantity():
    data = board_data()
    result = scoped_snapshot(data, {('SCDD-TEST', 1): dict(erp_open=True)}, datetime(2026, 10, 22), dict(kind='all'))
    assert result['orders'][0]['steps'][0]['receive_available_qty'] is None
    assert result['material_notice']
    data['handovers'] = []
    result = scoped_snapshot(data, {('SCDD-TEST', 1): dict(first_issued_qty=100, erp_open=True)},
        datetime(2026, 10, 22), dict(kind='all'))
    first = result['orders'][0]['steps'][0]
    assert first['first_issued_qty'] == 100 and first['receive_available_qty'] is None


def test_unauthorized_or_personal_first_stations_do_not_leak_erp_material_qty():
    products = {('SCDD-TEST', 1): dict(first_issued_qty=999, erp_open=True)}
    station = scoped_snapshot(board_data(), products, datetime(2026, 10, 22), dict(kind='station', station_ids=[2]))
    assert station['orders'][0]['steps'][0] == dict(seq=1, restricted=True)
    assert station['material_notice'] == ''
    personal = scoped_snapshot(board_data(), products, datetime(2026, 10, 22), dict(kind='self'),
        {1: dict(normal_qty=3, rework_qty=0, last_time='2026-10-22 08:30:00')})
    assert personal['orders'][0]['steps'][0]['first_issued_qty'] is None
    assert personal['orders'][0]['steps'][0]['receive_available_qty'] is None
    assert personal['material_notice'] == ''
