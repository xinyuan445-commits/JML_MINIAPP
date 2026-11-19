"""Read-only report totals over real completion batches (never execution counters)."""
from collections import defaultdict
from datetime import timedelta


def summarize(rows, start, end, order_count, plans=()):
    processes = defaultdict(lambda: {'normal': 0, 'rework': 0, 'normal_count': 0, 'rework_count': 0})
    trend_start = end - timedelta(days=6)
    trend = {str(trend_start + timedelta(days=i)): {'normal': 0, 'rework': 0} for i in range(7)}
    grades = dict.fromkeys(('a', 'a1', 'a2', 'c'), 0)
    counts = {'normal': 0, 'rework': 0}
    completed = 0
    process_grades = defaultdict(lambda: dict.fromkeys(('a', 'a1', 'a2', 'c'), 0))
    for row in rows:
        day = str(row['day'])[:10]
        kind = row['kind']
        if day in trend:
            trend[day][kind] += int(row['batch_count'])
        if not str(start) <= day <= str(end):
            continue
        counts[kind] += int(row['batch_count'])
        process = processes[row['process_name'] or '未命名工序']
        process[kind] += float(row['qty'] or 0)
        process[kind + '_count'] += int(row['batch_count'])
        if kind == 'normal':
            completed += float(row['qty'] or 0)
            for grade in grades:
                grades[grade] += float(row['qty_' + grade] or 0)
                process_grades[row['process_name'] or '未命名工序'][grade] += float(row['qty_' + grade] or 0)
    total = sum(grades.values())
    plan_totals = defaultdict(float)
    missing_plans = set()
    plan_processes = set()
    process_order = {}
    seen = set()
    for row in plans:
        key = (row['mo_code'], row['sort_seq'], row['route_id'], row['seq'])
        if key in seen:
            continue
        seen.add(key)
        name = row['process_name'] or '未命名工序'
        plan_processes.add(name)
        process_order[name] = min(process_order.get(name, row['seq']), row['seq'])
        if row.get('plan_qty') is None:
            missing_plans.add(name)
        else:
            plan_totals[name] += float(row['plan_qty'])
    chart = []
    for name, process in processes.items():
        if not process['normal_count']:
            continue
        quality = process_grades[name]
        bad = sum(quality[g] for g in ('a1', 'a2', 'c'))
        known_plan = name in plan_processes and name not in missing_plans
        chart.append(dict(name=name, plan_qty=plan_totals[name] if known_plan else None,
            completed_qty=process['normal'], good_qty=quality['a'], bad_qty=bad,
            yield_rate=round(quality['a'] / process['normal'] * 100, 2) if process['normal'] else None))
    chart.sort(key=lambda item: (process_order.get(item['name'], 9999), item['name']))
    bad = grades['a1'] + grades['a2'] + grades['c']
    return {
        'plan_qty': sum(p['plan_qty'] for p in chart) if all(p['plan_qty'] is not None for p in chart) else None,
        'completed_qty': completed, 'good_qty': grades['a'], 'bad_qty': bad,
        'defect_rate': round(bad / completed * 100, 2) if completed else None,
        'defect_breakdown': [dict(grade=g.upper(), qty=grades[g],
            rate=round(grades[g] / completed * 100, 2) if completed else None) for g in ('a1', 'a2', 'c')],
        'process_chart': chart,
        'normal_count': counts['normal'], 'rework_count': counts['rework'],
        'order_count': order_count, 'c_ratio': round(grades['c'] / total * 100, 2) if total else None,
        'grades': grades,
        'processes': [dict(name=name, **value) for name, value in sorted(
            processes.items(), key=lambda item: -(item[1]['normal'] + item[1]['rework']))],
        'trend': [dict(date=day, **value) for day, value in trend.items()],
        'start_date': str(start), 'end_date': str(end),
    }
