from datetime import date, datetime, timedelta
import pytest

from test_workflow import env, create, own
from nonorder_core.storage import RuleError, transaction
from nonorder_core.service import Service
from nonorder_core.planning import candidates, save_changes
from nonorder_core.snapshots import calculate, freeze


def planner(db):
    return Service(db, {'source': 'admin', 'account_id': 1, 'permissions': {'nonorder.view', 'nonorder.view-all'}})


def test_published_candidates_deduplicate_and_release_locked_drafts(env):
    task = create(env, ('a',), publish=False)
    with transaction(env['engine']) as db:
        db.clock = lambda: env['now']
        assert candidates(planner(db), date(2026, 11, 13)) == []
    env['call']('leader', 'publish', task)
    a = own(env, task)
    with transaction(env['engine'], write=True) as db:
        db.clock = lambda: env['now']
        rows = candidates(planner(db), date(2026, 11, 13))
        assert len(rows) == 1 and rows[0]['group']['type'] == 'leader'
        assert db.rows('daily_item') == []  # publish never automatically schedules
        db.insert('daily_item', sheet_id=1, assignment_id=a, work_date=date(2026, 11, 13),
            responsible_staff_id='leader', sort_order=1, remark='', status='draft', revision=1,
            created_at=env['now'], plan_cutoff=env['now'] + timedelta(hours=1), operator_account_id=1, snapshot={})
        assert candidates(planner(db), date(2026, 11, 13))[0]['occupied']
    env['now'] += timedelta(hours=2)
    with transaction(env['engine']) as db:
        db.clock = lambda: env['now']
        assert not candidates(planner(db), date(2026, 11, 13))[0]['occupied']
        assert len(db.rows('daily_item')) == 1


def test_read_calculation_does_not_project_open_timer_to_midnight(env):
    task = create(env, ('a',))
    a = own(env, task)
    env['call']('a', 'receive', task, assignment_id=a)
    env['call']('a', 'start', task, assignment_id=a)
    env['now'] += timedelta(minutes=10)
    with transaction(env['engine']) as db:
        db.clock = lambda: env['now']
        assert calculate(db, date(2026, 11, 13))['items'][0]['seconds'] == 600
        assert db.rows('daily_result') == []


def test_published_zero_execution_and_cancelled_plan_execution(env):
    task = create(env, ('a',))
    a = own(env, task)
    with transaction(env['engine'], write=True) as db:
        db.clock = lambda: env['now']
        db.insert('daily_item', sheet_id=1, assignment_id=a, work_date=date(2026, 11, 13),
            responsible_staff_id='leader', sort_order=1, remark='', status='published', revision=1,
            created_at=env['now'], published_at=env['now'], plan_cutoff=datetime(2026, 11, 14), operator_account_id=1, snapshot={})
    # A stage-5 mixed save must append this task's event in the same transaction.
    env['call']('leader', 'edit_task', task, remark='记录安排版本')
    env['now'] += timedelta(minutes=1)
    with transaction(env['engine']) as db:
        db.clock = lambda: env['now']
        row = calculate(db, date(2026, 11, 13))['items'][0]
        assert row['seconds'] == 0 and row['arrangement'] == 'planned'
    env['call']('a', 'receive', task, assignment_id=a)
    env['call']('a', 'start', task, assignment_id=a)
    with transaction(env['engine'], write=True) as db:
        db.update('daily_item', db.rows('daily_item')[0]['id'], status='cancelled', cancelled_at=env['now'])
    env['call']('leader', 'edit_task', task, remark='记录取消安排版本')
    env['now'] += timedelta(minutes=1)
    with transaction(env['engine']) as db:
        db.clock = lambda: env['now']
        row = calculate(db, date(2026, 11, 13))['items'][0]
        assert row['seconds'] == 60 and row['arrangement'] == 'cancelled_with_work'


def sheet(identifier, day, plan_cutoff=datetime(2026, 11, 14)):
    return dict(id=identifier, work_date=day, plan_cutoff=plan_cutoff,
                result_cutoff=datetime.combine(day + timedelta(days=1), datetime.min.time()))


def delta(db, identifier, action="add", old=None, **fields):
    assignment = db.get("assignment", identifier)
    task = db.get("task", assignment["task_id"])
    return dict(action=action, assignment_id=identifier, task_revision=task["revision"],
                assignment_revision=assignment["revision"], **fields,
                **({"id": old["id"], "revision": old["revision"]} if old else {}))


def schedule(db):
    result = planner(db)
    result.actor["permissions"].update({"daily-tasks.manage", "nonorder.manage", "nonorder.manage-all"})
    return result


def test_drafts_dedupe_main_supplement_and_can_publish_for_other_days(env):
    task = create(env)
    a, b = own(env, task, "a"), own(env, task, "b")
    day = date(2026, 11, 13)
    main, supplement, tomorrow = sheet(1, day), sheet(2, day), sheet(3, day + timedelta(days=1))
    with transaction(env["engine"], write=True) as db:
        db.clock = lambda: env["now"]
        save_changes(schedule(db), main, [delta(db, a)])
        save_changes(schedule(db), tomorrow, [delta(db, a, publish=True), delta(db, b, publish=True)])
    with pytest.raises(RuleError, match="该日期已有安排"), transaction(env["engine"], write=True) as db:
        db.clock = lambda: env["now"]
        save_changes(schedule(db), supplement, [delta(db, a)])
    with transaction(env["engine"], write=True) as db:
        db.clock = lambda: env["now"]
        old = db.rows("daily_item", sheet_id=1)[0]
        assert calculate(db, day)["items"] == []
        save_changes(schedule(db), main, [delta(db, a, "update", old, publish=True)])
        env["now"] += timedelta(seconds=1)
        assert [(r["assignment"]["id"], r["arrangement"]) for r in calculate(db, day)["items"]] == [(a, "planned")]
        assert db.rows("daily_item", sheet_id=3)[0]["status"] == "published"


def test_explicit_reschedule_and_append_preserve_source_actual(env):
    task = create(env, ("a",))
    a = own(env, task)
    day = date(2026, 11, 13)
    main, next_day, extra_day = (sheet(i + 1, day + timedelta(days=i)) for i in range(3))
    targets = {row["work_date"]: row for row in [next_day, extra_day]}
    with transaction(env["engine"], write=True) as db:
        db.clock = lambda: env["now"]
        save_changes(schedule(db), main, [delta(db, a, publish=True)])
    env["call"]("a", "receive", task, assignment_id=a)
    env["call"]("a", "start", task, assignment_id=a)
    env["now"] += timedelta(minutes=5)
    with transaction(env["engine"], write=True) as db:
        db.clock = lambda: env["now"]
        old = db.rows("daily_item", sheet_id=1)[0]
        save_changes(schedule(db), main, [delta(db, a, "append", old, target_date=extra_day["work_date"].isoformat())], targets.get)
        assert db.rows("daily_item", sheet_id=3)[0]["status"] == "draft"
        assert db.rows("daily_item", sheet_id=1)[0]["status"] == "published"
        save_changes(schedule(db), main, [delta(db, a, "reschedule", old, target_date=next_day["work_date"].isoformat())], targets.get)
        assert db.rows("daily_item", sheet_id=2)[0]["status"] == "published"
        assert db.rows("daily_item", sheet_id=1)[0]["status"] == "cancelled"
        env["now"] += timedelta(seconds=1)
        assert calculate(db, day)["items"][0]["arrangement"] == "cancelled_with_work"
        assert any(r["seconds"] >= 300 for r in calculate(db, day)["items"])


def test_stale_second_change_rolls_back_all_plans_and_freeze_has_no_sheet_dependency(env):
    task = create(env)
    a, b = own(env, task, "a"), own(env, task, "b")
    day = date(2026, 11, 13)
    with pytest.raises(RuleError, match="草稿已保留"), transaction(env["engine"], write=True) as db:
        db.clock = lambda: env["now"]
        bad = {**delta(db, b), "assignment_revision": -1}
        save_changes(schedule(db), sheet(1, day), [delta(db, a, publish=True), bad])
    env["call"]("a", "receive", task, assignment_id=a)
    env["call"]("a", "start", task, assignment_id=a)
    env["now"] = datetime(2026, 11, 14, 0, 30)
    with transaction(env["engine"], write=True) as db:
        db.clock = lambda: env["now"]
        assert db.rows("daily_item") == []
        data = freeze(db, day)
        assert data["items"][0]["arrangement"] == "unplanned"
        assert freeze(db, day) == data
        assert len(db.rows("daily_result")) == 1
        assert db.rows("time_segment")[0]["ended_at"] is None
        with pytest.raises(RuleError, match="锁定"):
            save_changes(schedule(db), sheet(1, day), [delta(db, a)])
