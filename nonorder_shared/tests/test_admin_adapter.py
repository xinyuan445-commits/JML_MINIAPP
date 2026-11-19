import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

from flask import Flask, g
import pytest
from sqlalchemy import text

from test_workflow import env, create, work
from nonorder_core.planning import candidates
from nonorder_core.service import Service
from nonorder_core.storage import RuleError, transaction
admin_api = Path(__file__).resolve().parents[2] / 'jml_admin' / 'webapi'
if not admin_api.is_dir():
    admin_api = Path(__file__).resolve().parents[3] / 'jml_admin' / 'webapi'
sys.path.insert(0, str(admin_api))
import nonorder_api


@pytest.fixture
def admin_client(env, monkeypatch):
    with env['engine'].begin() as c:
        c.execute(text('''CREATE TABLE mo_admin_account_yx(id INTEGER PRIMARY KEY,is_active INTEGER,
            staff_id TEXT UNIQUE,display_name TEXT,staff_binding_revision INTEGER DEFAULT 0,staff_bound_by INTEGER,staff_bound_at TEXT)'''))
        c.execute(text("INSERT INTO mo_admin_account_yx(id,is_active,staff_id,display_name) VALUES (1,1,'leader','管理人'),(2,1,NULL,'PMC')"))
        c.execute(text('CREATE TABLE mo_admin_role_yx(id INTEGER PRIMARY KEY,is_active INTEGER,permissions TEXT)'))
        c.execute(text('CREATE TABLE mo_admin_account_role_yx(account_id INTEGER,role_id INTEGER)'))
        permissions = ['nonorder.view', 'nonorder.review', 'nonorder.manage', 'daily-tasks.view', 'accounts.manage']
        c.execute(text('INSERT INTO mo_admin_role_yx VALUES(1,1,:p),(2,1,:q)'), {'p': json.dumps(permissions), 'q': json.dumps(['nonorder.view', 'nonorder.view-all', 'daily-tasks.view'])})
        c.execute(text('INSERT INTO mo_admin_account_role_yx VALUES(1,1),(2,2)'))
        c.execute(text('''CREATE TABLE mo_admin_audit_log_yx (username TEXT,action_name TEXT,request_method TEXT,
            request_path TEXT,target_id TEXT,request_data TEXT,result_code INTEGER,result_message TEXT,ip_address TEXT)'''))
    monkeypatch.setattr(nonorder_api, 'engine_for', lambda _: env['engine'])
    monkeypatch.setenv('NONORDER_ENABLED', '1')
    app = Flask(__name__)
    app.register_blueprint(nonorder_api.nonorder_blueprint(lambda: None))
    app.register_blueprint(nonorder_api.binding_blueprint(lambda: None))
    current = [1]
    @app.before_request
    def actor():
        g.admin_account = {'id': current[0]}
        # Deliberately stale host cache: the adapter must intersect with DB roles again.
        g.admin_permissions = set(permissions + ['nonorder.view-all', 'nonorder.transfer', 'nonorder.publish'])
        g.audit_username = 'test-admin'
    return app.test_client(), current


def test_bound_admin_can_review_but_unbinding_revokes_employee_rights(env, admin_client):
    client, _ = admin_client
    task = create(env, ('a',))
    work(env, task)
    detail = client.get('/api/nonorder/detail', query_string={'id': task})
    assert detail.status_code == 200
    record = detail.json['data']['work_record'][0]
    unbind = client.post('/api/admin/accounts/staff-binding', json={'id': 1, 'revision': 0, 'staff_id': None})
    assert unbind.status_code == 200
    response = client.post('/api/nonorder/command', json={'action': 'review', 'task_id': task,
        'revision': detail.json['data']['task']['revision'], 'request_id': 'admin-review', 'record_id': record['id'], 'decision': 'approve'})
    assert response.status_code == 403
    with env['engine'].begin() as c:
        assert c.execute(text('SELECT COUNT(*) FROM mo_admin_audit_log_yx')).scalar() == 1


def test_unique_binding_and_binding_revision(env, admin_client):
    client, _ = admin_client
    before = client.get('/api/admin/accounts/staff-binding?id=2')
    assert before.status_code == 200
    assert before.json['data']['revision'] == 0
    assert 'leader' not in {p['id'] for p in before.json['data']['people']}
    assert client.post('/api/admin/accounts/staff-binding', json={'id': 2, 'revision': 0, 'staff_id': 'leader'}).status_code == 409
    assert client.post('/api/admin/accounts/staff-binding', json={'id': 2, 'revision': 0, 'staff_id': 'leader2'}).status_code == 200
    assert client.post('/api/admin/accounts/staff-binding', json={'id': 2, 'revision': 0, 'staff_id': 'a'}).status_code == 409
    after = client.get('/api/admin/accounts/staff-binding?id=2').json['data']
    assert (after['staff_id'], after['revision']) == ('leader2', 1)


def test_all_range_view_does_not_grant_review_or_transfer(env, admin_client):
    client, current = admin_client
    task = create(env, ('a',))
    work(env, task)
    current[0] = 2
    response = client.get('/api/nonorder/detail', query_string={'id': task})
    assert response.status_code == 200
    detail = response.json['data']
    assert not any(detail['rights'].values())
    response = client.post('/api/nonorder/command', json={'action': 'review', 'task_id': task,
        'revision': detail['task']['revision'], 'request_id': 'not-a-reviewer', 'record_id': detail['work_record'][0]['id'], 'decision': 'approve'})
    assert response.status_code == 403
    assert client.get('/api/nonorder/tasks?tab=transfer').status_code == 403


def test_role_removed_after_host_resolution_is_denied(env, admin_client):
    client, _ = admin_client
    with env['engine'].begin() as c:
        c.execute(text("UPDATE mo_admin_role_yx SET permissions='[]' WHERE id=1"))
    assert client.get('/api/nonorder/context').status_code == 403
    assert client.post('/api/admin/accounts/staff-binding', json={'id': 2, 'revision': 0, 'staff_id': 'a'}).status_code == 403


def test_backend_publisher_uses_responsible_scope_and_preserves_audit(env, admin_client):
    client, current = admin_client
    current[0] = 2
    body = dict(action='create_and_publish', request_id='pmc-publish', responsible_staff_id='leader',
                content='仓库清点', category_code='inventory', acceptance_standard='记录齐全', planned_date='2026-11-16',
                divisions=[{'content': '盘点A区', 'members': [{'staff_id': 'a'}]}])
    assert client.get('/api/nonorder/publish-options').status_code == 403
    assert client.post('/api/nonorder/command', json=body).status_code == 403
    with env['engine'].begin() as c:
        permissions = ['daily-tasks.view', 'nonorder.view', 'nonorder.view-all', 'nonorder.publish']
        c.execute(text('UPDATE mo_admin_role_yx SET permissions=:p WHERE id=2'), {'p': json.dumps(permissions)})
        c.execute(text('UPDATE mo_station_staff_exemption_yx SET staff_ids=:p WHERE id=1'),
                  {'p': json.dumps(['outsider', 'leader2'])})
    options = client.get('/api/nonorder/publish-options').json['data']
    assert {p['id'] for p in options['responsibles']} == {'leader'}
    for exempt in ('outsider', 'leader2'):
        assert client.get('/api/nonorder/publish-options', query_string={'responsible_staff_id': exempt}).status_code == 403
        assert client.post('/api/nonorder/command', json={**body, 'responsible_staff_id': exempt}).status_code == 403
    people = client.get('/api/nonorder/publish-options?responsible_staff_id=leader').json['data']
    assert {p['id'] for p in people['scanners']} == {'leader', 'a', 'b'}
    assert {p['id'] for p in people['reviewers']} == {'leader', 'leader2', 'outsider'}
    invalid = {**body, 'divisions': [{'content': '盘点A区', 'members': [{'staff_id': 'leader2'}]}]}
    assert client.post('/api/nonorder/command', json=invalid).status_code == 403
    involving_owner = {**body, 'divisions': [{'content': '盘点A区', 'members': [{'staff_id': 'leader'}]}]}
    assert client.post('/api/nonorder/command', json=involving_owner).status_code == 409
    with transaction(env['engine']) as db:
        assert db.rows('task') == []
        assert db.rows('manager_grant') == []
    success = client.post('/api/nonorder/command', json={**involving_owner, 'reviewer_staff_id': 'leader2'})
    assert success.status_code == 200, success.json
    result = success.json['data']
    assert client.post('/api/nonorder/command', json={**involving_owner, 'reviewer_staff_id': 'leader2'}).json['data'] == result
    rows = client.get('/api/nonorder/candidates?date=2026-11-16').json['data']
    assert [row['assignment']['staff_id'] for row in rows] == ['leader']
    assert rows[0]['occupied'] is False
    with transaction(env['engine']) as db:
        task = db.get('task', result['task_id'])
        assert task['status'] == 'active' and task['responsible_staff_id'] == 'leader'
        assert task['publisher_name'] == 'PMC'
        assert db.rows('daily_item') == []
        [event] = db.rows('event', task_id=task['id'])
        assert event['event_type'] == 'publish' and event['account_id'] == 2
        assert event['actor_source'] == 'admin' and event['staff_id'] is None


@pytest.mark.parametrize('publish_at_save', [False, True])
def test_sheet_creation_uses_selected_date_and_publishes_task_and_plan_atomically(env, publish_at_save):
    import nonorder_daily

    permissions = {'daily-tasks.view', 'daily-tasks.manage', 'nonorder.view', 'nonorder.view-all',
                   'nonorder.manage', 'nonorder.manage-all', 'nonorder.publish'}
    actor = {'source': 'admin', 'account_id': 2, 'name': 'PMC', 'permissions': permissions}
    sheet = dict(id=9, work_date=date(2026, 11, 16), plan_cutoff=datetime(2026, 11, 14),
                 result_cutoff=datetime(2026, 11, 17))
    task_body = dict(responsible_staff_id='leader', content='盘点', category_code='inventory',
                     acceptance_standard='数量核对完成', planned_date='2026-11-15', divisions=[
                         {'content': '库区盘点', 'members': [
                             {'staff_id': 'a', 'responsibility': 'A区'}, {'staff_id': 'b', 'responsibility': 'B区'},
                         ]},
                     ])
    creation = {'request_id': 'new-on-sheet', 'task': task_body}
    with transaction(env['engine'], write=True) as db:
        db.clock = lambda: env['now']
        service = Service(db, actor)
        nonorder_daily.save(service, sheet, [], creations=[creation], publish=publish_at_save)
        nonorder_daily.save(service, sheet, [], creations=[creation], publish=publish_at_save)
        [task] = db.rows('task')
        plans = db.rows('daily_item')
        assert len(plans) == 2
        assert all(row['sheet_id'] == 9 and row['work_date'] == sheet['work_date'] for row in plans)
        assert task['planned_date'] == date(2026, 11, 15)
        assert {row['status'] for row in plans} == {'published' if publish_at_save else 'draft'}
        assert task['status'] == ('active' if publish_at_save else 'draft')
        assert all(row['occupied'] for row in candidates(service, sheet['work_date']))
        assert len(nonorder_daily.sheet_data(service, sheet, export=True)['items']) == 2
    if not publish_at_save:
        with pytest.raises(RuleError, match='无此任务查看权限'):
            env['detail']('a', task['id'])
        with transaction(env['engine']) as db:
            assignments = {a['id']: a for a in db.rows('assignment', task_id=task['id'])}
        changes = [dict(action='update', id=row['id'], revision=row['revision'], publish=True,
                        task_revision=task['revision'], assignment_revision=assignments[row['assignment_id']]['revision'])
                   for row in plans]
        with env['engine'].begin() as c:
            c.execute(text('UPDATE mo_station_staff_exemption_yx SET staff_ids=:p WHERE id=1'),
                      {'p': json.dumps(['leader'])})
        with pytest.raises(RuleError, match='未列入豁免名单'):
            with transaction(env['engine'], write=True) as db:
                db.clock = lambda: env['now']
                nonorder_daily.save(Service(db, actor), sheet, changes)
        with env['engine'].begin() as c:
            c.execute(text("UPDATE mo_station_staff_exemption_yx SET staff_ids='[]' WHERE id=1"))
        with transaction(env['engine'], write=True) as db:
            db.clock = lambda: env['now']
            assert db.get('task', task['id'])['status'] == 'draft'
            assert {row['status'] for row in db.rows('daily_item')} == {'draft'}
            nonorder_daily.save(Service(db, actor), sheet, changes)
            assert db.get('task', task['id'])['status'] == 'active'
            assert {row['status'] for row in db.rows('daily_item')} == {'published'}
    assert env['detail']('a', task['id'])['assignment'][0]['responsibility'] == 'A区'


@pytest.mark.parametrize('published', [False, True])
def test_sheet_work_edit_replaces_staff_and_preserves_the_old_plan(env, published):
    import nonorder_daily

    actor = {'source': 'admin', 'account_id': 2, 'name': 'PMC', 'permissions': {
        'daily-tasks.view', 'daily-tasks.manage', 'nonorder.view', 'nonorder.view-all',
        'nonorder.manage', 'nonorder.manage-all', 'nonorder.publish'}}
    sheet = dict(id=9, work_date=date(2026, 11, 16), plan_cutoff=datetime(2026, 11, 14),
                 result_cutoff=datetime(2026, 11, 17))
    creation = {'request_id': 'initial', 'task': dict(
        responsible_staff_id='leader', content='盘点', category_code='inventory',
        acceptance_standard='数量核对完成', planned_date='2026-11-15',
        divisions=[{'content': '库区盘点', 'members': [{'staff_id': 'a', 'responsibility': 'A区'}]}])}
    with transaction(env['engine'], write=True) as db:
        db.clock = lambda: env['now']
        nonorder_daily.save(Service(db, actor), sheet, [], creations=[creation], publish=published)
        [old_plan] = db.rows('daily_item')
        [old_assignment] = db.rows('assignment')
    task_id = old_assignment['task_id']
    if published:
        env['call']('a', 'receive', task_id, assignment_id=old_assignment['id'])
        env['call']('a', 'start', task_id, assignment_id=old_assignment['id'])
        env['now'] += timedelta(minutes=5)

    with transaction(env['engine'], write=True) as db:
        db.clock = lambda: env['now']
        service = Service(db, actor)
        row = nonorder_daily.sheet_data(service, sheet)['items'][0]
        assert row['can_edit_work']
        assert 'b' in {p['id'] for p in service.sheet_work_people(old_assignment['id'])}
        change = dict(action='update', id=row['id'], revision=row['revision'],
                      task_revision=row['task']['revision'], assignment_revision=row['assignment']['revision'],
                      work_edit=dict(request_id='edit-on-sheet', staff_id='b', content='盘点B区', responsibility='核对货架'))
        planner = Service(db, {**actor, 'permissions': actor['permissions'] - {'nonorder.publish'}})
        with pytest.raises(RuleError, match='无此分工修改权限'):
            nonorder_daily.save(planner, sheet, [change])
        assert db.get('assignment', old_assignment['id'])['revoked_at'] is None
        nonorder_daily.save(service, sheet, [change])
        original, replacement = db.rows('daily_item')
        assert original['id'] == old_plan['id'] and original['status'] == 'cancelled'
        assert original['snapshot'] == old_plan['snapshot']
        assert replacement['work_date'] == original['work_date']
        assert replacement['status'] == ('published' if published else 'draft')
        assignee = db.get('assignment', replacement['assignment_id'])
        assert assignee['staff_id'] == 'b' and assignee['status'] == 'unreceived'
        assert assignee['responsibility'] == '核对货架'
        assert db.get('division', assignee['division_id'])['content'] == '盘点B区'
        assert db.get('assignment', old_assignment['id'])['revoked_at']
        if published:
            [segment] = db.rows('time_segment', assignment_id=old_assignment['id'])
            assert segment['staff_id'] == 'a' and segment['ended_at'] == env['now']
