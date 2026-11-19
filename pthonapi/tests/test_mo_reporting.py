from datetime import date, datetime
from unittest.mock import MagicMock
import sqlite3

import pytest
from flask import Flask
from routes import mo_reporting as reporting


@pytest.fixture
def setup(monkeypatch):
    app = Flask(__name__)
    app.register_blueprint(reporting.mo_reporting_bp, url_prefix='/api/mo')
    conn = MagicMock()
    cur = conn.cursor.return_value
    cur.fetchone.side_effect = [{'id': 'staff-1', 'status': '1'}, {'total': 0}]
    cur.fetchall.side_effect = [[], []]
    monkeypatch.setattr(reporting, 'business_db', lambda: conn)
    monkeypatch.setattr(reporting, 'view_scope', lambda *_: {'kind': 'self', 'label': '我提交的', 'stations': []})
    return app.test_client(), conn, cur


def test_query_rejects_missing_identity_without_database(setup):
    client, conn, _ = setup
    assert client.get('/api/mo/reporting/records').status_code == 401
    assert client.get('/api/mo/reporting/records?user_id=other', headers={'staff-id': 'staff-1'}).status_code == 401
    conn.cursor.assert_not_called()


def test_query_scopes_both_normal_and_rework_to_current_submitter(setup):
    client, conn, cur = setup
    result = client.get('/api/mo/reporting/records?kind=rework&printed=pending&keyword=ABC', headers={'staff-id': 'staff-1'})
    assert result.status_code == 200
    assert result.json['data']['items'] == []
    count_query, params = cur.execute.call_args_list[1].args
    assert params[0] == params[3] == 'staff-1'
    assert 'mo_execution_completion_yx' in count_query
    assert 'mo_rework_completion_yx' in count_query
    assert "THEN 'unknown'" in count_query
    assert 'kind=%s' in count_query and 'print_status=%s' in count_query
    assert all(not call.args[0].lstrip().startswith(('INSERT', 'UPDATE', 'DELETE')) for call in cur.execute.call_args_list)
    conn.commit.assert_not_called()


@pytest.mark.parametrize('query', [
    'start_date=bad', 'start_date=2026-10-22&end_date=2026-10-21',
    'start_date=2020-01-01&end_date=2026-10-21', 'kind=all-users', 'page=0', 'printed=bad',
    'mine=bad', 'station_id=bad', 'station_id=0',
])
def test_invalid_filters_rejected_before_database(setup, query):
    client, conn, _ = setup
    assert client.get('/api/mo/reporting/records?' + query, headers={'staff-id': 'staff-1'}).status_code == 400
    conn.cursor.assert_not_called()


def test_disabled_staff_cannot_query(setup):
    client, _, cur = setup
    cur.fetchone.side_effect = [{'id': 'staff-1', 'status': '0'}]
    assert client.get('/api/mo/reporting/records', headers={'staff-id': 'staff-1'}).status_code == 403


def test_serialization_preserves_batch_quantity_and_photo_list():
    row = reporting.format_row({'source_type': 'completion', 'source_id': 8,
        'qty_done': 10, 'complete_time': datetime(2026, 10, 21, 8, 30),
        'photo_url': 'one.jpg,two.jpg'})
    assert row['qty_done'] == 10
    assert row['photos'] == ['one.jpg', 'two.jpg']
    assert row['key'] == 'completion:8'


def test_batch_print_rejects_wrong_execution_and_wrong_source():
    cur = MagicMock()
    cur.fetchone.return_value = None
    with pytest.raises(ValueError, match='不匹配'):
        reporting.record_batch_print(cur, {'id': 1}, 5, 'completion', 8, 'staff-1', '')
    with pytest.raises(ValueError, match='参数不正确'):
        reporting.record_batch_print(cur, {'id': 1}, 5, 'arbitrary_table', 8, 'staff-1', '')


def test_batch_print_is_idempotent_and_does_not_reassign_existing_job():
    cur = MagicMock()
    cur.fetchone.side_effect = [{'id': 8}, {'source_type': 'completion', 'source_id': 8}]
    reporting.record_batch_print(cur, {'id': 1}, 5, 'completion', 8, 'staff-1', '')
    assert len(cur.execute.call_args_list) == 2
    cur.fetchone.side_effect = [{'id': 9}, {'source_type': 'completion', 'source_id': 8}]
    with pytest.raises(ValueError, match='其他批次'):
        reporting.record_batch_print(cur, {'id': 1}, 5, 'completion', 9, 'staff-1', '')


def test_new_batch_print_writes_one_traceable_event():
    cur = MagicMock()
    cur.fetchone.side_effect = [{'id': 8}, None]
    reporting.record_batch_print(cur, {'id': 1, 'mo_code': 'ORDER', 'sort_seq': 1,
        'route_id': 2, 'seq': 3, 'process_name': '压贴'}, 5, 'completion', 8, 'staff-1', '员工甲')
    query, values = cur.execute.call_args.args
    assert 'INSERT INTO mo_operation_log_yx' in query
    assert values[0] == 'label_print:5'
    assert values[22:24] == ('completion', 8)


@pytest.mark.parametrize('enabled,exempt,allowed,leader,kind,label', [
    (False, False, {1, 2}, False, 'self', '我提交的'),
    (True, False, set(), False, 'self', '我提交的'),
    (True, True, {1, 2}, False, 'all', '全部工站'),
    (True, False, {1}, True, 'station', '我负责的工站'),
    (True, False, {2}, False, 'station', '我的工站'),
])
def test_view_scope_follows_existing_station_policy(monkeypatch, enabled, exempt, allowed, leader, kind, label):
    monkeypatch.setattr(reporting, 'policy', lambda *_: dict(enabled=enabled, exempt=exempt,
        allowed=allowed, leader=leader, stations={1: '压贴', 2: '修边'}))
    scope = reporting.view_scope(MagicMock(), 'staff-1')
    assert scope['kind'] == kind and scope['label'] == label
    assert {s['id'] for s in scope['stations']} == (set() if kind == 'self' else allowed)
    clause, params = reporting.visibility(scope, 'staff-1')
    if kind == 'station':
        assert clause.startswith('e.station_id IN (')
        assert params == sorted(allowed)
    elif kind == 'self':
        assert clause == 'c.operator_id=%s' and params == ['staff-1']
    else:
        assert clause == '1=1' and params == []


def test_station_query_scopes_both_kinds_and_supports_mine_filter(setup, monkeypatch):
    client, _, cur = setup
    monkeypatch.setattr(reporting, 'view_scope', lambda *_: {
        'kind': 'station', 'label': '我的工站', 'station_ids': [2, 5],
        'stations': [{'id': 2, 'name': '修边'}, {'id': 5, 'name': '压贴'}]})
    response = client.get('/api/mo/reporting/records?mine=1&station_id=2', headers={'staff-id': 'staff-1'})
    assert response.status_code == 200
    sql, params = cur.execute.call_args_list[1].args
    assert sql.count('e.station_id IN (%s,%s)') == 2
    assert params[:2] == params[4:6] == [2, 5]
    assert params[-2:] == ['staff-1', 2]
    assert response.json['data']['scope']['label'] == '我的工站'


def test_exempt_query_includes_all_submitters_and_unbound_history(setup, monkeypatch):
    client, _, cur = setup
    monkeypatch.setattr(reporting, 'view_scope', lambda *_: {'kind': 'all', 'label': '全部工站', 'stations': []})
    response = client.get('/api/mo/reporting/records', headers={'staff-id': 'staff-1'})
    assert response.status_code == 200
    sql, params = cur.execute.call_args_list[1].args
    assert 'c.operator_id=%s' not in sql and 'e.station_id IN' not in sql
    assert len(params) == 4


def test_leader_scanner_and_active_proxy_station_scopes_are_unioned():
    cur = MagicMock()
    cur.fetchone.side_effect = [
        {'enabled': 1, 'report_access_mode': 'exempt', 'revision': 2},
        {'staff_ids': '[]'},
    ]
    cur.fetchall.side_effect = [
        [{'id': 1, 'station_name': '压贴'}, {'id': 2, 'station_name': '修边'}, {'id': 3, 'station_name': '修补'}],
        [{'station_id': 1, 'leader_staff_id': 'staff-1', 'scanner_staff_ids': '[]'},
         {'station_id': 2, 'leader_staff_id': 'other', 'scanner_staff_ids': '["staff-1"]'}],
        [{'station_id': 2}, {'station_id': 3}]]
    scope = reporting.view_scope(cur, 'staff-1')
    assert scope['kind'] == 'station' and scope['label'] == '我负责的工站'
    assert scope['station_ids'] == [1, 2, 3]
    assert 'ends_at>UTC_TIMESTAMP()' in cur.execute.call_args.args[0]


def test_batch_authorization_is_not_date_filtered_and_never_infers_current_route(setup):
    _, _, cur = setup
    cur.fetchone.side_effect = [{'source_id': 7, 'execution_id': 9}]
    _, batch = reporting.authorized_batch(cur, 'staff-1', {'id': 9, 'source_type': 'completion', 'source_id': 7})
    sql, params = cur.execute.call_args.args
    assert 'complete_time>=' not in sql and 'mo_route_step_yx' not in sql
    assert params == ['staff-1', 'staff-1', 'completion', 7, 9]
    assert batch['source_id'] == 7


@pytest.mark.parametrize('action,method', [('detail', 'get'), ('label', 'get'), ('print-log', 'post'), ('label-pdf', 'post')])
def test_each_entry_rechecks_access_and_rejects_unavailable_batch(setup, action, method):
    client, conn, cur = setup
    cur.fetchone.side_effect = [{'id': 'staff-1', 'status': '1'}, None]
    args = {'id': 9, 'execution_id': 9, 'source_type': 'completion', 'source_id': 7, 'user_id': 'staff-1'}
    response = getattr(client, method)('/api/mo/reporting/' + action,
        headers={'staff-id': 'staff-1'}, **({'query_string': args} if method == 'get' else {'json': args}))
    assert response.status_code == 403
    conn.commit.assert_not_called()
    conn.close.assert_called_once()


def test_personal_detail_does_not_return_other_submitters_history(setup):
    client, conn, cur = setup
    cur.fetchone.side_effect = [
        {'id': 'staff-1', 'status': '1'},
        {'source_type': 'completion', 'source_id': 7, 'execution_id': 9, 'kind': 'normal',
         'mo_code': 'ORDER', 'sort_seq': 1, 'process_name': '压贴', 'qty_done': 10, 'photo_url': 'own.jpg'},
        {'details': '{"receive_id": 3}'}]
    cur.fetchall.side_effect = None
    cur.fetchall.return_value = [{'name': '开工人员甲'}]
    response = client.get('/api/mo/reporting/detail?id=9&source_type=completion&source_id=7',
                          headers={'staff-id': 'staff-1'})
    assert response.status_code == 200
    data = response.json['data']
    assert data['reporting_own_only'] is True
    assert data['reporting_batch']['source_id'] == 7
    assert data['reporting_batch']['worker_text'] == '开工人员甲'
    assert [r['id'] for r in data['completion_records']] == [7]
    assert data['completion_records'][0]['photo_url'] == 'own.jpg'
    assert data['qty_done'] == 10
    assert data['workers'] == [{'user_id': '0', 'user_name': '开工人员甲'}]
    assert not any('FROM mo_execution_yx WHERE id=' in call.args[0] for call in cur.execute.call_args_list)
    conn.commit.assert_not_called()


def test_station_detail_reuses_existing_detail(setup, monkeypatch):
    from flask import jsonify
    from routes import mo
    client, conn, cur = setup
    monkeypatch.setattr(reporting, 'view_scope', lambda *_: {'kind': 'station', 'station_ids': [2]})
    cur.fetchone.side_effect = [{'id': 'staff-1', 'status': '1'},
        {'source_type': 'rework_completion', 'source_id': 7, 'execution_id': 9, 'kind': 'rework', 'rework_id': 4,
         'mo_code': 'ORDER', 'sort_seq': 1, 'process_name': '压贴'}, None]
    cur.fetchall.side_effect = None
    cur.fetchall.return_value = [{'name': '返工人员甲'}]
    delegate = MagicMock(side_effect=lambda: jsonify(code=0, data={'completion_records': [{'id': 8}]}))
    monkeypatch.setattr(mo, 'execution_detail', delegate)
    response = client.get('/api/mo/reporting/detail?id=9&source_type=rework_completion&source_id=7', headers={'staff-id': 'staff-1'})
    assert response.status_code == 200
    delegate.assert_called_once()
    assert response.json['data']['completion_records'] == [{'id': 8}]
    assert response.json['data']['reporting_own_only'] is False
    assert response.json['data']['reporting_batch']['worker_text'] == '返工人员甲'
    conn.commit.assert_not_called()


def test_print_cannot_use_authorized_id_to_write_another_execution(setup):
    client, conn, _ = setup
    response = client.post('/api/mo/reporting/print-log', headers={'staff-id': 'staff-1'}, json={
        'id': 9, 'execution_id': 10, 'source_type': 'completion', 'source_id': 7, 'user_id': 'staff-1'})
    assert response.status_code == 400
    conn.commit.assert_not_called()


@pytest.mark.parametrize('action,method', [('detail', 'get'), ('label', 'get'), ('print-log', 'post'), ('label-pdf', 'post')])
def test_batch_endpoints_require_cached_identity(setup, action, method):
    client, conn, _ = setup
    response = getattr(client, method)('/api/mo/reporting/' + action)
    assert response.status_code == 401
    conn.cursor.assert_not_called()


def test_scoped_print_commits_only_after_legacy_function_succeeds(setup, monkeypatch):
    from flask import jsonify, g
    from routes import mo
    client, conn, cur = setup
    cur.fetchone.side_effect = [{'id': 'staff-1', 'status': '1'},
        {'execution_id': 9, 'source_type': 'completion', 'source_id': 7}, {'print_count': 2}]
    def delegate():
        g.mo_station_connection.commit()
        return jsonify(code=0, data={'print_count': 100})
    monkeypatch.setattr(mo, 'execution_print_log', delegate)
    response = client.post('/api/mo/reporting/print-log', headers={'staff-id': 'staff-1'}, json={
        'execution_id': 9, 'source_type': 'completion', 'source_id': 7, 'user_id': 'staff-1'})
    assert response.status_code == 200 and response.json['code'] == 0
    assert response.json['data']['print_count'] == 2
    conn.commit.assert_called_once()


def test_scoped_print_failure_does_not_commit(setup, monkeypatch):
    from flask import jsonify
    from routes import mo
    client, conn, cur = setup
    cur.fetchone.side_effect = [{'id': 'staff-1', 'status': '1'}, {'execution_id': 9}]
    monkeypatch.setattr(mo, 'execution_print_log', lambda: jsonify(code=1, msg='打印记录失败'))
    response = client.post('/api/mo/reporting/print-log', headers={'staff-id': 'staff-1'}, json={
        'execution_id': 9, 'source_type': 'completion', 'source_id': 7, 'user_id': 'staff-1'})
    assert response.json['code'] == 1
    conn.commit.assert_not_called()
    conn.rollback.assert_called_once()


def test_reporting_erp_lookup_does_not_write_context(monkeypatch):
    from flask import g
    from routes import mo
    response = MagicMock()
    response.json.return_value = {'code': 0, 'data': {'header': {'MoCode_a': 'ORDER'}}}
    monkeypatch.setattr(mo.requests, 'get', lambda *a, **k: response)
    save = MagicMock()
    monkeypatch.setattr(mo, 'upsert_workorder_context', save)
    with Flask(__name__).test_request_context():
        g.mo_reporting_readonly = True
        assert mo._fetch_workorder_detail('ORDER', 1)['header']['MoCode_a'] == 'ORDER'
    save.assert_not_called()


@pytest.mark.parametrize('erp_available,expected_qty', [(True, 33), (False, 0)])
def test_first_step_reporting_detail_uses_current_erp_issue(setup, monkeypatch, erp_available, expected_qty):
    from routes import mo

    client, conn, cur = setup
    monkeypatch.setattr(reporting, 'view_scope', lambda *_: {'kind': 'station', 'station_ids': [2]})
    cur.fetchone.side_effect = [
        {'id': 'staff-1', 'status': '1'},
        {'source_type': 'completion', 'source_id': 7, 'execution_id': 9, 'kind': 'normal',
         'mo_code': 'ORDER', 'sort_seq': 1, 'process_name': '水性'},
        {'id': 9, 'mo_code': 'ORDER', 'sort_seq': 1, 'route_id': 4, 'seq': 1,
         'qty_done': 17, 'qty_a': 17, 'qty_a1': 0, 'qty_a2': 0, 'qty_c': 0,
         'status': 'done', 'start_time': None, 'end_time': None},
        {'current_seq': 2, 'status': 'pending'},
        None,
        {'id': 5, 'process_name': None, 'qty_out': 17, 'qty_in': 17, 'confirm_time': None},
        None,
    ]
    cur.fetchall.side_effect = None
    cur.fetchall.return_value = []
    erp_response = MagicMock()
    erp_response.json.return_value = {'code': 0, 'data': {
        'header': {'MoCode_a': 'ORDER', 'Qty_b': 50},
        'components': [{'sub_code': '27-BOARD', 'qty_plan': 50, 'qty_issued': 50}],
    }} if erp_available else {'code': 1, 'msg': 'ERP unavailable'}
    read_erp = MagicMock(return_value=erp_response)
    save = MagicMock()
    monkeypatch.setattr(mo.requests, 'get', read_erp)
    monkeypatch.setattr(mo, 'upsert_workorder_context', save)

    response = client.get('/api/mo/reporting/detail?id=9&source_type=completion&source_id=7',
                          headers={'staff-id': 'staff-1'})

    assert response.status_code == 200
    assert response.json['data']['receive_available_qty'] == expected_qty
    read_erp.assert_called_once_with(mo.MO_WORKORDER_DETAIL_URL, params={'mo_code': 'ORDER', 'sort_seq': 1}, timeout=8)
    save.assert_not_called()
    conn.commit.assert_not_called()


@pytest.fixture
def print_database():
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    conn.create_function('CONCAT', -1, lambda *parts: ''.join(str(p) for p in parts))
    conn.executescript('''
        CREATE TABLE batches (source_type TEXT, source_id INTEGER, execution_id INTEGER, complete_time TEXT);
        CREATE TABLE mo_operation_log_yx (event_key TEXT, event_type TEXT, source_type TEXT, source_id INTEGER);
        CREATE TABLE mo_execution_print_log_yx (id INTEGER, execution_id INTEGER, print_time TEXT);
        INSERT INTO batches VALUES ('completion',1,9,'2026-10-21 10:00:00');
        INSERT INTO batches VALUES ('completion',2,9,'2026-10-21 11:00:00');
        INSERT INTO batches VALUES ('rework_completion',1,9,'2026-10-21 12:00:00');
    ''')
    yield conn
    conn.close()


def print_results(conn):
    rows = conn.execute('SELECT b.source_type,b.source_id,' + reporting.print_fields_sql() + ' FROM batches b').fetchall()
    return {(r['source_type'], r['source_id']): dict(r) for r in rows}


def test_batch_print_does_not_mark_other_normal_or_rework_batches_printed(print_database):
    db = print_database
    db.execute("INSERT INTO mo_operation_log_yx VALUES ('label_print:5','label_print','completion',1)")
    db.execute("INSERT INTO mo_execution_print_log_yx VALUES (5,9,'2026-10-21 10:01:00')")
    result = print_results(db)
    assert result['completion', 1]['print_status'] == 'printed'
    assert result['completion', 1]['print_count'] == 1
    assert result['completion', 2]['print_status'] == 'pending'
    assert result['rework_completion', 1]['print_status'] == 'pending'


def test_legacy_print_before_second_completion_cannot_apply_to_second_batch(print_database):
    print_database.execute("INSERT INTO mo_execution_print_log_yx VALUES (5,9,'2026-10-21 10:10:00')")
    result = print_results(print_database)
    assert result['completion', 1]['print_status'] == 'unknown'
    assert result['completion', 2]['print_status'] == 'pending'
    assert result['rework_completion', 1]['print_status'] == 'pending'


def test_ambiguous_historical_print_never_fabricates_batch_printed_status(print_database):
    print_database.execute("INSERT INTO mo_execution_print_log_yx VALUES (5,9,'2026-10-21 11:10:00')")
    result = print_results(print_database)
    for key in [('completion', 1), ('completion', 2)]:
        assert result[key]['print_status'] == 'unknown'
        assert result[key]['print_count'] == 0


def test_reporting_label_uses_selected_batch_print_count(setup, monkeypatch):
    from flask import jsonify
    from routes import mo
    client, _, cur = setup
    cur.fetchone.side_effect = [{'id': 'staff-1', 'status': '1'},
        {'mo_code': 'ORDER', 'sort_seq': 1, 'print_count': 2, 'print_status': 'printed'}]
    monkeypatch.setattr(mo, 'execution_label', lambda: jsonify(code=0, data={'print_count': 100}))
    response = client.get('/api/mo/reporting/label?id=9&source_type=completion&source_id=7', headers={'staff-id': 'staff-1'})
    assert response.status_code == 200
    assert response.json['data']['print_count'] == 2
    assert response.json['data']['print_status'] == 'printed'


def test_personal_rework_detail_keeps_partial_batch_flags_and_original_batch_number():
    selected = reporting.format_row({'source_type': 'rework_completion', 'source_id': 8,
        'qty_done': 5, 'qty_a': 5, 'batch_index': 3, 'is_final': 0})
    detail = reporting.personal_detail({'execution_id': 9, 'source_id': 8}, selected, [], '-')
    assert detail['completion_records'][0]['batch_index'] == 3
    assert detail['completion_records'][0]['is_final'] == 0
    assert detail['completion_records'][0]['source_type'] == 'rework_completion'
    assert detail['qty_done'] == 5


def test_latest_label_resolves_actual_latest_source_not_requested_historical_source(setup, monkeypatch):
    from flask import jsonify
    from routes import mo
    client, conn, cur = setup
    monkeypatch.setattr(reporting, 'view_scope', lambda *_: {'kind': 'all'})
    cur.fetchone.side_effect = [{'id': 'staff-1', 'status': '1'}, {
        'execution_id': 9, 'source_type': 'rework_completion', 'source_id': 11,
        'mo_code': 'ORDER', 'sort_seq': 1, 'qty_done': 4, 'station_id': 2, 'operator_id': 'other'}]
    delegate = MagicMock(side_effect=lambda args: jsonify(code=0, data={**args, 'qty_done': 4}))
    monkeypatch.setattr(mo, 'execution_label', delegate)
    response = client.get('/api/mo/reporting/latest-label?id=9&source_type=completion&source_id=1', headers={'staff-id': 'staff-1'})
    assert response.status_code == 200
    delegate.assert_called_once_with({'id': '9', 'source_type': 'rework_completion', 'source_id': '11'})
    assert response.json['data']['qty_done'] == 4
    assert response.json['data']['latest_label'] is True
    sql, params = cur.execute.call_args.args
    assert 'b.complete_time DESC,evt.id DESC' in sql
    assert 'LIMIT 1' in sql and params == (9,)
    assert 'complete_time>=' not in sql
    assert 'c.operator_id=%s' not in sql
    conn.commit.assert_not_called()


@pytest.mark.parametrize('scope,operator,station,status', [
    ({'kind': 'all'}, 'other', None, 200),
    ({'kind': 'station', 'station_ids': [2]}, 'other', 2, 200),
    ({'kind': 'station', 'station_ids': [1]}, 'staff-1', 2, 403),
    ({'kind': 'self'}, 'staff-1', 2, 200),
    ({'kind': 'self'}, 'other', 2, 403),
])
def test_latest_label_respects_current_view_scope_without_falling_back_to_older_own_batch(setup, monkeypatch, scope, operator, station, status):
    from flask import jsonify
    from routes import mo
    client, conn, cur = setup
    monkeypatch.setattr(reporting, 'view_scope', lambda *_: scope)
    cur.fetchone.side_effect = [{'id': 'staff-1', 'status': '1'}, {
        'execution_id': 9, 'source_type': 'completion', 'source_id': 7,
        'mo_code': 'ORDER', 'sort_seq': 1, 'operator_id': operator, 'station_id': station}]
    delegate = MagicMock(side_effect=lambda args: jsonify(code=0, data=args))
    monkeypatch.setattr(mo, 'execution_label', delegate)
    response = client.get('/api/mo/reporting/latest-label?id=9', headers={'staff-id': 'staff-1'})
    assert response.status_code == status
    assert delegate.called is (status == 200)
    conn.commit.assert_not_called()


def test_latest_label_does_not_fall_back_to_cumulative_when_no_completion_exists(setup):
    client, _, cur = setup
    cur.fetchone.side_effect = [{'id': 'staff-1', 'status': '1'}, None]
    response = client.get('/api/mo/reporting/latest-label?id=9', headers={'staff-id': 'staff-1'})
    assert response.status_code == 404


def test_latest_label_requires_identity_and_positive_execution_id(setup):
    client, _, _ = setup
    assert client.get('/api/mo/reporting/latest-label?id=9').status_code == 401
    assert client.get('/api/mo/reporting/latest-label?id=0', headers={'staff-id': 'staff-1'}).status_code == 400


@pytest.fixture
def reminder_database():
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    conn.executescript('''
        CREATE TABLE mo_execution_yx (id INTEGER);
        CREATE TABLE mo_execution_completion_yx (execution_id INTEGER,operator_id TEXT);
        CREATE TABLE mo_rework_yx (id INTEGER,source_execution_id INTEGER);
        CREATE TABLE mo_rework_completion_yx (rework_id INTEGER,operator_id TEXT);
        CREATE TABLE mo_execution_print_log_yx (execution_id INTEGER,operator_id TEXT);
        INSERT INTO mo_execution_yx VALUES (9),(10);
        INSERT INTO mo_execution_completion_yx VALUES (9,'staff-1'),(9,'staff-1'),(10,'other');
        INSERT INTO mo_rework_yx VALUES (4,9);
        INSERT INTO mo_rework_completion_yx VALUES (4,'other');
    ''')
    class Cursor:
        def execute(self, sql, params):
            self.sql, self.params = sql, params
            self.result = conn.execute(sql.replace('%s', '?'), params)

        def fetchall(self):
            return [dict(row) for row in self.result.fetchall()]
    yield conn, Cursor()
    conn.close()


@pytest.mark.parametrize('prints,expected', [(0, 'unprinted'), (1, 'missing'), (2, 'missing'), (3, 'printed'), (4, 'printed')])
def test_reminders_compare_all_normal_and_rework_completions_with_execution_prints(reminder_database, prints, expected):
    conn, cur = reminder_database
    conn.executemany('INSERT INTO mo_execution_print_log_yx VALUES (?,?)', [(9, 'staff-1')] * prints)
    result = reporting.printing_reminders(cur, [{'execution_id': 9}, {'execution_id': 9}], 'staff-1', False)
    assert result == {9: expected}
    assert cur.params == [9]
    assert 'complete_time' not in cur.sql and 'LIMIT' not in cur.sql


def test_personal_reminder_does_not_count_other_submitters_completions_or_prints(reminder_database):
    conn, cur = reminder_database
    conn.executemany('INSERT INTO mo_execution_print_log_yx VALUES (?,?)', [(9, 'staff-1'), (9, 'other'), (9, 'other')])
    assert reporting.printing_reminders(cur, [{'execution_id': 9}], 'staff-1', False) == {9: 'printed'}
    assert reporting.printing_reminders(cur, [{'execution_id': 9}], 'staff-1', True) == {9: 'missing'}
    assert cur.params == ['staff-1', 'staff-1', 'staff-1', 9]


def test_empty_page_does_not_query_print_reminders():
    cur = MagicMock()
    assert reporting.printing_reminders(cur, [], 'staff-1', False) == {}
    cur.execute.assert_not_called()


def test_list_exposes_simple_reminder_without_completion_or_execution_print_counts(setup):
    client, conn, cur = setup
    cur.fetchone.side_effect = [{'id': 'staff-1', 'status': '1'}, {'total': 1}]
    cur.fetchall.side_effect = [
        [{'execution_id': 9, 'source_type': 'completion', 'source_id': 1, 'kind': 'normal'}],
        [{'execution_id': 9, 'completion_count': 2, 'execution_print_count': 1}],
        [], [], []]
    response = client.get('/api/mo/reporting/records', headers={'staff-id': 'staff-1'})
    assert response.status_code == 200
    item = response.json['data']['items'][0]
    assert item['label_reminder'] == 'missing'
    assert 'completion_count' not in item and 'execution_print_count' not in item
    conn.commit.assert_not_called()
