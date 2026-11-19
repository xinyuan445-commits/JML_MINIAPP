from datetime import date, datetime
from unittest.mock import MagicMock

from flask import Flask, g
import pytest

from admin_permissions import permits, page_request_enabled
from daily_station_tasks import daily_tasks_blueprint
from daily_task_snapshots import with_creator_names


def api(cursor):
    conn = MagicMock()
    conn.cursor.return_value = cursor
    operations = MagicMock(side_effect=AssertionError('header entry must not load operations'))
    app = Flask(__name__)
    app.register_blueprint(daily_tasks_blueprint(lambda: conn, operations))

    @app.before_request
    def actor():
        g.audit_username = 'PMC'

    return app.test_client(), conn, operations


def header():
    return {'id': 4, 'work_date': date(2099, 11, 12), 'dept_name': '生产',
            'status': 'draft', 'revision': 1, 'created_by': 'PMC', 'sheet_kind':'main',
            'plan_cutoff':datetime(2099,11,12), 'result_cutoff':datetime(2099,11,13)}


def test_list_includes_empty_sheets_without_operations_or_writes():
    cursor = MagicMock()
    cursor.fetchall.return_value = [{**header(), 'task_count': 0, 'station_count': 0}]
    client, conn, operations = api(cursor)
    response = client.get('/api/mo/daily-tasks?view=sheets')
    assert response.status_code == 200
    assert response.json['data'][0]['task_count'] == 0
    sql = cursor.execute.call_args.args[0]
    assert 'LEFT JOIN' in sql and "status='active'" in sql
    assert 'ORDER BY s.work_date DESC,s.id DESC' in sql
    operations.assert_not_called()
    conn.commit.assert_not_called()
    conn.close.assert_called_once()


def test_creator_display_uses_linked_employee_or_account_name_and_keeps_original():
    cursor = MagicMock()
    cursor.fetchall.side_effect = [[
        dict(username='10001', subject='s-person', auth_source='oidc', display_name='10001', staff_id='staff-1'),
        dict(username='staff-code', subject='previous-code', auth_source='oidc', display_name='陈敏'),
        dict(username='unknown-code', subject='s-unknown', auth_source='oidc', display_name='unknown-code'),
    ], [dict(id='staff-1', name='王涛')]]
    rows = with_creator_names(cursor, [
        dict(id=1, created_by='10001'), dict(id=2, created_by='previous-code'),
        dict(id=3, created_by='unknown-code'),
    ])
    assert rows == [
        dict(id=1, created_by='10001', creator_display_name='王涛'),
        dict(id=2, created_by='previous-code', creator_display_name='陈敏'),
        dict(id=3, created_by='unknown-code'),
    ]


@pytest.mark.parametrize('exists', [False, True])
def test_create_empty_sheet_is_idempotent_and_audited(exists):
    cursor = MagicMock()
    cursor.lastrowid = 4
    cursor.fetchone.side_effect = ([{'locked': 1}, header(), {'released': 1}] if exists
                                  else [{'locked': 1}, None, header(), {'released': 1}])
    client, conn, operations = api(cursor)
    response = client.post('/api/mo/daily-tasks/save', json={
        'action': 'create', 'date': '2099-11-12',
    })
    assert response.status_code == 200
    assert response.json['data']['created'] is not exists
    assert response.json['data']['sheet']['id'] == 4
    writes = [call.args[0] for call in cursor.execute.call_args_list if 'INSERT' in call.args[0]]
    assert len(writes) == (0 if exists else 3)
    assert not any('mo_daily_task_item_yx' in sql for sql in writes)
    conn.commit.assert_called_once()
    operations.assert_not_called()


@pytest.mark.parametrize('fields', [
    {'date': '2020-01-01', 'dept_name': '生产'},
    {'date': 'bad', 'dept_name': '生产'},
    {'date': '2110-11-12'},
])
def test_create_invalid_or_historical_sheet_writes_nothing(fields):
    cursor = MagicMock()
    client, conn, operations = api(cursor)
    response = client.post('/api/mo/daily-tasks/save', json={'action': 'create', **fields})
    assert response.status_code == 400
    cursor.execute.assert_not_called()
    conn.commit.assert_not_called()
    operations.assert_not_called()


def test_failed_creation_audit_rolls_back_header():
    cursor = MagicMock()
    cursor.fetchone.side_effect = [{'locked': 1}, None, {'released': 1}]
    cursor.lastrowid = 4

    def execute(sql, params=None):
        if 'INSERT INTO mo_daily_task_change_yx' in sql:
            raise RuntimeError('audit failure')

    cursor.execute.side_effect = execute
    client, conn, _ = api(cursor)
    response = client.post('/api/mo/daily-tasks/save', json={
        'action': 'create', 'date': '2099-11-12', 'dept_name': '生产',
    })
    assert response.status_code == 503
    conn.rollback.assert_called_once()
    conn.commit.assert_not_called()


def test_sheet_permissions():
    assert permits({'daily-tasks.view'}, '/api/mo/daily-tasks', 'GET')
    assert permits({'route.view'}, '/api/mo/departments', 'GET')
    assert not permits({'daily-tasks.view'}, '/api/mo/daily-tasks/save', 'POST')
    assert permits({'daily-tasks.manage'}, '/api/mo/daily-tasks/save', 'POST')
    assert not page_request_enabled({'daily-tasks'}, '/api/mo/daily-tasks', 'GET')
    assert not page_request_enabled({'daily-tasks', 'route'}, '/api/mo/departments', 'GET')


def test_all_departments_are_validated_before_writing(monkeypatch):
    import daily_station_tasks as module
    cursor = MagicMock()
    cursor.fetchall.return_value = [{'dept_name': '甲', 'revision': 1}, {'dept_name': '乙', 'revision': 2}]
    save = MagicMock()
    monkeypatch.setattr(module, 'save_batch', save)
    with pytest.raises(ValueError, match='已被修改'):
        module.save_sheet_batch(cursor, {'batches': [
            {'dept_name':'甲', 'revision':1}, {'dept_name':'乙', 'revision':1},
        ]}, date(2099,11,12), [], {}, [], {}, date(2099,11,11))
    save.assert_not_called()
    with pytest.raises(ValueError, match='增加部门'):
        module.save_sheet_batch(cursor, {'batches':[{'dept_name':'甲','revision':1}]},
                                date(2099,11,12), [], {}, [], {}, date(2099,11,11))


def test_multi_department_failure_rolls_back_entire_http_save(monkeypatch):
    import daily_station_tasks as module
    monkeypatch.setattr(module.lifecycle, 'capture_due', lambda *args: None)
    monkeypatch.setattr(module.lifecycle, 'find_sheet', lambda *args: header())
    conn = MagicMock(); cursor = conn.cursor.return_value
    cursor.fetchone.side_effect = [{'locked':1}, {'released':1}]
    cursor.fetchall.side_effect = [[], [], [{'dept_name':'甲','revision':1}, {'dept_name':'乙','revision':1}]]
    monkeypatch.setattr(module, 'load_items', lambda c: [])
    monkeypatch.setattr(module, 'load_actuals', lambda *args: {})
    save = MagicMock(side_effect=[None, ValueError('乙部门数量已变化')])
    monkeypatch.setattr(module, 'save_batch', save)
    app = Flask('multi-sheet')
    app.register_blueprint(module.daily_tasks_blueprint(lambda:conn, lambda now:{'orders':[]}))
    response = app.test_client().post('/api/mo/daily-tasks/save',json={
        'action':'batch_sheet','date':'2099-11-12','batches':[
            {'dept_name':'甲','revision':1}, {'dept_name':'乙','revision':1},
        ],
    })
    assert response.status_code==400
    assert save.call_count==2
    conn.rollback.assert_called_once()
    conn.commit.assert_called_once()
