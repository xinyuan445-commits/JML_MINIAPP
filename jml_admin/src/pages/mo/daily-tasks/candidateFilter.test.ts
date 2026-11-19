import {
  businessToday,
  candidateDateWindow,
  followupHint,
  groupCandidateStages,
  groupCandidates,
  groupCandidatesForDisplay,
} from './candidateFilter';
import type { Candidate } from './service';

test('missing future candidates do not imply that a process is the last step', () => {
  const current = row('MO1', { seq: 3 });
  expect(followupHint(current, [current])).toBe('后续工序信息待更新');
  expect(followupHint({ ...current, is_last_step: true }, [current])).toBe(
    '无后续工序',
  );
  expect(followupHint({ ...current, is_last_step: false }, [current])).toBe(
    '后续暂无待安排余量',
  );
  expect(followupHint(current, [current, row('MO1', { seq: 4 })])).toBe(
    '后续工序请查看本工单其他任务',
  );
});

test('old onsite orders expose future steps once without broadening the date range for unrelated work', () => {
  const rows = [
    row('old', {
      seq: 3,
      plan_start_date: '2020-01-01',
      ready: 1,
      receivable: 1,
    }),
    row('old', { seq: 4, plan_start_date: '2020-01-01' }),
    row('old', { seq: 5, plan_start_date: '2026-11-12' }),
    row('unrelated', { plan_start_date: '2026-11-16' }),
  ];
  const groups = groupCandidatesForDisplay(rows, rows, '2026-11-12', '3');
  expect(groups[0].orders[0].current).toEqual([rows[0]]);
  expect(groups[0].orders[0].later).toEqual([rows[1], rows[2]]);
  expect(groups[1].orders).toEqual([]);
});

test('searching the current process or selecting its station does not hide its future steps', () => {
  const onsite = row('MO1', {
    seq: 3,
    ready: 1,
    receivable: 1,
    allowed_station_ids: [7],
  });
  const later = row('MO1', { seq: 4, allowed_station_ids: [8] });
  const reserved = row('MO1', { seq: 5, unassigned: 0, reserved: 100 });
  const unrelated = row('MO2', { seq: 4 });
  const all = [onsite, later, reserved, unrelated];
  expect(
    groupCandidatesForDisplay([onsite], all, '2026-11-12', '3')[0].orders[0]
      .later,
  ).toEqual([later]);
  const waiting = {
    ...onsite,
    ready: 0,
    receivable: 0,
    plan_start_date: '2026-11-12',
  };
  expect(
    groupCandidatesForDisplay([waiting], [waiting, later], '2026-11-12', '3')[1]
      .orders[0].later,
  ).toEqual([later]);
});

test('only the first unfinished step is shown for waiting-only work', () => {
  const rows = [3, 4, 5].map((seq) => row('SCDD26103125', { seq }));
  const [group] = groupCandidateStages(rows, rows);
  expect(group.current.map((r) => r.seq)).toEqual([3]);
  expect(group.later.map((r) => r.seq)).toEqual([4, 5]);
  // Searching a later process or fully arranging the first must not promote it.
  expect(groupCandidateStages(rows.slice(1), rows)[0].current).toEqual([]);
  const assigned = { ...rows[0], reserved: 100, unassigned: 0 };
  expect(
    groupCandidateStages(rows.slice(1), [assigned, ...rows.slice(1)])[0].later,
  ).toEqual(rows.slice(1));
  // Once the first is complete and absent from candidates, the next becomes current.
  expect(groupCandidateStages(rows.slice(1), rows.slice(1))[0].current).toEqual(
    [rows[1]],
  );
});

test('partial flow, rework and unknown live work remain current independently', () => {
  const rows = [
    row('MO1', { seq: 3 }),
    row('MO1', { seq: 4, ready: 0.5, receivable: 0.5 }),
    row('MO1', { seq: 5, ready: 2, received_remaining: 2 }),
    row('MO1', {
      seq: 6,
      ready: null,
      received_remaining: null,
      has_active_execution: true,
    }),
    row('MO1', { seq: 7, kind: 'rework' }),
    row('MO1', { seq: 8 }),
  ];
  const [group] = groupCandidateStages(rows, rows);
  expect(group.current.map((r) => r.seq)).toEqual([3, 4, 5, 6, 7]);
  expect(group.later.map((r) => r.seq)).toEqual([8]);
  const others = [
    row('MO1', { sort_seq: 2, seq: 4 }),
    row('MO1', { route_id: 2, seq: 5 }),
    row('MO2', { seq: 4 }),
  ];
  expect(
    groupCandidateStages(others, [...rows, ...others]).every(
      (g) => g.current.length === 1,
    ),
  ).toBe(true);
});

test('active work with unknown historical receipt balance stays visible for checking', () => {
  const item = row('active-unknown', {
    plan_start_date: '2020-01-01',
    received_remaining: null,
    receivable: null,
    has_active_execution: true,
    maximum: 0,
    unassigned: 0,
  });
  expect(groupCandidates([item], '2026-11-12', '3')[0].rows).toEqual([item]);
});

function row(id: string, values: Partial<Candidate> = {}): Candidate {
  return {
    mo_code: id,
    sort_seq: 1,
    route_id: 1,
    seq: 1,
    kind: 'normal',
    process_name: '水性',
    dept_name: '生产',
    unit_name: '面',
    allowed_station_ids: [7],
    received_remaining: 0,
    receivable: 0,
    ready: 0,
    maximum: 100,
    waiting: 100,
    reserved: 0,
    unassigned: 100,
    reservations: [],
    ...values,
  };
}

test('ranges set an inclusive future cutoff without a lower bound', () => {
  expect(candidateDateWindow('2026-11-12', '1')).toEqual({
    end: '2026-11-13',
  });
  expect(candidateDateWindow('2026-11-12', '3')).toEqual({
    end: '2026-11-15',
  });
  expect(candidateDateWindow('2026-11-12', '7')).toEqual({
    end: '2026-11-19',
  });
  expect(candidateDateWindow('2026-12-30', '3')).toEqual({
    end: '2027-01-02',
  });
  expect(candidateDateWindow('2026-11-12', 'all')).toBeNull();
});

test('today follows Beijing midnight regardless of the browser time zone', () => {
  expect(businessToday(new Date('2026-11-10T15:59:59Z'))).toBe('2026-11-10');
  expect(businessToday(new Date('2026-11-10T16:00:00Z'))).toBe('2026-11-11');
});

test('new tasks use inclusive planned start date bounds', () => {
  const rows = ['01', '11', '12', '13', '14', '15', '16', '19', '20'].map(
    (day) => row(day, { plan_start_date: `2026-11-${day} 00:00:00` }),
  );
  expect(
    groupCandidates(rows, '2026-11-12', '1')[1].rows.map((r) => r.mo_code),
  ).toEqual(['01', '11', '12', '13']);
  expect(
    groupCandidates(rows, '2026-11-12', '3')[1].rows.map((r) => r.mo_code),
  ).toEqual(['01', '11', '12', '13', '14', '15']);
  expect(
    groupCandidates(rows, '2026-11-12', '7')[1].rows.map((r) => r.mo_code),
  ).toEqual(['01', '11', '12', '13', '14', '15', '16', '19']);
});

test('old received work, partial receipt, first step material and rework never filtered out', () => {
  const rows = [
    row('old', { plan_start_date: '2020-01-01', received_remaining: 20 }),
    row('partial', {
      plan_start_date: '2020-01-01',
      received_remaining: 20,
      receivable: 40,
    }),
    row('first', { plan_start_date: '2020-01-01', receivable: 0.5 }),
    row('rework', { kind: 'rework', received_remaining: 2 }),
  ];
  for (const range of ['1', '3', '7', 'all'] as const) {
    const groups = groupCandidates(rows, '2026-11-12', range);
    expect(groups[0].rows).toEqual(rows);
    expect(groups[1].rows).toHaveLength(0);
  }
});

test('onsite task within date range appears only once', () => {
  const item = row('one', { plan_start_date: '2026-11-12', receivable: 5 });
  expect(
    groupCandidates([item], '2026-11-12', '3').flatMap((g) => g.rows),
  ).toEqual([item]);
});

test('missing start date appears only in all unless it has onsite work', () => {
  const item = row('no-date');
  expect(
    groupCandidates([item], '2026-11-12', '3').flatMap((g) => g.rows),
  ).toHaveLength(0);
  expect(groupCandidates([item], '2026-11-12', 'all')[1].rows).toEqual([item]);
  expect(
    groupCandidates([{ ...item, received_remaining: 1 }], '2026-11-12', '3')[0]
      .rows,
  ).toHaveLength(1);
});

test('fully assigned tasks are hidden even when another balance is unknown', () => {
  const item = row('unknown', {
    received_remaining: 2,
    receivable: null,
    ready: null,
    reserved: 2,
    unassigned: 0,
  });
  expect(groupCandidates([item], '2026-11-12', '3')[0].rows).toEqual([]);
  const partial = { ...item, reserved: 1.5, unassigned: 0.5 };
  expect(groupCandidates([partial], '2026-11-12', '3')[0].rows).toEqual([
    partial,
  ]);
});

test('fully assigned date-range tasks are hidden in every range', () => {
  const item = row('assigned', {
    plan_start_date: '2026-11-12',
    reserved: 100,
    unassigned: 0,
  });
  for (const range of ['3', '7', 'all'] as const) {
    expect(
      groupCandidates([item], '2026-11-12', range).flatMap((g) => g.rows),
    ).toEqual([]);
  }
});
