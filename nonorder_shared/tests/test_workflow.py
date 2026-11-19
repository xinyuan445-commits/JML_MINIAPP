"""Real SQLite transactions in a temporary database. No project .env is loaded."""
import sys
from pathlib import Path
from datetime import datetime, timedelta, date
from concurrent.futures import ThreadPoolExecutor
import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from nonorder_core.schema import metadata
from nonorder_core.storage import transaction, RuleError
from nonorder_core.service import Service
from nonorder_core.snapshots import freeze


@pytest.fixture
def env(tmp_path):
    engine = create_engine('sqlite:///' + str(tmp_path / 'nonorder-test.sqlite'), connect_args={'timeout': 10})
    metadata.create_all(engine)
    metadata.create_all(engine)
    with engine.begin() as c:
        c.execute(text('CREATE TABLE jml_staff (id TEXT PRIMARY KEY,name TEXT,status INTEGER)'))
        c.execute(text('CREATE TABLE mo_workstation_yx (id INTEGER PRIMARY KEY,station_name TEXT,is_active INTEGER)'))
        c.execute(text('CREATE TABLE mo_station_staff_config_yx (station_id INTEGER,leader_staff_id TEXT,scanner_staff_ids TEXT)'))
        c.execute(text('CREATE TABLE mo_station_staff_exemption_yx (id INTEGER PRIMARY KEY,staff_ids TEXT)'))
        c.execute(text("INSERT INTO mo_station_staff_exemption_yx VALUES (1,'[]')"))
        for identifier in ['leader', 'leader2', 'a', 'b', 'outsider', 'proxy']:
            c.execute(text('INSERT INTO jml_staff VALUES (:id,:id,1)'), {'id': identifier})
        c.execute(text("INSERT INTO mo_workstation_yx VALUES (1,'站1',1),(2,'站2',1),(3,'站3',1)"))
        c.execute(text("""INSERT INTO mo_station_staff_config_yx VALUES
            (1,'leader','["a","b"]'),(2,'leader','["a"]'),(3,'leader2','["b"]')"""))
    state = {'engine': engine, 'now': datetime(2026, 11, 13, 9)}
    def call(staff, action, task_id=None, **body):
        with transaction(engine, write=True) as db:
            db.clock = lambda: state['now']
            service = Service(db, {'staff_id': staff, 'source': 'mini'})
            request = {'action': action, 'request_id': uuid.uuid4().hex, **body}
            if task_id:
                request.update(task_id=task_id)
                request.setdefault('revision', db.get('task', task_id)['revision'])
            return service.command(request)
    def detail(staff, task_id):
        with transaction(engine) as db:
            db.clock = lambda: state['now']
            return Service(db, {'staff_id': staff, 'source': 'mini'}).detail(task_id)
    state.update(call=call, detail=detail)
    yield state
    engine.dispose()


def create(env, people=('a', 'b'), publish=True):
    response = env['call']('leader', 'create', content='库区整理', category_code='5s',
        acceptance_standard='物品归位，通道畅通', planned_date='2026-11-13', divisions=[{
            'content': '仓库清扫', 'members': [{'staff_id': p, 'responsibility': p + '负责区域'} for p in people]}])
    identifier = response['task_id']
    if publish:
        env['call']('leader', 'publish', identifier)
    return identifier


def own(env, task, staff='a'):
    return env['detail'](staff, task)['assignment'][0]['id']


def work(env, task, staff='a'):
    a = own(env, task, staff)
    env['call'](staff, 'receive', task, assignment_id=a)
    env['call'](staff, 'start', task, assignment_id=a)
    env['now'] += timedelta(minutes=10)
    env['call'](staff, 'submit', task, assignment_id=a, content='清扫完毕')
    return a


def review(env, task, decision='approve', staff='leader'):
    record = [r for r in env['detail'](staff, task)['work_record'] if r['status'] == 'pending'][-1]
    env['call'](staff, 'review', task, record_id=record['id'], decision=decision, reason='核对意见')
    return record


def test_draft_scope_independent_receipt_and_privacy(env):
    task = create(env, publish=False)
    with pytest.raises(RuleError):
        env['detail']('a', task)
    with pytest.raises(RuleError):
        env['call']('proxy', 'publish', task)
    env['call']('leader', 'publish', task)
    work(env, task)
    mine = env['detail']('a', task)
    assert len(mine['assignment']) == 1
    assert not mine['manager_grant']
    assert all('data' not in e for e in mine['events'])
    assert env['detail']('b', task)['assignment'][0]['status'] == 'unreceived'
    review(env, task)
    assert env['detail']('a', task)['assignment'][0]['status'] == 'done'


def test_closed_task_rework_does_not_resurrect_history(env):
    task = create(env)
    work(env, task)
    env['call']('leader', 'cancel', task, reason='任务取消')
    with pytest.raises(RuleError):
        review(env, task, 'rework')
    review(env, task, 'materials')
    env['call']('a', 'submit', task, assignment_id=own(env, task), content='补充事实说明')
    review(env, task, 'unmet')
    detail = env['detail']('leader', task)
    assert detail['task']['status'] == 'cancelled'
    assert len(detail['work_record']) == 2
    assert detail['work_record'][1]['previous_record_id'] == detail['work_record'][0]['id']


def test_feedback_only_blocks_affected_person_and_requires_manual_resume(env):
    task = create(env)
    a = own(env, task)
    env['call']('a', 'receive', task, assignment_id=a)
    env['call']('a', 'start', task, assignment_id=a)
    env['call']('a', 'feedback', task, assignment_id=a, content='范围不明确', blocking=True)
    b = own(env, task, 'b')
    env['call']('b', 'receive', task, assignment_id=b)
    env['call']('b', 'start', task, assignment_id=b)
    with pytest.raises(RuleError):
        env['call']('a', 'start', task, assignment_id=a)
    record = review(env, task, 'reply')
    with pytest.raises(RuleError):
        env['call']('a', 'start', task, assignment_id=a)
    env['call']('a', 'confirm_feedback', task, assignment_id=a, record_id=record['id'])
    assert env['detail']('a', task)['assignment'][0]['status'] == 'paused'
    env['call']('a', 'start', task, assignment_id=a)


def test_duties_change_pauses_and_reaccepts_but_submitted_keeps_old(env):
    task = create(env, people=('a',))
    a = own(env, task)
    d = env['detail']('leader', task)['division'][0]['id']
    env['call']('a', 'receive', task, assignment_id=a)
    env['call']('a', 'start', task, assignment_id=a)
    env['now'] += timedelta(minutes=2)
    env['call']('leader', 'edit_division', task, division_id=d, content='增加货架区域')
    assert env['detail']('a', task)['assignment'][0]['status'] == 'unreceived'
    with pytest.raises(RuleError):
        env['call']('a', 'start', task, assignment_id=a)
    work(env, task)
    before = env['detail']('a', task)['assignment'][0]['requirement_snapshot']
    env['call']('leader', 'edit_division', task, division_id=d, content='再增加范围')
    assert env['detail']('a', task)['assignment'][0]['requirement_snapshot'] == before
    with pytest.raises(RuleError):
        env['call']('leader', 'edit_division', task, division_id=d, responsibilities={str(a): '改变已提交者职责'})
    env['call']('leader', 'edit_division', task, division_id=d, remark='仅修改备注')


def test_concurrent_start_is_single_and_rollback_is_real(env):
    first, second = create(env, ('a',)), create(env, ('a',))
    assignments = [(task, own(env, task)) for task in (first, second)]
    for task, a in assignments:
        env['call']('a', 'receive', task, assignment_id=a)
    def start(pair):
        try:
            env['call']('a', 'start', pair[0], assignment_id=pair[1])
            return True
        except RuleError:
            return False
    with ThreadPoolExecutor(2) as pool:
        assert sum(pool.map(start, assignments)) == 1
    with transaction(env['engine']) as db:
        assert len([s for s in db.rows('time_segment') if s['ended_at'] is None]) == 1
    # A bad second division rolls back the entire create, including the first division.
    with transaction(env['engine']) as db:
        count = len(db.rows('task'))
    with pytest.raises(RuleError):
        create(env, ('outsider',))
    with transaction(env['engine']) as db:
        assert len(db.rows('task')) == count


def test_unique_running_constraint_even_without_service(env):
    task = create(env, ('a',))
    a = own(env, task)
    env['call']('a', 'receive', task, assignment_id=a)
    env['call']('a', 'start', task, assignment_id=a)
    with pytest.raises(IntegrityError), transaction(env['engine'], write=True) as db:
        db.insert('time_segment', assignment_id=a, task_id=task, staff_id='a', requirement_revision=1,
                  started_at=env['now'], operator_staff_id='a', source_type='click')


def test_correction_approved_after_midnight_keeps_original_freeze(env):
    env['now'] = datetime(2026, 11, 13, 23, 50)
    task = create(env, ('a',))
    a = own(env, task)
    env['call']('a', 'receive', task, assignment_id=a)
    env['call']('a', 'start', task, assignment_id=a)
    env['now'] += timedelta(minutes=5)
    env['call']('a', 'pause', task, assignment_id=a, pause_kind='休息')
    detail = env['detail']('a', task)
    segment = detail['time_segment'][0]
    env['call']('a', 'correct_time', task, assignment_id=a, content='实际结束较早', before_segment_ids=[segment['id']],
        proposed_segments=[{'assignment_id': a, 'started_at': segment['started_at'], 'ended_at': '2026-11-13T23:53:00'}])
    env['now'] = datetime(2026, 11, 14, 9)
    review(env, task)
    with transaction(env['engine'], write=True) as db:
        db.clock = lambda: env['now']
        frozen = freeze(db, date(2026, 11, 13))
        assert frozen['items'][0]['seconds'] == 300
    assert env['detail']('a', task)['assignment'][0]['seconds'] == 180
    env['now'] += timedelta(seconds=1)
    with transaction(env['engine'], write=True) as db:
        db.clock = lambda: env['now']
        assert freeze(db, date(2026, 11, 13)) == frozen
        from nonorder_core.snapshots import calculate, later_changes
        later = later_changes(Service(db, {'source': 'mini', 'staff_id': 'a'}), date(2026, 11, 13))
        assert len(later) == 1 and later[0]['record']['record_type'] == 'time_correction'
        assert calculate(db, date(2026, 11, 14))['items'][0]['activity_only']


def test_overnight_open_timer_not_stopped_by_freeze(env):
    env['now'] = datetime(2026, 11, 13, 23, 59)
    task = create(env, ('a',))
    a = own(env, task)
    env['call']('a', 'receive', task, assignment_id=a)
    env['call']('a', 'start', task, assignment_id=a)
    env['now'] = datetime(2026, 11, 14, 0, 2)
    with transaction(env['engine'], write=True) as db:
        db.clock = lambda: env['now']
        assert freeze(db, date(2026, 11, 13))['items'][0]['seconds'] == 60
        assert db.rows('time_segment')[0]['ended_at'] is None
    assert env['detail']('a', task)['assignment'][0]['seconds'] == 180


def test_revoke_owner_does_not_revoke_existing_worker_and_transfer(env):
    task = create(env)
    with env['engine'].begin() as c:
        c.execute(text("UPDATE mo_station_staff_config_yx SET leader_staff_id='leader2' WHERE station_id=1"))
    with pytest.raises(RuleError):
        env['call']('leader', 'cancel', task, reason='撤销')
    work(env, task)
    with transaction(env['engine'], write=True) as db:
        db.clock = lambda: env['now']
        Service(db, {'source': 'admin', 'account_id': 10, 'permissions': {'nonorder.transfer'}}).command({
            'action': 'transfer', 'task_id': task, 'revision': db.get('task', task)['revision'], 'request_id': uuid.uuid4().hex,
            'staff_id': 'leader2', 'qualification_station_ids': [1], 'reason': '原线长离岗'})
    review(env, task, staff='leader2')
    assert env['detail']('leader2', task)['task']['publisher_staff_id'] == 'leader'


def test_delegate_expires_and_cannot_redelegate(env):
    task = create(env)
    env['call']('leader', 'grant', task, staff_id='proxy', permissions=['review'], ends_at='2026-11-13T10:00:00', reason='临时代管')
    work(env, task)
    with pytest.raises(RuleError):
        env['call']('proxy', 'grant', task, staff_id='outsider', permissions=['review'], ends_at='2026-11-13T11:00:00', reason='转交')
    env['now'] = datetime(2026, 11, 13, 10)
    with pytest.raises(RuleError):
        env['detail']('proxy', task)


def test_idempotency_and_old_revision(env):
    task = create(env)
    a = own(env, task)
    rev = env['detail']('a', task)['task']['revision']
    request_id = uuid.uuid4().hex
    args = dict(assignment_id=a, revision=rev, request_id=request_id)
    first = env['call']('a', 'receive', task, **args)
    assert env['call']('a', 'receive', task, **args) == first
    with pytest.raises(RuleError):
        env['call']('a', 'start', task, assignment_id=a, revision=rev)


def test_rework_requires_new_time_materials_preserve_work_submit_time(env):
    task = create(env, ('a',))
    a = work(env, task)
    old = env['detail']('a', task)['work_record'][0]['payload']['work_submitted_at']
    review(env, task, 'materials')
    env['now'] += timedelta(hours=1)
    env['call']('a', 'submit', task, assignment_id=a, content='补充说明')
    assert env['detail']('a', task)['work_record'][-1]['payload']['work_submitted_at'] == old
    review(env, task, 'rework')
    with pytest.raises(RuleError):
        env['call']('a', 'submit', task, assignment_id=a, content='尚未补做')
    env['call']('a', 'start', task, assignment_id=a)
    env['now'] += timedelta(minutes=5)
    env['call']('a', 'submit', task, assignment_id=a, content='完成补做')
    review(env, task)
    assert len(env['detail']('a', task)['time_segment']) == 2


def test_replacement_keeps_old_submission_and_whole_division_confirmation(env):
    task = create(env, ('a',))
    a = work(env, task)
    env['call']('leader', 'replace', task, assignment_id=a, member={'staff_id': 'b', 'responsibility': '收尾'}, reason='换班')
    work(env, task, 'b')
    review(env, task)
    division = env['detail']('leader', task)['division'][0]['id']
    with pytest.raises(RuleError):
        env['call']('leader', 'confirm_division', task, division_id=division)
    review(env, task)
    env['call']('leader', 'confirm_division', task, division_id=division)
    detail = env['detail']('leader', task)
    assert detail['task']['status'] == 'done'
    assert detail['assignment'][0]['revoked_at']
    assert detail['assignment'][1]['replaces_assignment_id'] == a
    assert detail['time_segment'][0]['staff_id'] == 'a'


def test_no_self_review_and_all_revoked_not_completed(env):
    from sqlalchemy import text
    with env['engine'].begin() as c:
        c.execute(text("UPDATE mo_station_staff_config_yx SET scanner_staff_ids='[\"leader\",\"a\"]' WHERE station_id=1"))
    task = create(env, ('leader',), publish=False)
    env['call']('leader', 'set_reviewer', task, reviewer_staff_id='leader2', reason='本人执行另选核对')
    env['call']('leader', 'publish', task)
    work(env, task, 'leader')
    with pytest.raises(RuleError):
        review(env, task)
    env['call']('leader', 'replace', task, assignment_id=own(env, task, 'leader'), reason='撤销指派')
    division = env['detail']('leader', task)['division'][0]['id']
    with pytest.raises(RuleError):
        env['call']('leader', 'confirm_division', task, division_id=division)
    assert env['detail']('leader', task)['task']['status'] == 'active'


def test_two_correction_rounds_and_overlaps(env):
    task = create(env, ('a',))
    a = work(env, task)
    first = env['detail']('a', task)['time_segment'][0]
    for ended in ['2026-11-13T09:08:00', '2026-11-13T09:06:00']:
        segments = env['detail']('a', task)['time_segment']
        active = next(s for s in segments if not s['superseded_by_correction_id'])
        env['call']('a', 'correct_time', task, assignment_id=a, content='修正结束时间', before_segment_ids=[active['id']],
            proposed_segments=[{'assignment_id': a, 'started_at': active['started_at'], 'ended_at': ended}])
        review(env, task)
    segments = env['detail']('a', task)['time_segment']
    assert len(segments) == 3 and segments[0]['started_at'] == first['started_at']
    env['call']('a', 'correct_time', task, assignment_id=a, content='重复补段',
        proposed_segments=[{'assignment_id': a, 'started_at': first['started_at'], 'ended_at': '2026-11-13T09:05:00'}])
    with pytest.raises(RuleError, match='重叠'):
        review(env, task)
    assert len(env['detail']('a', task)['time_segment']) == 3


def test_cross_task_correction_needs_all_rights_and_masks_other_task(env):
    task1, task2 = create(env, ('a',)), create(env, ('a',))
    a1, a2 = own(env, task1), own(env, task2)
    env['call']('a', 'receive', task2, assignment_id=a2)
    work(env, task1)
    segment = env['detail']('a', task1)['time_segment'][0]
    env['call']('leader', 'transfer', task2, staff_id='leader2', qualification_station_ids=[3], reason='交接')
    env['call']('a', 'correct_time', task1, assignment_id=a1, content='计时记错任务', before_segment_ids=[segment['id']],
        proposed_segments=[{'assignment_id': a2, 'started_at': segment['started_at'], 'ended_at': segment['ended_at']}])
    record = env['detail']('leader', task1)['work_record'][-1]
    assert not record['can_review'] and record['payload']['proposed_segments'] == []
    with pytest.raises(RuleError):
        env['call']('leader', 'review', task1, record_id=record['id'], decision='approve')
    env['call']('leader2', 'grant', task2, staff_id='leader', permissions=['time_review'], ends_at='2026-11-14T12:00:00', reason='联合核对')
    env['call']('leader', 'review', task1, record_id=record['id'], decision='approve')
    assert env['detail']('a', task1)['assignment'][0]['seconds'] == 0
    assert env['detail']('a', task2)['assignment'][0]['seconds'] == 600


def test_scanner_removal_retains_existing_assignment_but_denies_new(env):
    from sqlalchemy import text
    task = create(env, ('a',))
    with env['engine'].begin() as c:
        c.execute(text("UPDATE mo_station_staff_config_yx SET scanner_staff_ids='[]'"))
    work(env, task)
    with pytest.raises(RuleError):
        create(env, ('a',))


def test_empty_day_has_no_snapshot_and_disabled_timer_needs_explicit_stop(env):
    from sqlalchemy import text
    task = create(env, ('a',))
    a = own(env, task)
    env['call']('a', 'receive', task, assignment_id=a)
    env['call']('a', 'start', task, assignment_id=a)
    with env['engine'].begin() as c:
        c.execute(text("UPDATE jml_staff SET status=0 WHERE id='a'"))
    assert env['detail']('leader', task)['assignment'][0]['timer_anomaly']
    env['now'] += timedelta(hours=1)
    env['call']('leader', 'stop_anomaly', task, assignment_id=a, reason='核实账号已停用')
    assert env['detail']('leader', task)['time_segment'][0]['ended_at'] == env['now'].isoformat()
    with transaction(env['engine'], write=True) as db:
        db.clock = lambda: env['now']
        assert freeze(db, date(2026, 11, 12))['items'] == []
        assert db.rows('daily_result') == []


def test_cancelled_unpublished_draft_remains_private(env):
    task = create(env, ('a',), publish=False)
    env['call']('leader', 'cancel', task, reason='草稿作废')
    with pytest.raises(RuleError):
        env['detail']('a', task)


def test_publish_requires_people_in_each_active_division(env):
    task = create(env, ('a',), publish=False)
    a = env['detail']('leader', task)['assignment'][0]['id']
    env['call']('leader', 'replace', task, assignment_id=a, reason='调整草稿人员')
    with pytest.raises(RuleError, match='指派人员'):
        env['call']('leader', 'publish', task)


def test_cancellation_preserves_approved_person_and_closes_returned_history(env):
    task = create(env)
    work(env, task, 'a')
    review(env, task)
    work(env, task, 'b')
    record = review(env, task, 'rework')
    env['call']('leader', 'cancel', task, reason='工作停止')
    detail = env['detail']('leader', task)
    assert next(a for a in detail['assignment'] if a['staff_id'] == 'a')['status'] == 'done'
    assert detail['work_record'][-1]['history_close'] is True
    env['call']('leader', 'review', task, record_id=record['id'], decision='unmet', reason='未达标，任务已取消')
    assert env['detail']('leader', task)['work_record'][-1]['status'] == 'unmet'
