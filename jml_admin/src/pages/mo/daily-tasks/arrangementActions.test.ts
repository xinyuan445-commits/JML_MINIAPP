import {
  arrangeRoute,
  draftChanges,
  routeCandidates,
} from './arrangementActions';
import { editDraft, previewDraft, taskIdentity } from './draft';
import type { Candidate, DailyData } from './service';
import { createSheetDraft } from './sheetDraft';

const first: Candidate = {
  mo_code: 'MO1',
  sort_seq: 2,
  route_id: 106,
  seq: 3,
  kind: 'normal',
  process_name: '打印',
  dept_name: '生产',
  unit_name: '张',
  allowed_station_ids: [7],
  ready: 20,
  received_remaining: 0,
  receivable: 20,
  maximum: 30,
  waiting: 10,
  reserved: 0,
  unassigned: 30,
  reservations: [],
};
const second = {
  ...first,
  seq: 4,
  process_name: '脱胶',
  ready: 0,
  receivable: 0,
  waiting: 30,
  allowed_station_ids: [8],
};
const third = {
  ...second,
  seq: 5,
  process_name: '修边',
  ready: 0.5,
  receivable: 0.5,
  maximum: 0.5,
  unassigned: 0.5,
};
const data: DailyData = {
  date: '2099-11-12',
  generated_at: '',
  headers: [],
  target_headers: [],
  items: [],
  candidates: [first, second, third],
  unplanned: [],
  changes: [],
  warnings: [],
  stations: [
    { id: 7, station_name: '打印', is_active: 1 },
    { id: 8, station_name: '脱胶修边', is_active: 1 },
  ],
};
const targets = Object.fromEntries(
  data.candidates.map((row) => [taskIdentity(row), row.allowed_station_ids[0]]),
);

test('bulk arranges only this order line and route, with per-step ready/prearranged decimal quantities', () => {
  const extra = [
    { ...second, sort_seq: 1 },
    { ...second, mo_code: 'MO2' },
    { ...second, route_id: 107 },
    { ...second, kind: 'rework' as const },
    { ...second, seq: 2 },
    { ...second, seq: 6, unassigned: 0, reserved: 30 },
  ];
  const server = { ...data, candidates: [...data.candidates, ...extra] };
  const base = createSheetDraft(server, 'test');
  const result = arrangeRoute(base, server, first, targets);
  expect(result.count).toBe(3);
  expect(
    result.draft.items.map((row) => [row.seq, row.station_id, row.quantity]),
  ).toEqual([
    [3, 7, 20],
    [4, 8, 30],
    [5, 8, 0.5],
  ]);
  expect(base.items).toEqual([]);
  expect(
    routeCandidates(previewDraft(server, result.draft), first).map((row) => [
      row.seq,
      row.unassigned,
    ]),
  ).toEqual([[3, 10]]);
  expect(routeCandidates(server, { ...first, kind: 'rework' })).toEqual([]);
});

test('bulk fails atomically for unknown quantities, missing or wrong stations', () => {
  const base = createSheetDraft(data, 'test');
  const before = JSON.stringify(base);
  for (const stations of [
    { ...targets, [taskIdentity(second)]: 7 },
    { [taskIdentity(first)]: 7 },
  ]) {
    expect(() => arrangeRoute(base, data, first, stations)).toThrow(
      '请选择可用工站',
    );
    expect(JSON.stringify(base)).toBe(before);
  }
  const unknown = { ...data, candidates: [first, { ...second, ready: null }] };
  expect(() => arrangeRoute(base, unknown, first, targets)).toThrow(
    '数量待核对',
  );
  expect(base.items).toEqual([]);
});

test('review includes old pending additions, edits, cancellation, notes and carries but ignores live actuals', () => {
  const initial = arrangeRoute(
    createSheetDraft(data, 'test'),
    data,
    first,
    targets,
  ).draft;
  const items = initial.items.map((row, index) => ({ ...row, id: index + 1 }));
  const server = { ...data, items };
  let draft = createSheetDraft(server, 'test');
  draft = editDraft(draft, server, {
    action: 'edit',
    id: 1,
    quantity: 18,
    remark: '优先',
  });
  draft = editDraft(draft, server, { action: 'cancel', id: 2 });
  draft = editDraft(draft, server, {
    action: 'carry',
    id: 3,
    quantity: 0.5,
    target_date: '2099-11-13',
  });
  // Simulates an earlier addition restored from browser storage.
  const extra = { ...first, mo_code: 'OLDER' };
  const extended = { ...server, candidates: [...server.candidates, extra] };
  draft = editDraft(draft, extended, {
    ...extra,
    action: 'add',
    station_id: 7,
    auto_quantity: true,
  });
  const changes = draftChanges(extended, JSON.parse(JSON.stringify(draft)));
  expect(changes.map((row) => row.action)).toEqual([
    '修改',
    '取消',
    '修改',
    '新增',
  ]);
  expect(changes[0].before?.quantity).toBe(20);
  expect(changes[0].task.quantity).toBe(18);
  expect(changes[0].notes).toContain('备注：无 → 优先');
  expect(changes[2].notes).toContain('结转 0.5张 → 2099-11-13');
  expect(changes[3].task.mo_code).toBe('OLDER');
  const clean = createSheetDraft(server, 'test');
  clean.items[0] = { ...clean.items[0], actual: { done: 1 }, remaining: 19 };
  expect(draftChanges(server, clean)).toEqual([]);
});

test('new task cancelled before upload is absent from review; restored task and ordering are modifications', () => {
  let draft = arrangeRoute(
    createSheetDraft(data, 'test'),
    data,
    first,
    targets,
  ).draft;
  draft = editDraft(draft, data, { action: 'cancel', id: draft.items[0].id });
  expect(draftChanges(data, draft).map((row) => row.task.seq)).toEqual([4, 5]);
  const items = draft.items.map((row, index) => ({ ...row, id: index + 1 }));
  const server = {
    ...data,
    items: [{ ...items[0], status: 'cancelled' as const }, items[1]],
  };
  const restored = createSheetDraft(server, 'test');
  restored.items[0] = { ...restored.items[0], status: 'active', sort_order: 9 };
  const changes = draftChanges(server, restored);
  expect(changes).toHaveLength(1);
  expect(changes[0].action).toBe('修改');
  expect(changes[0].notes).toContain('恢复安排');
  expect(changes[0].notes.some((note) => note.startsWith('顺序：'))).toBe(true);
});
