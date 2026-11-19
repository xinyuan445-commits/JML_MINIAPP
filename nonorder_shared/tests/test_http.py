import io
import json
import sys
from pathlib import Path

import pytest
from flask import Flask, request

from test_workflow import env, create, own, work
from nonorder_core.http import blueprint
from nonorder_core.storage import transaction
from nonorder_core.service import Service


@pytest.fixture
def client(env, monkeypatch, tmp_path):
    app = Flask(__name__)
    monkeypatch.setenv('NONORDER_ATTACHMENT_DIR', str(tmp_path / 'private'))
    monkeypatch.setenv('NONORDER_ENABLED', '1')
    app.register_blueprint(blueprint(lambda: env['engine'], lambda _: {'source': 'mini', 'staff_id': request.headers.get('staff-id')}, name='isolated'))
    return app.test_client()


def test_disabled_module_does_not_even_open_a_connection():
    app = Flask(__name__)
    def forbidden():
        raise AssertionError('Must not connect while disabled')
    app.register_blueprint(blueprint(forbidden, forbidden, enabled=lambda: False))
    assert app.test_client().get('/api/nonorder/context').status_code == 503


def test_shared_api_routes_need_current_employee(client, env):
    task = create(env)
    assert client.get('/api/nonorder/context').status_code == 401
    assert client.get('/api/nonorder/detail', query_string={'id': task}, headers={'staff-id': 'outsider'}).status_code == 403
    response = client.get('/api/nonorder/detail', query_string={'id': task}, headers={'staff-id': 'a'})
    assert response.status_code == 200
    assert len(response.json['data']['assignment']) == 1


def test_attachment_private_and_revocation_immediate(client, env):
    task = create(env)
    upload = client.post('/api/nonorder/attachment', headers={'staff-id': 'a'},
        data={'task_id': str(task), 'file': (io.BytesIO(b'%PDF-test attachment'), 'evidence.pdf')})
    assert upload.status_code == 200
    key = upload.json['data']['key']
    assert client.get('/api/nonorder/attachment', query_string={'key': key}, headers={'staff-id': 'b'}).status_code == 403
    response = client.get('/api/nonorder/attachment', query_string={'key': key}, headers={'staff-id': 'a'})
    assert response.status_code == 200
    assert response.headers['Cache-Control'] == 'private, no-store'
    from sqlalchemy import text
    with env['engine'].begin() as c:
        c.execute(text("UPDATE jml_staff SET status=0 WHERE id='a'"))
    assert client.get('/api/nonorder/attachment', query_string={'key': key}, headers={'staff-id': 'a'}).status_code == 403


def test_unsafe_file_and_path_are_rejected(client, env):
    task = create(env)
    assert client.post('/api/nonorder/attachment', headers={'staff-id': 'a'},
        data={'task_id': str(task), 'file': (io.BytesIO(b'<script>code</script>'), 'payload.jpg')}).status_code == 400
    assert client.get('/api/nonorder/attachment', query_string={'key': '../.env'}, headers={'staff-id': 'a'}).status_code == 404


def test_mysql_ddl_has_nine_tables_and_required_constraints():
    from sqlalchemy.dialects.mysql import dialect
    from sqlalchemy.schema import CreateTable
    from nonorder_core.schema import metadata
    sql = '\n'.join(str(CreateTable(t).compile(dialect=dialect())) for t in metadata.sorted_tables)
    assert len(metadata.tables) == 9
    assert 'uq_nonorder_one_running' in sql
    assert 'uq_nonorder_pending_completion' in sql
    assert 'uq_nonorder_daily_published' in sql
    assert 'DATETIME(6)' in sql
    assert 'ON DELETE CASCADE' not in sql


def test_full_http_publish_receive_start_submit_review(client, env, monkeypatch):
    from datetime import timedelta
    from nonorder_core.storage import Store
    monkeypatch.setattr(Store, 'now', lambda _: env['now'])
    sequence = [0]
    def command(staff, action, task_id=None, **extra):
        sequence[0] += 1
        body = {'action': action, 'request_id': 'http-' + str(sequence[0]), **extra}
        if task_id:
            detail = client.get('/api/nonorder/detail', query_string={'id': task_id}, headers={'staff-id': staff})
            assert detail.status_code == 200
            body.update(task_id=task_id, revision=detail.json['data']['task']['revision'])
        response = client.post('/api/nonorder/command', json=body, headers={'staff-id': staff})
        assert response.status_code == 200, response.json
        return response.json['data']
    task = command('leader', 'create', content='公共区域清扫', acceptance_standard='通道整洁', category_code='5s', planned_date='2026-11-13',
        divisions=[{'content': '清理货架', 'members': [{'staff_id': 'a', 'responsibility': '一号货架'}]}])['task_id']
    command('leader', 'publish', task)
    a = client.get('/api/nonorder/detail', query_string={'id': task}, headers={'staff-id': 'a'}).json['data']['assignment'][0]['id']
    command('a', 'receive', task, assignment_id=a)
    command('a', 'start', task, assignment_id=a)
    env['now'] += timedelta(minutes=5)
    command('a', 'submit', task, assignment_id=a, content='一号货架已清理')
    detail = client.get('/api/nonorder/detail', query_string={'id': task}, headers={'staff-id': 'leader'}).json['data']
    command('leader', 'review', task, record_id=detail['work_record'][0]['id'], decision='approve')
    command('leader', 'confirm_division', task, division_id=detail['division'][0]['id'])
    result = client.get('/api/nonorder/detail', query_string={'id': task}, headers={'staff-id': 'leader'}).json['data']
    assert result['task']['status'] == 'done' and result['assignment'][0]['seconds'] == 300
