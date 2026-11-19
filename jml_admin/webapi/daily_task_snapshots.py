"""Date-sheet identity, immutable cutoffs and per-sheet reporting attribution."""
import json
from datetime import datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo


def beijing_now():
    return datetime.now(ZoneInfo('Asia/Shanghai')).replace(tzinfo=None)


def unpack(value):
    return json.loads(value) if isinstance(value, str) else value


def dump(value):
    return json.dumps(value, ensure_ascii=False, default=lambda v: float(v) if isinstance(v, Decimal) else str(v))


def metadata(sheet, now):
    return {k: v for k, v in sheet.items() if k not in ('plan_data', 'result_data')} | {
        'status': sheet.get('status', 'draft'),
        'arrangement_locked': now >= sheet['plan_cutoff'],
        'result_locked': now >= sheet['result_cutoff'],
        'server_time': now,
    }


def assert_editable(sheet, now):
    if now >= sheet['plan_cutoff'] or now >= sheet['result_cutoff']:
        raise ValueError('安排单已跨日锁定，以服务器快照为准；临时新增请创建补充安排单')


def find_sheet(cursor, day, sheet_id=None):
    if sheet_id is not None:
        if type(sheet_id) is not int or sheet_id <= 0:
            raise ValueError('安排单编号无效')
        cursor.execute('SELECT * FROM mo_daily_task_sheet_yx WHERE id=%s AND work_date=%s', (sheet_id, day))
    else:
        cursor.execute("SELECT * FROM mo_daily_task_sheet_yx WHERE work_date=%s AND sheet_kind='main'", (day,))
    row = cursor.fetchone()
    if not row:
        raise ValueError('安排单不存在，请返回列表创建')
    return row


def create_sheet(cursor, day, actor, now, parent_id=None):
    if day < now.date():
        raise ValueError('不能新建历史日期的安排单')
    if parent_id is None:
        cursor.execute("SELECT * FROM mo_daily_task_sheet_yx WHERE work_date=%s AND sheet_kind='main'", (day,))
        old = cursor.fetchone()
        if old:
            return old, False
    else:
        parent = find_sheet(cursor, day, parent_id)
        if parent['sheet_kind'] != 'main':
            raise ValueError('补充安排须关联原安排单')
        if now < parent['plan_cutoff']:
            raise ValueError('原安排单尚可修改，请直接维护原单')
        if now >= parent['result_cutoff']:
            raise ValueError('执行日期已结束，不能新增补充安排')
    plan_cutoff = datetime.combine(now.date() + timedelta(days=1), time.min)
    result_cutoff = datetime.combine(day + timedelta(days=1), time.min)
    cursor.execute('''INSERT INTO mo_daily_task_sheet_yx
        (work_date,sheet_kind,parent_id,created_by,created_at,plan_cutoff,result_cutoff)
        VALUES (%s,%s,%s,%s,%s,%s,%s)''',
        (day, 'supplement' if parent_id else 'main', parent_id, actor, now, plan_cutoff, result_cutoff))
    sheet_id = cursor.lastrowid
    cursor.execute('''INSERT INTO mo_daily_task_yx (sheet_id,work_date,dept_name,created_by,created_at)
        VALUES (%s,%s,'',%s,%s)''', (sheet_id, day, actor, now))
    header_id = cursor.lastrowid
    cursor.execute('''INSERT INTO mo_daily_task_change_yx (task_id,action,after_data,actor)
        VALUES (%s,'create',%s,%s)''', (header_id, dump({'sheet_id': sheet_id, 'parent_id': parent_id}), actor))
    return find_sheet(cursor, day, sheet_id), True


def list_sheets(cursor, now):
    cursor.execute('''SELECT s.id,s.work_date,s.sheet_kind,s.parent_id,s.created_by,s.created_at,s.plan_cutoff,s.result_cutoff,
        s.plan_frozen_at,s.result_frozen_at,s.legacy_import,COALESCE(a.task_count,0) task_count,COALESCE(a.station_count,0) station_count,
        CASE WHEN COALESCE(a.published_count,0)=0 THEN 'draft'
             WHEN a.published_count=a.task_count THEN 'published' ELSE 'partial' END status
        FROM mo_daily_task_sheet_yx s LEFT JOIN (
          SELECT h.sheet_id,COUNT(*) task_count,COUNT(DISTINCT i.station_id) station_count,
            SUM(h.status='published') published_count
          FROM mo_daily_task_yx h JOIN mo_daily_task_item_yx i ON i.task_id=h.id
          WHERE i.status='active' GROUP BY h.sheet_id
        ) a ON a.sheet_id=s.id ORDER BY s.work_date DESC,s.id DESC''')
    return [metadata(row, now) for row in cursor.fetchall()]


def with_creator_names(cursor, sheets):
    identifiers = sorted({row['created_by'] for row in sheets if row.get('created_by')})
    if not identifiers:
        return sheets
    markers = ','.join(['%s'] * len(identifiers))
    # Read account rows by login and historical platform subject. Staff binding
    # is optional in older databases, so access it only when present.
    cursor.execute(f"""SELECT * FROM mo_admin_account_yx
        WHERE username IN ({markers}) OR (auth_source='oidc' AND subject IN ({markers}))""",
        (*identifiers, *identifiers))
    accounts = cursor.fetchall()
    staff_ids = sorted({str(a['staff_id']) for a in accounts if a.get('staff_id')})
    staff = {}
    if staff_ids:
        markers = ','.join(['%s'] * len(staff_ids))
        cursor.execute(f'SELECT id,name FROM jml_staff WHERE id IN ({markers})', tuple(staff_ids))
        staff = {str(row['id']): row['name'] for row in cursor.fetchall()}
    by_login, by_subject = {}, {}
    for account in accounts:
        login = account['username']
        name = staff.get(str(account.get('staff_id'))) or (account.get('display_name') or '').strip()
        if not name or name == login or name == account['subject']:
            continue
        by_login.setdefault(login, set()).add(name)
        if account['auth_source'] == 'oidc':
            by_subject.setdefault(account['subject'], set()).add(name)
    for sheet in sheets:
        login = sheet.get('created_by')
        names = by_login.get(login, set()) | by_subject.get(login, set())
        if len(names) == 1:
            sheet['creator_display_name'] = next(iter(names))
    return sheets


def freeze_plan(cursor, sheet, headers, items, stations, changes, now):
    if now < sheet['plan_cutoff'] or sheet.get('plan_data'):
        return
    payload = {'headers': headers, 'items': items, 'stations': stations, 'changes': changes}
    cursor.execute('''UPDATE mo_daily_task_sheet_yx SET plan_data=%s,plan_frozen_at=%s
        WHERE id=%s AND plan_data IS NULL''', (dump(payload), now, sheet['id']))
    sheet['plan_data'], sheet['plan_frozen_at'] = payload, now


def freeze_result(cursor, sheet, result, now):
    if now < sheet['result_cutoff'] or sheet.get('result_data'):
        return
    result = {**result, 'candidates': [], 'target_headers': []}
    cursor.execute('''UPDATE mo_daily_task_sheet_yx SET result_data=%s,result_frozen_at=%s
        WHERE id=%s AND result_data IS NULL''', (dump(result), now, sheet['id']))
    sheet['result_data'], sheet['result_frozen_at'] = result, now


def actual_for(actuals, item, key):
    return actuals.get(('item', item.get('id')), {} if actuals.get(('_allocated', 0)) else actuals.get((str(item['work_date']), key(item)), {}))


def allocate_actuals(items, actuals, key):
    """Oldest sheet first; allocate grades and receipts separately, never duplicate totals."""
    result = dict(actuals)
    result[('_allocated', 0)] = True
    groups = {}
    for item in items:
        if item['status'] == 'active':
            groups.setdefault((str(item['work_date']), key(item)), []).append(item)
        else:
            result[('item', item['id'])] = {}
    fields = ('qty_a', 'qty_a1', 'qty_a2', 'qty_c')
    for group, rows in groups.items():
        rows.sort(key=lambda r: (r.get('sheet_id') or 0, r['id']))
        total = actuals.get(group, {})
        stock = {f: Decimal(str(total.get(f) or 0)) for f in (*fields, 'received')}
        for index, row in enumerate(rows):
            budget = max(Decimal(0), Decimal(str(row['quantity'])) - Decimal(str(row['transferred_qty'])))
            actual = {**total, **{f: Decimal(0) for f in (*fields, 'received', 'done')}}
            last = index == len(rows) - 1
            actual['received'] = stock['received'] if last else min(stock['received'], budget)
            stock['received'] -= actual['received']
            for field in fields:
                take = stock[field] if last else min(stock[field], budget)
                actual[field] = take
                stock[field] -= take
                budget -= min(budget, take)
                actual['done'] += take
            result[('item', row['id'])] = actual
    return result


def capture_due(cursor, now):
    """Called under the same advisory lock as saves; never calls ERP or changes reporting."""
    from daily_station_tasks import load_items, load_actuals, load_stations, enrich_items, key
    cursor.execute("""SELECT * FROM mo_daily_task_sheet_yx
        WHERE (plan_cutoff<=%s AND plan_data IS NULL) OR (result_cutoff<=%s AND result_data IS NULL)
        ORDER BY work_date,id""", (now, now))
    due = cursor.fetchall()
    if not due:
        return
    stations = load_stations(cursor)
    items = load_items(cursor)
    by_date = {}
    for sheet in due:
        cursor.execute('SELECT * FROM mo_daily_task_yx WHERE sheet_id=%s ORDER BY dept_name', (sheet['id'],))
        headers = cursor.fetchall()
        cursor.execute("""SELECT c.* FROM mo_daily_task_change_yx c JOIN mo_daily_task_yx h ON h.id=c.task_id
            WHERE h.sheet_id=%s ORDER BY c.id DESC""", (sheet['id'],))
        changes = cursor.fetchall()
        own = [i for i in items if i['sheet_id'] == sheet['id']]
        freeze_plan(cursor, sheet, headers, own, stations, changes, now)
        if now < sheet['result_cutoff'] or sheet.get('result_data'):
            continue
        day = sheet['work_date']
        if day not in by_date:
            # All sheets for a day share one cutoff, including historical backfill mode.
            cursor.execute('SELECT MAX(legacy_import) legacy_import FROM mo_daily_task_sheet_yx WHERE work_date=%s', (day,))
            historical = cursor.fetchone()['legacy_import']
            raw = load_actuals(cursor, datetime.combine(day, time.min), sheet['result_cutoff'],
                               as_of=None if historical else sheet['result_cutoff'])
            by_date[day] = allocate_actuals([i for i in items if i['work_date'] == day], raw, key)
        actuals = by_date[day]
        plan = unpack(sheet['plan_data'])
        rows = enrich_items(plan['items'], actuals, [])
        matched = {key(i) for i in items if i['work_date'] == day and i['status'] == 'active'}
        outside = [dict(a, dept_name='未标部门', unit_name='未标单位') for (d, k), a in actuals.items()
                   if d == str(day) and k not in matched] if sheet['sheet_kind'] == 'main' else []
        freeze_result(cursor, sheet, dict(date=str(day), headers=plan['headers'], items=rows,
            stations=plan['stations'], changes=plan['changes'], unplanned=outside,
            candidates=[], target_headers=[], generated_at=now, warnings=[]), now)
