import { businessTime, sheetLocks } from './lifecycle';
import type { TaskSheet } from './service';
import { createSheetDraft, draftScope, sheetBatchPayload } from './sheetDraft';
import { mergeTaskSheets } from './sheets';

const sheet: TaskSheet = {
  id: 1,
  work_date: '2099-11-12',
  status: 'draft',
  created_by: 'PMC',
  created_at: '2099-11-11 12:00:00',
  sheet_kind: 'main',
  plan_cutoff: '2099-11-12 00:00:00',
  result_cutoff: '2099-11-13 00:00:00',
};
test('cutoffs are Beijing midnights and include equality', () => {
  expect(sheetLocks(sheet, businessTime('2099-11-11 23:59:59'))).toEqual({
    plan: false,
    result: false,
  });
  expect(sheetLocks(sheet, businessTime('2099-11-12 00:00:00'))).toEqual({
    plan: true,
    result: false,
  });
  expect(sheetLocks(sheet, businessTime('2099-11-13 00:00:00'))).toEqual({
    plan: true,
    result: true,
  });
  expect(businessTime(sheet.plan_cutoff)).toBe(
    Date.parse('2099-11-11T16:00:00Z'),
  );
});
test('supplement drafts and list entries are isolated from the same-day original', () => {
  const supplement: TaskSheet = {
    ...sheet,
    id: 2,
    sheet_kind: 'supplement',
    parent_id: 1,
  };
  const data = {
    sheet: supplement,
    date: sheet.work_date,
    items: [],
    headers: [],
    stations: [],
    candidates: [],
    unplanned: [],
    changes: [],
    warnings: [],
    target_headers: [],
    generated_at: '',
  };
  const draft = createSheetDraft(data, 'PMC');
  expect(draftScope(sheet)).not.toBe(draftScope(supplement));
  expect(draft.dept).toBe(draftScope(supplement));
  expect(sheetBatchPayload(draft).sheet_id).toBe(2);
  const rows = mergeTaskSheets([sheet, supplement], [draft]);
  expect(rows).toHaveLength(2);
  expect(rows.find((r) => r.id === 1)?.localDraft).toBeUndefined();
  expect(rows.find((r) => r.id === 2)?.localDraft).toBe(true);
  expect(
    mergeTaskSheets([{ ...supplement, arrangement_locked: true }], [draft])[0]
      .localDraft,
  ).toBeUndefined();
});
