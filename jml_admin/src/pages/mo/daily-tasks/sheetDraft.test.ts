import { editDraft, previewDraft } from './draft';
import type { Candidate, DailyData } from './service';
import {
  createSheetDraft,
  sheetBatchPayload,
  sheetHasConflict,
} from './sheetDraft';

const candidate = (dept: string): Candidate => ({
  mo_code: dept,
  sort_seq: 1,
  route_id: 1,
  seq: 1,
  kind: 'normal',
  process_name: '水性',
  dept_name: dept,
  unit_name: '面',
  allowed_station_ids: [7],
  received_remaining: 10,
  receivable: 0,
  ready: 10,
  maximum: 10,
  waiting: 0,
  reserved: 0,
  unassigned: 10,
  reservations: [],
});
const data: DailyData = {
  date: '2099-11-12',
  generated_at: '',
  headers: [],
  target_headers: [],
  stations: [],
  candidates: [candidate('甲'), candidate('乙')],
  items: [],
  unplanned: [],
  changes: [],
  warnings: [],
};

test('one sheet allocates different departments and sends them in one save payload', () => {
  let draft = createSheetDraft(data, 'PMC');
  for (const source of data.candidates)
    draft = editDraft(draft, data, {
      ...source,
      action: 'add',
      station_id: 7,
      quantity: 4,
    });
  expect(draft.items).toHaveLength(2);
  expect(previewDraft(data, draft).candidates.map((c) => c.unassigned)).toEqual(
    [6, 6],
  );
  const payload = sheetBatchPayload(draft, true);
  expect(payload.action).toBe('batch_sheet');
  expect(
    payload.batches.map((b) => [b.dept_name, b.items.length, b.publish]),
  ).toEqual([
    ['甲', 1, true],
    ['乙', 1, true],
  ]);
  const cancelled = editDraft(draft, data, {
    action: 'cancel',
    id: draft.items[0].id,
  });
  expect(
    previewDraft(data, cancelled).candidates.map((c) => c.unassigned),
  ).toEqual([10, 6]);
});

test('a change or addition in any department conflicts with the whole sheet', () => {
  const source = {
    ...data,
    headers: [
      { id: 1, dept_name: '甲', revision: 3, status: 'draft' as const },
    ],
  };
  const draft = createSheetDraft(source, 'PMC');
  expect(sheetHasConflict(source, draft)).toBe(false);
  expect(
    sheetHasConflict(
      { ...source, headers: [{ ...source.headers[0], revision: 4 }] },
      draft,
    ),
  ).toBe(true);
  expect(
    sheetHasConflict(
      {
        ...source,
        headers: [
          ...source.headers,
          { id: 2, dept_name: '乙', revision: 1, status: 'draft' },
        ],
      },
      draft,
    ),
  ).toBe(true);
});

test('old department drafts combine without duplicate temporary IDs or lost carries', () => {
  const legacy = data.candidates.map((source) => {
    const draft = editDraft(createSheetDraft(data, 'PMC'), data, {
      ...source,
      action: 'add',
      station_id: 7,
      quantity: 4,
    });
    return {
      ...draft,
      allDepartments: false,
      dept: source.dept_name,
      revision: 0,
      carries: [
        {
          id: -1,
          quantity: 1,
          target_date: '2099-11-13',
          target_revision: 5,
          local_key: source.dept_name,
        },
      ],
    };
  });
  const merged = createSheetDraft(data, 'PMC', legacy);
  expect(merged.items.map((i) => i.id)).toEqual([-1, -2]);
  expect(merged.carries.map((c) => c.id)).toEqual([-1, -2]);
  expect(Object.keys(merged.legacyStamps || {})).toHaveLength(2);
  expect(
    sheetBatchPayload(merged).batches.map((b) => b.carries[0].target_revision),
  ).toEqual([5, 5]);
});
