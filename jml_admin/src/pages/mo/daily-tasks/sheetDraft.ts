import { batchPayload, createDraft, draftKey, type LocalDraft } from './draft';
import type { DailyData, TaskSheet } from './service';
import { editPayload, nonorderConflict } from './nonorderDraft';

export const SHEET_SCOPE = '__all_departments__';
export const draftScope = (sheet?: TaskSheet) =>
  sheet?.sheet_kind === 'supplement' ? `__sheet_${sheet.id}__` : SHEET_SCOPE;

export function createSheetDraft(
  data: DailyData,
  owner: string,
  legacy: LocalDraft[] = [],
): LocalDraft {
  const draft = createDraft(data, draftScope(data.sheet), owner);
  draft.allDepartments = true;
  draft.sheet_id = data.sheet?.id;
  draft.sheet_kind = data.sheet?.sheet_kind;
  draft.items = data.items.map((item) => ({ ...item }));
  draft.revisions = Object.fromEntries(
    data.headers
      .filter((h) => h.dept_name)
      .map((h) => [h.dept_name, h.revision]),
  );
  draft.legacyStamps = {};
  let nextId = -1;
  for (const old of legacy.filter(
    (d) =>
      d.date === data.date &&
      d.owner === owner &&
      !d.allDepartments &&
      data.sheet?.sheet_kind !== 'supplement',
  )) {
    draft.revisions[old.dept] = old.revision;
    draft.legacyStamps[draftKey(owner, old.date, old.dept)] = old.stamp;
    const ids = new Map<number, number>();
    const items = old.items.map((item) => {
      const id = item.id < 0 ? nextId-- : item.id;
      ids.set(item.id, id);
      return { ...item, id };
    });
    draft.items = [
      ...draft.items.filter((i) => i.dept_name !== old.dept),
      ...items,
    ];
    draft.carries.push(
      ...old.carries.map((carry) => ({
        ...carry,
        id: ids.get(carry.id) ?? carry.id,
      })),
    );
  }
  return draft;
}

export function sheetHasConflict(data: DailyData, draft?: LocalDraft) {
  if (!draft) return false;
  if (draft.nonorderCreations?.length && !data.nonorder?.supports_sheet_creation) return true;
  const current = Object.fromEntries(
    data.headers
      .filter((h) => h.dept_name)
      .map((h) => [h.dept_name, h.revision]),
  );
  const previous = draft.revisions || {};
  return nonorderConflict(data, draft.nonorder) || [...new Set([...Object.keys(current), ...Object.keys(previous)])].some(
    (dept) => (current[dept] || 0) !== (previous[dept] || 0),
  );
}

export function sheetBatchPayload(draft: LocalDraft, publish = false, onlyNonorder = false) {
  const departments = new Set([
    ...Object.keys(draft.revisions || {}),
    ...draft.items.map((i) => i.dept_name),
  ]);
  return {
    action: 'batch_sheet',
    sheet_id: draft.sheet_id,
    date: draft.date,
    ...(draft.nonorder?.length ? { nonorder_changes: draft.nonorder.map(editPayload) } : {}),
    ...(draft.nonorderCreations?.length ? {
      nonorder_creations: draft.nonorderCreations.map(({ request_id, task }) => ({ request_id, task })),
      nonorder_publish: publish,
    } : {}),
    ...(onlyNonorder ? { nonorder_only: true } : {}),
    batches: (onlyNonorder ? [] : [...departments]).map((dept) => {
      const items = draft.items.filter((i) => i.dept_name === dept);
      return batchPayload(
        {
          ...draft,
          dept,
          revision: draft.revisions?.[dept] || 0,
          items,
          carries: draft.carries.filter((c) =>
            items.some((i) => i.id === c.id),
          ),
        },
        publish && items.some((i) => i.status === 'active'),
      );
    }),
  };
}
