"""Lifecycle integration uses an isolated in-memory database; never application data."""
from datetime import date, datetime
from decimal import Decimal
import json
import sqlite3
from unittest.mock import MagicMock

from flask import Flask, g
import pytest
import daily_station_tasks as tasks
import daily_task_snapshots as snapshots
from test_daily_station_tasks import fixture_rows, task


class Cursor:
    def __init__(self, db):
        self.inner = db.cursor()
    def execute(self, sql, params=()):
        if 'GET_LOCK(' in sql or 'RELEASE_LOCK(' in sql:
            self.inner.execute('SELECT 1 locked')
            return
        sql = sql.replace('%s', '?').replace(' FOR UPDATE', '').replace('NOW()', "datetime('now')")
        sql = sql.replace('INSERT IGNORE', 'INSERT OR IGNORE')
        args = tuple(str(v) if isinstance(v, (Decimal, date, datetime)) else v for v in params)
        self.inner.execute(sql, args)
    @property
    def lastrowid(self):
        return self.inner.lastrowid
    def convert(self, row):
        if row is None:
            return None
        result = dict(row)
        for k in ('work_date',):
            if result.get(k):
                result[k] = date.fromisoformat(result[k])
        for k in ('created_at', 'plan_cutoff', 'result_cutoff', 'plan_frozen_at', 'result_frozen_at'):
            if result.get(k):
                result[k] = datetime.fromisoformat(result[k])
        return result
    def fetchone(self):
        return self.convert(self.inner.fetchone())
    def fetchall(self):
        return [self.convert(r) for r in self.inner.fetchall()]
    def close(self):
        self.inner.close()


class Connection:
    def __init__(self):
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
          CREATE TABLE mo_daily_task_sheet_yx(id INTEGER PRIMARY KEY, work_date TEXT, sheet_kind TEXT,
            parent_id INTEGER, created_by TEXT, created_at TEXT, plan_cutoff TEXT,result_cutoff TEXT,
            plan_data TEXT,result_data TEXT,plan_frozen_at TEXT,result_frozen_at TEXT,legacy_import INTEGER DEFAULT 0);
          CREATE UNIQUE INDEX one_main ON mo_daily_task_sheet_yx(work_date) WHERE sheet_kind='main';
          CREATE TABLE mo_daily_task_yx(id INTEGER PRIMARY KEY,sheet_id INTEGER NOT NULL,work_date TEXT,
            dept_name TEXT,status TEXT DEFAULT 'draft',revision INTEGER DEFAULT 1,created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,published_by TEXT,published_at TEXT,
            UNIQUE(sheet_id,dept_name));
          CREATE TABLE mo_daily_task_item_yx(id INTEGER PRIMARY KEY,task_id INTEGER,mo_code TEXT,sort_seq INTEGER,
            route_id INTEGER,seq INTEGER,station_id INTEGER,kind TEXT,quantity NUMERIC,sort_order INTEGER,
            remark TEXT,snapshot TEXT,status TEXT DEFAULT 'active',transferred_qty NUMERIC DEFAULT 0);
          CREATE TABLE mo_daily_task_change_yx(id INTEGER PRIMARY KEY,task_id INTEGER,item_id INTEGER,
            related_item_id INTEGER,action TEXT,before_data TEXT,after_data TEXT,actor TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP);
          CREATE TABLE mo_workstation_yx(id INTEGER,station_name TEXT,is_active INTEGER);
          CREATE TABLE mo_station_staff_config_yx(station_id INTEGER,leader_staff_id INTEGER);
          CREATE TABLE jml_staff(id INTEGER,name TEXT);
          CREATE TABLE mo_route_step_yx(id INTEGER,route_id INTEGER,seq INTEGER);
          CREATE TABLE mo_step_station_yx(step_id INTEGER,station_id INTEGER);
          INSERT INTO mo_workstation_yx VALUES(7,'水性一',1);
          INSERT INTO mo_route_step_yx VALUES(1,3,1);
          INSERT INTO mo_step_station_yx VALUES(1,7);
        """)
    def cursor(self, **_):
        return Cursor(self.db)
    def commit(self):
        self.db.commit()
    def rollback(self):
        self.db.rollback()
    def close(self):
        pass


@pytest.fixture
def scenario(monkeypatch):
    conn = Connection()
    clock = [datetime(2026,11,11,12)]
    monkeypatch.setattr(snapshots, 'beijing_now', lambda: clock[0])
    snapshot, _, _ = fixture_rows()
    operations = MagicMock(return_value=snapshot)
    actuals = {}
    monkeypatch.setattr(tasks, 'load_actuals', lambda c, since, until, as_of=None: {
        k: v for k,v in actuals.items() if since.date() <= date.fromisoformat(k[0]) < until.date()})
    app = Flask('snapshots')
    app.register_blueprint(tasks.daily_tasks_blueprint(lambda:conn, operations))
    @app.before_request
    def actor():
        g.audit_username = 'PMC'
    yield app.test_client(), conn, clock, actuals, operations
    conn.db.close()


def create(client, parent=None, day='2026-11-12'):
    response = client.post('/api/mo/daily-tasks/save', json=dict(action='create', date=day, parent_id=parent))
    assert response.status_code == 200, response.json
    return response.json['data']['sheet']


def save(client, sheet, amount, existing=None, **extra):
    row = {**task(id=-1, quantity=amount), **(existing or {}), 'quantity': amount}
    # Avoid serialization of dates/Decimal from test fixtures.
    row = {k: v for k,v in row.items() if k in ('id','mo_code','sort_seq','route_id','seq','station_id','kind','status','sort_order','remark','quantity')}
    return client.post('/api/mo/daily-tasks/save', json=dict(action='batch_sheet', sheet_id=sheet['id'],
        date=sheet['work_date'], batches=[dict(dept_name='部门甲',revision=existing.get('revision', 1) if existing else 0,items=[row], **extra)]))


def get(client, sheet):
    response = client.get('/api/mo/daily-tasks', query_string=dict(date=sheet['work_date'],sheet_id=sheet['id']))
    assert response.status_code == 200, response.json
    return response.json['data']


def test_creation_cutoff_is_not_execution_date_and_old_draft_cannot_save(scenario):
    client, conn, clock, actuals, operations = scenario
    sheet = create(client, day='2026-11-15')
    assert sheet['plan_cutoff'] == '2026-11-12 00:00:00'
    assert sheet['result_cutoff'] == '2026-11-16 00:00:00'
    response = save(client,sheet,20)
    assert response.status_code == 200, response.json
    clock[0] = datetime(2026,11,12)
    old = get(client,sheet)
    assert old['sheet']['arrangement_locked'] and not old['sheet']['result_locked']
    assert old['items'][0]['quantity'] == 20
    for action in ('batch_sheet','batch','edit','cancel','carry','reorder','publish','add'):
        response = client.post('/api/mo/daily-tasks/save',json=dict(action=action,date=sheet['work_date'],sheet_id=sheet['id']))
        assert response.status_code == 400
        assert '锁定' in response.json['msg']
    assert get(client,sheet)['items'][0]['quantity'] == 20


def test_nonorder_mixed_save_rolls_back_as_one_transaction(scenario, monkeypatch):
    import nonorder_daily
    from nonorder_core.storage import RuleError

    client, conn, clock, _, _ = scenario
    clock[0] = datetime(2026, 11, 12, 10)
    sheet = create(client)
    conn.db.execute('CREATE TABLE nonorder_marker (memo TEXT)')
    conn.commit()

    class PlanStore:
        def __init__(self, cursor):
            self.cursor = cursor

        def now(self):
            return clock[0]

        def stamp_events(self):
            pass

    monkeypatch.setattr(nonorder_daily, 'acquire', lambda _: True)
    monkeypatch.setattr(nonorder_daily, 'service_for', lambda cursor: type('PlanService', (), {'db': PlanStore(cursor)})())
    monkeypatch.setattr(nonorder_daily, 'sheet_data', lambda *_: {})

    def plan_save(service, _, edits):
        service.db.cursor.execute('INSERT INTO nonorder_marker VALUES (%s)', (edits[0]['mark'],))
        if edits[0]['mark'] == 'denied':
            raise RuleError('没有此任务的安排权限', 403)
        return []

    monkeypatch.setattr(nonorder_daily, 'save', plan_save)
    original = dict(action='batch_sheet', sheet_id=sheet['id'], date=sheet['work_date'])
    batch = dict(dept_name='部门甲', revision=0, items=[task(id=-1, quantity=2)])
    invalid_workorder = client.post('/api/mo/daily-tasks/save', json={
        **original, 'batches': [{**batch, 'revision': 99}], 'nonorder_changes': [{'mark': 'rollback'}],
    })
    assert invalid_workorder.status_code == 400
    invalid_nonorder = client.post('/api/mo/daily-tasks/save', json={
        **original, 'batches': [batch], 'nonorder_changes': [{'mark': 'denied'}],
    })
    assert invalid_nonorder.status_code == 403
    assert conn.db.execute('SELECT COUNT(*) FROM nonorder_marker').fetchone()[0] == 0
    assert conn.db.execute('SELECT COUNT(*) FROM mo_daily_task_item_yx').fetchone()[0] == 0
    combined = client.post('/api/mo/daily-tasks/save', json={
        **original, 'batches': [batch], 'nonorder_changes': [{'mark': 'saved'}],
    })
    assert combined.status_code == 200, combined.json
    only = client.post('/api/mo/daily-tasks/save', json={
        **original, 'batches': [], 'nonorder_only': True, 'nonorder_changes': [{'mark': 'saved only nonorder'}],
    })
    assert only.status_code == 200, only.json
    assert conn.db.execute('SELECT COUNT(*) FROM nonorder_marker').fetchone()[0] == 2
    assert conn.db.execute('SELECT revision FROM mo_daily_task_yx WHERE dept_name<>\'\'').fetchone()[0] == 2


def test_nonorder_worker_finds_dates_even_without_arrangement_sheet(monkeypatch):
    import nonorder_daily

    cursor = MagicMock()
    cursor.fetchall.side_effect = [
        [{'day': date(2026, 11, 14)}],
        [{'first_day': date(2026, 11, 11), 'last_day': date(2026, 11, 15)}],
        [{'work_date': date(2026, 11, 11)}, {'work_date': date(2026, 11, 13)}],
    ]
    freeze = MagicMock()
    monkeypatch.setattr(nonorder_daily, 'freeze', freeze)
    nonorder_daily.capture_due(cursor, datetime(2026, 11, 15, 0, 15))
    assert [call.args[1] for call in freeze.call_args_list] == [date(2026, 11, 12), date(2026, 11, 14)]


def test_export_download_places_workorders_and_nonorder_on_one_sheet(scenario, monkeypatch):
    from io import BytesIO
    from openpyxl import load_workbook
    import nonorder_daily

    client, _, _, _, _ = scenario
    current = create(client)
    assert save(client, current, 3).status_code == 200
    plan = {
        'id': 11, 'work_date': current['work_date'], 'status': 'published', 'sort_order': 1,
        'group': {'type': 'leader', 'id': 'leader', 'name': '负责人甲'},
        'task': {'responsible_name': '负责人甲', 'content': '仓库盘点'},
        'division': {'content': '库存盘点 · A区'},
        'assignment': {'staff_name': '员工甲', 'responsibility': '=本次盘点范围'},
    }
    monkeypatch.setattr(nonorder_daily, 'service_for', lambda _: object())
    seen = []
    def sheet_data(service, sheet, *, export):
        seen.append((sheet['id'], export))
        draft = dict(plan, id=13, status='draft', group={'type': 'station', 'id': 7, 'name': '水性一'},
                     remark='完工后登记')
        return {'items': [plan, dict(plan, id=12, status='cancelled'), draft]}
    monkeypatch.setattr(nonorder_daily, 'sheet_data', sheet_data)
    response = client.get('/api/mo/daily-tasks/export', query_string={'sheet_id': current['id'], 'date': current['work_date']})
    assert response.status_code == 200
    assert seen == [(current['id'], True)]
    book = load_workbook(BytesIO(response.data))
    assert book.sheetnames == ['任务安排']
    page = book.active
    assert page['C3'].value == 3
    assert page.max_row == 5
    assert page['A4'].value == '水性一\n负责人甲'
    assert page['A5'].value == '无工站\n负责人甲'
    assert (page['B4'].value, page['B5'].value) == ('未发布', '已发布')
    assert page['C4'].value is None and page['C5'].value is None
    assert page['D4'].value == '执行人：员工甲\n个人职责：=本次盘点范围\n安排备注：完工后登记'
    assert page['D5'].value == '执行人：员工甲\n个人职责：=本次盘点范围'
    assert page['E5'].value == '库存盘点 · A区' and page['D5'].data_type == 's'
    assert page['A2'].fill.fgColor.rgb[-6:] == 'D9EAF7'
    assert page.auto_filter.ref == 'A2:E5'


@pytest.mark.parametrize('results_locked', [False, True])
def test_day_export_combines_main_and_supplement_using_saved_snapshots(scenario, monkeypatch, results_locked):
    from io import BytesIO
    from openpyxl import load_workbook
    import nonorder_daily

    client, conn, clock, _, operations = scenario
    day = '2026-11-16'
    main = create(client, day=day)
    assert save(client, main, 3).status_code == 200
    clock[0] = datetime(2026, 11, 15, 12)
    get(client, main)
    supplement = create(client, day=day, parent=main['id'])
    other_day = create(client, day='2026-11-17')
    assert save(client, other_day, 2).status_code == 200
    conn.db.execute("UPDATE mo_daily_task_item_yx SET quantity=99 WHERE task_id IN (SELECT id FROM mo_daily_task_yx WHERE sheet_id=?)", (main['id'],))
    conn.commit()
    if results_locked:
        clock[0] = datetime(2026, 11, 17, 1)
        get(client, supplement)

    seen = []
    monkeypatch.setattr(nonorder_daily, 'service_for', lambda _: object())
    def scoped_rows(_, selected, *, export):
        assert export
        seen.append(selected['id'])
        return {'items': [{
            'id': 21 if selected['id'] == supplement['id'] else 18,
            'assignment_id': 31, 'work_date': day, 'sort_order': 1,
            'status': 'published' if selected['id'] == supplement['id'] else 'draft',
            'group': {'type': 'leader', 'name': '张线长'},
            'task': {'responsible_name': '张线长', 'content': '库区盘点'},
            'division': {'content': '盘点 A 区'},
            'assignment': {'staff_name': '李甲', 'responsibility': '核对存量'},
        }]}
    monkeypatch.setattr(nonorder_daily, 'sheet_data', scoped_rows)
    operations.reset_mock()
    response = client.get('/api/mo/daily-tasks/export', query_string={'date': day, 'scope': 'day', 'sheet_id': supplement['id']})
    assert response.status_code == 200, response.json
    operations.assert_not_called()
    assert seen == [main['id'], supplement['id']]
    book = load_workbook(BytesIO(response.data))
    assert book.sheetnames == ['任务安排']
    page = book.active
    assert page['A1'].value == '当日任务安排 · 2026-11-16'
    assert [cell.value for cell in page[2][:6]] == ['生产线名称', '开线状态', '计划数量', '备注', '工单号', '派单类型']
    assert page['C3'].value == 3 and page['F3'].value == '任务派单\n主单'
    assert page.max_row == 4 and page['E4'].value == '盘点 A 区'
    assert page['B4'].value == '已发布' and page['C4'].value is None
    assert page['F4'].value == f"无工单排单\n补充安排 #{supplement['id']}"
    assert page.auto_filter.ref == 'A2:F4'
    printed = client.get('/api/mo/daily-tasks/export', query_string={'date': day, 'scope': 'day', 'format': 'print'})
    assert printed.status_code == 200, printed.json
    table = printed.json['data']
    assert table['title'] == page['A1'].value
    assert table['headers'] == [cell.value for cell in page[2]]
    assert [[value if value != '' else None for value in row['values']] for row in table['rows']] == [
        [cell.value for cell in page[3]], [cell.value for cell in page[4]],
    ]
    operations.assert_not_called()


def test_export_preserves_frozen_leader_and_supports_legacy_snapshot(scenario):
    from io import BytesIO
    from openpyxl import load_workbook
    client, conn, clock, _, _ = scenario
    conn.db.execute("INSERT INTO jml_staff VALUES(1,'员工A')")
    conn.db.execute('INSERT INTO mo_station_staff_config_yx VALUES(7,1)')
    conn.commit()
    main = create(client)
    assert save(client, main, 20).status_code == 200
    clock[0] = datetime(2026,11,13)
    final = get(client, main)
    assert final['stations'][0]['leader_name'] == '员工A'
    conn.db.execute("UPDATE jml_staff SET name='员工B' WHERE id=1")
    conn.commit()

    def exported_name():
        response = client.get('/api/mo/daily-tasks/export', query_string=dict(date=main['work_date'], sheet_id=main['id']))
        assert response.status_code == 200
        return load_workbook(BytesIO(response.data)).active['A3'].value

    assert exported_name() == '水性一\n员工A'
    legacy = json.loads(conn.db.execute('SELECT result_data FROM mo_daily_task_sheet_yx WHERE id=?', (main['id'],)).fetchone()[0])
    del legacy['stations'][0]['leader_name']
    original = json.dumps(legacy, ensure_ascii=False)
    conn.db.execute('UPDATE mo_daily_task_sheet_yx SET result_data=? WHERE id=?', (original, main['id']))
    conn.commit()
    assert exported_name() == '水性一\n员工B'
    assert get(client, main)['stations'][0]['leader_name'] == '员工B'
    assert conn.db.execute('SELECT result_data FROM mo_daily_task_sheet_yx WHERE id=?', (main['id'],)).fetchone()[0] == original


def test_supplement_is_separate_and_final_results_are_immutable(scenario):
    client, conn, clock, actuals, operations = scenario
    main = create(client)
    assert save(client,main,20).status_code == 200
    early = client.post('/api/mo/daily-tasks/save',json=dict(action='create',date=main['work_date'],parent_id=main['id']))
    assert early.status_code == 400
    clock[0] = datetime(2026,11,12,9)
    sub = create(client, main['id'])
    assert sub['sheet_kind'] == 'supplement' and sub['parent_id'] == main['id']
    assert sub['plan_cutoff'] == sub['result_cutoff'] == '2026-11-13 00:00:00'
    response = save(client,sub,10)
    assert response.status_code == 200, response.json
    assert get(client,main)['items'][0]['quantity'] == 20
    actuals[('2026-11-12',tasks.key(task()))] = dict(task(),done=Decimal('25.5'),qty_a=Decimal('24'),qty_a1=Decimal('1.5'),qty_a2=0,qty_c=0,received=Decimal('27'),process_name='水性',station_name='水性一')
    assert get(client,main)['items'][0]['actual']['done'] == 20
    live = get(client,sub)
    assert live['items'][0]['actual']['done'] == 5.5
    assert live['items'][0]['actual']['qty_a1'] == 1.5
    clock[0] = datetime(2026,11,13)
    final_main, final_sub = get(client,main),get(client,sub)
    assert final_sub['sheet']['result_locked'] and final_sub['sheet']['result_frozen_at']
    actuals.clear()  # deleted/changed reports later must not change past snapshots
    operations.side_effect = AssertionError('Final snapshots must not depend on ERP')
    assert get(client,main)['items'] == final_main['items']
    assert get(client,sub)['items'] == final_sub['items']
    result = client.get('/api/mo/daily-tasks/export',query_string=dict(date=sub['work_date'],sheet_id=sub['id']))
    assert result.status_code == 200 and result.data[:2] == b'PK'
    assert save(client,sub,40).status_code == 400
    late = client.post('/api/mo/daily-tasks/save',json=dict(action='create',date=sub['work_date'],parent_id=main['id']))
    assert late.status_code == 400


def test_midnight_during_erp_read_rejects_save(scenario):
    client, conn, clock, _, operations = scenario
    main = create(client)
    def cross_midnight(now):
        clock[0] = datetime(2026,11,12)
        return fixture_rows()[0]
    operations.side_effect = cross_midnight
    assert save(client,main,20).status_code == 400
    assert conn.db.execute('SELECT COUNT(*) FROM mo_daily_task_item_yx').fetchone()[0] == 0


def test_midnight_during_write_rolls_back_all_departments(scenario,monkeypatch):
    client, conn, clock, _, _ = scenario
    main = create(client)
    original = tasks.save_sheet_batch
    def late(*args):
        original(*args)
        clock[0] = datetime(2026,11,12)
    monkeypatch.setattr(tasks,'save_sheet_batch',late)
    response = save(client,main,20)
    assert response.status_code == 400, response.json
    assert conn.db.execute('SELECT COUNT(*) FROM mo_daily_task_item_yx').fetchone()[0] == 0


def test_read_plan_after_live_rows_change_uses_snapshot(scenario):
    client, conn, clock, _, _ = scenario
    main = create(client)
    assert save(client,main,20).status_code == 200
    clock[0] = datetime(2026,11,12)
    original = get(client,main)
    conn.db.execute("UPDATE mo_daily_task_item_yx SET quantity=999,remark='changed externally'")
    conn.commit()
    assert get(client,main)['items'] == original['items']


def test_worker_backfills_without_browser_and_keeps_first_capture(scenario):
    from daily_task_snapshot_worker import run_once
    client, conn, clock, _, _ = scenario
    main = create(client)
    assert save(client,main,20).status_code == 200
    clock[0] = datetime(2026,11,13,8)
    run_once(lambda:conn)
    first = conn.db.execute('SELECT plan_data,result_data,result_frozen_at FROM mo_daily_task_sheet_yx').fetchone()
    assert first[0] and first[1] and first[2] == '2026-11-13 08:00:00'
    clock[0] = datetime(2026,11,14)
    run_once(lambda:conn)
    assert tuple(conn.db.execute('SELECT plan_data,result_data,result_frozen_at FROM mo_daily_task_sheet_yx').fetchone()) == tuple(first)


def test_legacy_http_request_cannot_bypass_midnight_lock(scenario):
    client, conn, clock, _, _ = scenario
    main = create(client)
    clock[0] = datetime(2026,11,12)
    response = client.post('/api/mo/daily-tasks/save',json=dict(action='add',date=main['work_date']))
    assert response.status_code == 400 and '锁定' in response.json['msg']


def test_receipt_and_completion_cutoff_filters_are_parameterized():
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    since, until = datetime(2026,11,12),datetime(2026,11,13)
    tasks.load_actuals(cursor,since,until,as_of=until)
    complete, receipt = cursor.execute.call_args_list
    assert 'c.create_time < %s' in complete.args[0]
    assert complete.args[1] == (since,until,until,since,until,until)
    assert 'l.created_at < %s' in receipt.args[0]
    assert receipt.args[1] == (since,until,until)
    cursor.reset_mock()
    tasks.load_actuals(cursor,since,until)
    assert 'c.create_time <' not in cursor.execute.call_args_list[0].args[0]


def test_carry_to_locked_target_is_rejected_without_changing_source(scenario):
    client, conn, clock, _, _ = scenario
    target = create(client,day='2026-11-15')
    clock[0] = datetime(2026,11,12,9)
    source = create(client,day='2026-11-13')
    response = save(client,source,20)
    assert response.status_code == 200, response.json
    row = response.json['data']['items'][0]
    response = save(client,source,20,existing=row,carries=[dict(id=row['id'],target_date=target['work_date'],quantity=5,target_revision=0)])
    assert response.status_code == 400 and '锁定' in response.json['msg']
    assert get(client,source)['items'][0]['transferred_qty'] == 0
    assert not get(client,target)['items']
