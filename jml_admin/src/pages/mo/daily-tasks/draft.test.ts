import { groupCandidates } from './candidateFilter';
import {
  availableNow,
  batchPayload,
  createDraft,
  decodeDraft,
  draftKey,
  editDraft,
  previewDraft,
  taskReadiness,
} from './draft';
import type { Candidate, DailyData, Task } from './service';

const source: Candidate = {
  mo_code: 'MO1',
  sort_seq: 1,
  route_id: 1,
  seq: 1,
  kind: 'normal',
  process_name: '水性',
  dept_name: '生产',
  unit_name: '面',
  allowed_station_ids: [7],
  received_remaining: 20,
  receivable: 40,
  ready: 60,
  maximum: 60,
  waiting: 0,
  reserved: 0,
  unassigned: 60,
  reservations: [],
};
function data(items: Task[] = []): DailyData {
  return {
    date: '2026-11-12',
    generated_at: '2026-11-11 10:00:00',
    headers: [{ id: 1, dept_name: '生产', revision: 3, status: 'draft' }],
    target_headers: [
      { work_date: '2026-11-13', dept_name: '生产', revision: 4 },
    ],
    stations: [{ id: 7, station_name: '水性', is_active: 1 }],
    items,
    candidates: [source],
    unplanned: [],
    changes: [],
    warnings: [],
  };
}
const add = { ...source, station_id: 7, action: 'add', auto_quantity: true };

test.each([
  { remaining: 30, available: 20, ready: 20, waiting: 10 },
  { remaining: 67, available: 0, ready: 0, waiting: 67 },
  { remaining: 8, available: 20, ready: 8, waiting: 0 },
  { remaining: 2.3, available: 2.1, ready: 2.1, waiting: 0.2 },
  { remaining: 10, available: null, ready: null, waiting: null },
  { remaining: 0, available: null, ready: 0, waiting: 0 },
])('task readiness splits remaining $remaining with available $available', ({
  remaining,
  available,
  ready,
  waiting,
}) => {
  const server = data();
  const task = editDraft(createDraft(server, '生产', 'account:1'), server, add)
    .items[0];
  const row = { ...task, remaining, current: { ...source, ready: available } };
  expect(taskReadiness(row)).toEqual({ ready, waiting });
  expect(row.quantity).toBe(60);
});

test.each([
  67, 2,
])('explicit prearrangement accepts %s waiting units and cannot duplicate them', (quantity) => {
  const server = data();
  server.candidates = [
    {
      ...source,
      received_remaining: 0,
      receivable: 0,
      ready: 0,
      maximum: quantity,
      waiting: quantity,
      unassigned: quantity,
    },
  ];
  const base = createDraft(server, '生产', 'account:1');
  expect(() => editDraft(base, server, add)).toThrow('当前没有可安排余量');
  const draft = editDraft(base, server, { ...add, include_waiting: true });
  expect(draft.items[0].quantity).toBe(quantity);
  expect(draft.items[0].actual).toEqual({});
  expect(previewDraft(server, draft).candidates[0].unassigned).toBe(0);
  expect(() =>
    editDraft(draft, server, { ...add, include_waiting: true }),
  ).toThrow('待安排数量已变化');
  const cancelled = editDraft(draft, server, {
    action: 'cancel',
    id: draft.items[0].id,
  });
  expect(
    editDraft(cancelled, server, { ...add, include_waiting: true }).items[0]
      .quantity,
  ).toBe(quantity);
});

test('prearrangement appends only unreserved waiting work and preserves existing quantities until requested', () => {
  const server = data();
  server.candidates = [
    {
      ...source,
      ready: 0,
      received_remaining: 0,
      receivable: 0,
      maximum: 67,
      waiting: 67,
      reserved: 7,
      unassigned: 60,
    },
  ];
  const first = editDraft(createDraft(server, '生产', 'account:1'), server, {
    ...add,
    auto_quantity: false,
    quantity: 10,
  });
  expect(previewDraft(server, first).items[0].quantity).toBe(10);
  const appended = editDraft(first, server, { ...add, include_waiting: true });
  expect(appended.items).toHaveLength(1);
  expect(appended.items[0].id).toBe(first.items[0].id);
  expect(appended.items[0].quantity).toBe(60);
  expect(first.items[0].quantity).toBe(10);
});

test('prearrangement refuses unknown quantities and does not override the ready-work default', () => {
  const server = data();
  for (const ready of [null, 20]) {
    server.candidates = [{ ...source, ready }];
    expect(() =>
      editDraft(createDraft(server, '生产', 'account:1'), server, {
        ...add,
        include_waiting: true,
      }),
    ).toThrow('待安排数量已变化');
  }
});

test('drag assigns only ready work; manual edit can include waiting work without changing saved tasks', () => {
  const server = data();
  server.candidates = [
    {
      ...source,
      received_remaining: 0,
      receivable: 20,
      ready: 20,
      maximum: 30,
      waiting: 10,
      unassigned: 30,
    },
  ];
  const draft = editDraft(
    createDraft(server, '生产', 'account:1'),
    server,
    add,
  );
  expect(draft.items[0].quantity).toBe(20);
  const candidate = previewDraft(server, draft).candidates[0];
  expect(candidate.unassigned).toBe(10);
  expect(availableNow(candidate)).toBe(0);
  expect(() => editDraft(draft, server, add)).toThrow('当前没有可安排余量');
  const edited = editDraft(draft, server, {
    action: 'edit',
    id: draft.items[0].id,
    quantity: 30,
  });
  expect(edited.items[0].quantity).toBe(30);
  const saved = { ...edited.items[0], id: 99 };
  server.items = [saved];
  server.candidates = [
    { ...server.candidates[0], reserved: 30, unassigned: 0 },
  ];
  const existing = createDraft(server, '生产', 'account:1');
  expect(previewDraft(server, existing).items[0].quantity).toBe(30);
  expect(server.items[0].quantity).toBe(30);
});

test('ready balance subtracts other arrangements, supports fractions and restores on cancel', () => {
  const server = data();
  server.candidates = [
    {
      ...source,
      received_remaining: 0.5,
      receivable: 20,
      ready: 20.5,
      maximum: 30,
      waiting: 9.5,
      reserved: 5,
      unassigned: 25,
    },
  ];
  const draft = editDraft(
    createDraft(server, '生产', 'account:1'),
    server,
    add,
  );
  expect(draft.items[0].quantity).toBe(15.5);
  expect(availableNow(previewDraft(server, draft).candidates[0])).toBe(0);
  const cancelled = editDraft(draft, server, {
    action: 'cancel',
    id: draft.items[0].id,
  });
  expect(availableNow(previewDraft(server, cancelled).candidates[0])).toBe(
    15.5,
  );
});

test.each([
  0,
  null,
])('no default assignment when ready quantity is %s', (ready) => {
  const server = data();
  server.candidates = [{ ...source, ready }];
  expect(() =>
    editDraft(createDraft(server, '生产', 'account:1'), server, add),
  ).toThrow();
});

test('repeated assignment appends decimal remainder to the same task without losing metadata', () => {
  const server = data();
  const added = editDraft(
    createDraft(server, '生产', 'account:1'),
    server,
    add,
  );
  const partial = editDraft(added, server, {
    action: 'edit',
    id: added.items[0].id,
    quantity: 20.5,
    remark: '下午生产',
  });
  const original = partial.items[0];
  expect(previewDraft(server, partial).candidates[0].unassigned).toBe(39.5);
  const appended = editDraft(partial, server, add);
  expect(appended.items).toEqual([
    { ...original, quantity: 60, remaining: 60, difference: -60 },
  ]);
  expect(previewDraft(server, appended).candidates[0].unassigned).toBe(0);
  expect(() => editDraft(appended, server, add)).toThrow('当前没有可安排余量');
});

test('append does not double-count actual completion or carry quantity and keeps other reservations', () => {
  const initial = data();
  const added = editDraft(
    createDraft(initial, '生产', 'account:1'),
    initial,
    add,
  ).items[0];
  const saved = {
    ...added,
    id: 9,
    quantity: 20,
    transferred_qty: 5,
    actual: { done: 12 },
    remaining: 3,
    remark: '已有任务',
  };
  const server = data([saved]);
  server.candidates = [{ ...source, maximum: 10, reserved: 5, unassigned: 5 }];
  const appended = editDraft(
    createDraft(server, '生产', 'account:1'),
    server,
    add,
  );
  expect(appended.items[0]).toMatchObject({
    id: 9,
    quantity: 25,
    transferred_qty: 5,
    actual: { done: 12 },
    remaining: 8,
    remark: '已有任务',
  });
  expect(previewDraft(server, appended).candidates[0].unassigned).toBe(0);
  expect(batchPayload(appended).items).toHaveLength(1);
});

test('candidate list hides full allocation, shows partial remainder and restores on cancellation', () => {
  const server = data();
  const visible = (draft: ReturnType<typeof createDraft>) =>
    groupCandidates(
      previewDraft(server, draft).candidates,
      server.date,
      '3',
    ).flatMap((g) => g.rows);
  const full = editDraft(createDraft(server, '生产', 'account:1'), server, add);
  expect(visible(full)).toEqual([]);
  const partial = editDraft(full, server, {
    action: 'edit',
    id: full.items[0].id,
    quantity: 20.5,
  });
  expect(visible(partial)).toHaveLength(1);
  expect(visible(partial)[0].unassigned).toBe(39.5);
  const cancelled = editDraft(partial, server, {
    action: 'cancel',
    id: full.items[0].id,
  });
  expect(visible(cancelled)[0].unassigned).toBe(60);
  expect(visible(editDraft(cancelled, server, add))).toEqual([]);
});

test('drag/edit/reorder operate locally; final batch contains only final quantities', () => {
  const server = data();
  const draft = editDraft(
    createDraft(server, '生产', 'account:1'),
    server,
    add,
  );
  expect(server.items).toHaveLength(0);
  const id = draft.items[0].id;
  expect(id).toBeLessThan(0);
  expect(draft.items[0].quantity).toBe(60);
  const edited = editDraft(draft, server, {
    action: 'edit',
    id,
    quantity: 20.5,
    remark: '下午',
  });
  expect(draft.items[0].quantity).toBe(60);
  expect(batchPayload(edited).items[0].quantity).toBe(20.5);
  expect(previewDraft(server, edited).candidates[0].unassigned).toBe(39.5);
  expect(batchPayload(edited).revision).toBe(3);
});

test('account/date/department keys isolate caches and reload restores draft', () => {
  const server = data();
  const draft = editDraft(
    createDraft(server, '生产', 'account:1'),
    server,
    add,
  );
  const key = draftKey('account:1', server.date, '生产');
  localStorage.setItem(key, JSON.stringify(draft));
  expect(
    decodeDraft(localStorage.getItem(key), 'account:1', server.date, '生产'),
  ).toEqual(draft);
  for (const args of [
    ['account:2', server.date, '生产'],
    ['account:1', '2026-11-13', '生产'],
    ['account:1', server.date, '其他'],
  ]) {
    expect(draftKey(...(args as [string, string, string]))).not.toBe(key);
    expect(() =>
      decodeDraft(JSON.stringify(draft), ...(args as [string, string, string])),
    ).toThrow();
  }
});

test('cancel an unsaved task removes it; adding it again works', () => {
  const server = data();
  const draft = editDraft(
    createDraft(server, '生产', 'account:1'),
    server,
    add,
  );
  const cancelled = editDraft(draft, server, {
    action: 'cancel',
    id: draft.items[0].id,
  });
  expect(cancelled.items).toHaveLength(0);
  expect(editDraft(cancelled, server, add).items).toHaveLength(1);
});

test('cancel and restore saved task preserves ID and transferred amount', () => {
  const server = data();
  const added = editDraft(createDraft(server, '生产', 'account:1'), server, add)
    .items[0];
  const saved = {
    ...added,
    id: 9,
    transferred_qty: 5,
    quantity: 65,
    remaining: 60,
  };
  const state = data([saved]);
  state.candidates = [{ ...source, reserved: 60, unassigned: 0 }];
  const cancelled = editDraft(createDraft(state, '生产', 'account:1'), state, {
    action: 'cancel',
    id: 9,
  });
  const restored = editDraft(cancelled, state, add);
  expect(restored.items[0].id).toBe(9);
  expect(restored.items[0].transferred_qty).toBe(5);
  expect(restored.items[0].quantity).toBe(65);
});

test('pending carry preserves total reservation and can be undone', () => {
  const server = data();
  const draft = editDraft(
    createDraft(server, '生产', 'account:1'),
    server,
    add,
  );
  const id = draft.items[0].id;
  const carried = editDraft(draft, server, {
    action: 'carry',
    id,
    quantity: 10,
    target_date: '2026-11-13',
  });
  expect(carried.items[0].remaining).toBe(50);
  expect(previewDraft(server, carried).candidates[0].reserved).toBe(60);
  expect(carried.carries[0].target_revision).toBe(4);
  const undone = editDraft(carried, server, {
    action: 'uncarry',
    id,
    index: 0,
  });
  expect(undone.items[0].remaining).toBe(60);
  expect(undone.carries).toHaveLength(0);
});

test('server actuals refresh without overwriting local quantities or base revision', () => {
  const server = data();
  const draft = editDraft(
    createDraft(server, '生产', 'account:1'),
    server,
    add,
  );
  const updated = data([
    { ...draft.items[0], id: 4, quantity: 30, actual: { done: 12, qty_a: 12 } },
  ]);
  updated.headers[0].revision = 4;
  const projected = previewDraft(updated, draft);
  expect(projected.items[0].quantity).toBe(60);
  expect(projected.items[0].actual.done).toBe(12);
  expect(draft.revision).toBe(3);
  expect(batchPayload(draft).revision).toBe(3);
});

test('payload excludes client actuals, available balances and transferred totals', () => {
  const server = data();
  const draft = editDraft(
    createDraft(server, '生产', 'account:1'),
    server,
    add,
  );
  const payload = batchPayload(draft, true);
  expect(payload.publish).toBe(true);
  expect(payload.items[0]).not.toHaveProperty('actual');
  expect(payload.items[0]).not.toHaveProperty('transferred_qty');
  expect(payload.items[0]).not.toHaveProperty('maximum');
});
