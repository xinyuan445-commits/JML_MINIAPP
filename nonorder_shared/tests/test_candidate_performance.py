import json
import pytest
from sqlalchemy import event, text
from test_workflow import env, create
from nonorder_core.storage import transaction, RuleError
from nonorder_core.service import Service


def old_scope(db, staff):
    rows = db.external('''SELECT c.station_id,c.scanner_staff_ids,c.leader_staff_id,w.station_name
        FROM mo_station_staff_config_yx c JOIN mo_workstation_yx w ON w.id=c.station_id
        WHERE (c.leader_staff_id=:id OR :exempt=1) AND w.is_active=1''', id=staff, exempt=int(db.exempt(staff)))
    stations, people = {}, {}
    for row in rows:
        stations[row['station_id']] = row['station_name']
        ids = json.loads(row['scanner_staff_ids']) + [row['leader_staff_id']]
        for identifier in set(map(str, ids)):
            try:
                person = db.person(identifier)
            except RuleError:
                continue
            people.setdefault(identifier, {**person, 'station_ids': []})['station_ids'].append(row['station_id'])
    return stations, people


@pytest.mark.parametrize('staff', ['leader', 'leader2', 'outsider', 'a'])
def test_batch_candidates_match_original_rules(env, staff):
    task = create(env, ('a',), publish=False)
    with env['engine'].begin() as c:
        c.execute(text("UPDATE mo_station_staff_exemption_yx SET staff_ids='[\"outsider\",\"a\"]'"))
        c.execute(text("UPDATE jml_staff SET status=0 WHERE id='b'"))
        c.execute(text("UPDATE mo_workstation_yx SET is_active=0 WHERE id=3"))
    with transaction(env['engine']) as db:
        db.clock = lambda: env['now']
        s = Service(db, {'source': 'mini', 'staff_id': staff})
        assert db.scope(staff) == old_scope(db, staff)
        for target in (None, db.get('task', task)):
            expected = {str(p['id']) for p in db.external('SELECT id,name,status FROM jml_staff WHERE status=1')
                        if s.reviewer_eligible(str(p['id']), target['id'] if target else None)}
            assert {p['id'] for p in s.reviewer_candidates(target)} == expected


def test_context_query_count_does_not_grow_with_employee_count(env):
    def count():
        queries = []
        def observed(conn, cursor, statement, parameters, context, executemany):
            queries.append(statement)
        event.listen(env['engine'], 'before_cursor_execute', observed)
        try:
            with transaction(env['engine']) as db:
                db.clock = lambda: env['now']
                result = Service(db, {'source': 'mini', 'staff_id': 'leader'}).context()
            return len(queries), result
        finally:
            event.remove(env['engine'], 'before_cursor_execute', observed)
    before, original = count()
    with env['engine'].begin() as c:
        c.execute(text('INSERT INTO jml_staff VALUES (:id,:id,1)'), [{'id': f'employee{i}'} for i in range(500)])
    after, current = count()
    assert original == current
    assert after == before and after <= 22
    with env['engine'].begin() as c:
        c.execute(text("UPDATE mo_station_staff_config_yx SET leader_staff_id=NULL WHERE leader_staff_id='leader'"))
    _, revoked = count()
    assert not revoked['can_publish']
    assert not revoked['scanners']
