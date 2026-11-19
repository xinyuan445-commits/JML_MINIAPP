from datetime import timedelta

import pytest
from sqlalchemy import text
from test_workflow import env, create, own, work, review
from nonorder_core.storage import transaction, RuleError
from nonorder_core.service import Service
from nonorder_core.snapshots import calculate, visible_result


def exempt(env, ids='["outsider"]'):
    with env['engine'].begin() as c:
        c.execute(text('UPDATE mo_station_staff_exemption_yx SET staff_ids=:ids'), {'ids': ids})


def context(env, staff):
    with transaction(env['engine']) as db:
        db.clock = lambda: env['now']
        return Service(db, {'source': 'mini', 'staff_id': staff}).context()


def self_task(env):
    task = create(env, ('leader', 'a'), publish=False)
    env['call']('leader', 'set_reviewer', task, reviewer_staff_id='leader2', reason='另选核对人')
    env['call']('leader', 'publish', task)
    return task


def test_exemption_scope_and_proxy_operations_keep_employee_and_operator_distinct(env):
    exempt(env)
    c = context(env, 'outsider')
    assert c['can_publish'] and c['can_operate_all']
    assert {p['id'] for p in c['scanners']} == {'leader', 'leader2', 'a', 'b'}
    assert 'leader' in {p['id'] for p in context(env, 'leader')['scanners']}
    task = create(env, ('a', 'b'))
    second = create(env, ('a',))
    draft = create(env, publish=False)
    assignment = own(env, task)
    second_assignment = own(env, second)
    with transaction(env['engine']) as db:
        db.clock = lambda: env['now']
        service = Service(db, {'source': 'mini', 'staff_id': 'outsider'})
        assert {row['id'] for row in service.list_tasks('managed')} == {task, second}
        assert not service.list_tasks('mine')
        assert {row['id'] for row in service.list_tasks('mine', assignment)} == {assignment, second_assignment}
        other = Service(db, {'source': 'mini', 'staff_id': 'leader'})
        with pytest.raises(RuleError):
            other.list_tasks('mine', assignment)
    detail = env['detail']('outsider', task)
    assert {p['staff_id'] for p in detail['assignment']} == {'a', 'b'}
    assert detail['rights']['operate_people'] and detail['rights']['owner']
    with pytest.raises(RuleError, match='无此任务查看权限'):
        env['detail']('outsider', draft)
    with pytest.raises(RuleError, match='任务已撤销或结束|执行权限'):
        env['call']('outsider', 'receive', draft, assignment_id=env['detail']('leader', draft)['assignment'][0]['id'])
    with pytest.raises(RuleError, match='执行权限'):
        env['call']('leader', 'receive', task, assignment_id=assignment)
    env['call']('outsider', 'edit_task', task, content='仓库整理')
    for identifier, employee in ((task, assignment), (second, second_assignment)):
        env['call']('outsider', 'receive', identifier, assignment_id=employee)
    env['call']('outsider', 'start', task, assignment_id=assignment)
    with pytest.raises(RuleError, match='先暂停'):
        env['call']('outsider', 'start', second, assignment_id=second_assignment)
    b_assignment = own(env, task, 'b')
    env['call']('outsider', 'receive', task, assignment_id=b_assignment)
    env['call']('outsider', 'start', task, assignment_id=b_assignment)
    env['now'] += timedelta(minutes=10)
    env['call']('outsider', 'pause', task, assignment_id=assignment, pause_kind='休息')
    env['call']('outsider', 'submit', task, assignment_id=assignment, content='清扫完毕')
    audit = env['detail']('a', task)
    segment = audit['time_segment'][0]
    assert segment['staff_id'] == 'a' and segment['operator_staff_id'] == 'outsider'
    assert audit['work_record'][0]['staff_id'] == 'a'
    assert audit['work_record'][0]['payload']['proxy_staff_id'] == 'outsider'
    assert any(e['event_type'] == 'pause' and e['actor_name'] == 'outsider' and e['proxy_staff_name'] == 'a'
               for e in audit['events'])
    env['call']('outsider', 'correct_time', task, assignment_id=assignment,
                before_segment_ids=[segment['id']], proposed_segments=[], content='剔除误计时间')
    d = env['detail']('outsider', task)
    completion, correction = d['work_record']
    assert correction['staff_id'] == 'a'
    env['call']('outsider', 'review', task, record_id=correction['id'], decision='approve')
    env['call']('outsider', 'review', task, record_id=completion['id'], decision='approve')
    approved = env['detail']('a', task)['work_record'][0]
    assert approved['status'] == 'approved' and approved['reviewer_staff_id'] == 'outsider'
    env['call']('outsider', 'cancel', second, reason='撤销')
    exempt(env, '[]')
    with pytest.raises(RuleError, match='无此任务查看权限'):
        env['detail']('outsider', task)
    with pytest.raises(RuleError, match='执行权限'):
        env['call']('outsider', 'pause', task, assignment_id=b_assignment, pause_kind='休息')


def test_exempt_owner_can_publish_and_complete_own_work_without_another_reviewer(env):
    exempt(env, '["leader"]')
    task = create(env, ('leader',))
    work(env, task, 'leader')
    detail = env['detail']('leader', task)
    assert not detail['needs_reviewer'] and detail['reviewer'] is None
    [record] = detail['work_record']
    assert record['can_review']
    env['call']('leader', 'review', task, record_id=record['id'], decision='approve')
    division = env['detail']('leader', task)['division'][0]
    assert division['can_confirm']
    env['call']('leader', 'confirm_division', task, division_id=division['id'])
    assert env['detail']('leader', task)['task']['status'] == 'done'


def test_default_station_comes_only_from_actively_led_stations(env):
    exempt(env, '["outsider","leader2"]')
    assert context(env, 'leader')['default_station_id'] is None
    outsider = context(env, 'outsider')
    assert outsider['can_publish'] and outsider['default_station_id'] is None
    leader2 = context(env, 'leader2')
    assert len(leader2['stations']) == 3 and leader2['default_station_id'] == 3
    with env['engine'].begin() as c:
        c.execute(text('UPDATE mo_workstation_yx SET is_active=0 WHERE id=3'))
    assert context(env, 'leader2')['default_station_id'] is None


def test_publish_requires_reviewer_and_rolls_back(env):
    task = create(env, ('leader',), publish=False)
    with pytest.raises(RuleError):
        env['call']('leader', 'publish', task)
    assert env['detail']('leader', task)['task']['status'] == 'draft'
    with pytest.raises(RuleError):
        env['call']('leader', 'set_reviewer', task, reviewer_staff_id='leader', reason='自行核对')


def test_restricted_review_privacy_and_division_confirmation(env):
    task = self_task(env)
    work(env, task, 'leader')
    work(env, task, 'a')
    d = env['detail']('leader2', task)
    assert {a['staff_id'] for a in d['assignment']} == {'leader'}
    assert {r['staff_id'] for r in d['work_record']} == {'leader'}
    assert not d['rights']['adjust']
    assert {a['staff_name'] for a in d['division'][0]['member_summary']} == {'leader', 'a'}
    env['now'] += timedelta(seconds=1)
    with transaction(env['engine']) as db:
        db.clock = lambda: env['now']
        actor = Service(db, {'source': 'admin', 'staff_id': 'leader2', 'account_id': 2,
                             'permissions': {'daily-tasks.view', 'nonorder.view', 'nonorder.review'}})
        day = visible_result(actor, calculate(db, env['now'].date()))
        assert {r['assignment']['staff_id'] for r in day['items']} == {'leader'}
        assert day['items'][0]['records'][0]['can_review']
    review(env, task, staff='leader2')
    review(env, task, staff='leader')
    division = d['division'][0]['id']
    with pytest.raises(RuleError):
        env['call']('leader', 'confirm_division', task, division_id=division)
    env['call']('leader2', 'confirm_division', task, division_id=division)
    assert env['detail']('leader2', task)['task']['status'] == 'done'


def test_delegate_cannot_bypass_reviewer_or_assign_reviewer(env):
    task = self_task(env)
    env['call']('leader', 'grant', task, staff_id='proxy', permissions=['review', 'time_review'], ends_at='2026-11-14T17:00:00', reason='临时代管')
    work(env, task, 'leader')
    record = env['detail']('leader', task)['work_record'][0]
    with pytest.raises(RuleError):
        env['call']('proxy', 'review', task, record_id=record['id'], decision='approve')
    with pytest.raises(RuleError):
        env['call']('proxy', 'set_reviewer', task, reviewer_staff_id='proxy', reason='自行转授')
    exempt(env, '["leader"]')
    with pytest.raises(RuleError):
        env['call']('leader', 'assign', task, division_id=env['detail']('leader', task)['division'][0]['id'], member={'staff_id': 'leader2', 'responsibility': '参与'}, reason='增加人员')


def test_handover_preserves_old_owner_review_and_revokes_delegate(env):
    task = self_task(env)
    work(env, task, 'leader')
    env['call']('leader', 'grant', task, staff_id='proxy', permissions=['review'], ends_at='2026-11-14T17:00:00', reason='代管')
    exempt(env)
    with pytest.raises(RuleError):
        env['call']('leader', 'transfer', task, staff_id='outsider', reason='交接')
    env['call']('leader', 'transfer', task, staff_id='outsider', reviewer_staff_id='leader2', reason='交接并保留核对人')
    d = env['detail']('outsider', task)
    assert d['reviewer']['staff_id'] == 'leader2'
    assert d['work_record'][0]['can_review']
    assert all(g['revoked_at'] for g in d['manager_grant'] if g['grant_type'] == 'delegate')
    review(env, task, staff='leader2')


def test_reviewer_qualification_revocation_and_replacement(env):
    task = self_task(env)
    work(env, task, 'leader')
    with env['engine'].begin() as c:
        c.execute(text("UPDATE mo_station_staff_config_yx SET leader_staff_id=NULL WHERE leader_staff_id='leader2'"))
    with pytest.raises(RuleError):
        env['detail']('leader2', task)
    assert not env['detail']('leader', task)['reviewer']['valid']
    exempt(env)
    env['call']('leader', 'set_reviewer', task, reviewer_staff_id='outsider', reason='原核对人撤权')
    review(env, task, staff='outsider')


def test_cross_task_correction_requires_same_authorized_reviewer(env):
    first, second = self_task(env), self_task(env)
    work(env, first, 'leader')
    work(env, second, 'leader')
    d1, d2 = env['detail']('leader', first), env['detail']('leader', second)
    env['call']('leader', 'correct_time', first, assignment_id=d1['assignment'][0]['id'],
        before_segment_ids=[d1['time_segment'][0]['id'], d2['time_segment'][0]['id']],
        proposed_segments=[], content='误计时间剔除')
    record = env['detail']('leader2', first)['work_record'][-1]
    assert record['can_review']
    exempt(env)
    env['call']('leader', 'set_reviewer', second, reviewer_staff_id='outsider', reason='变更第二任务核对人')
    assert not env['detail']('leader2', first)['work_record'][-1]['can_review']
    with pytest.raises(RuleError):
        env['call']('leader2', 'review', first, record_id=record['id'], decision='approve')
