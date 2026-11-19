import { decodeDraft, type LocalDraft } from './draft';
import { sheetLocks } from './lifecycle';
import type { TaskSheet } from './service';

export type SheetRow = TaskSheet & { localDraft?: boolean };
export const sheetKey = (
  sheet: Pick<TaskSheet, 'work_date'> &
    Partial<Pick<TaskSheet, 'sheet_kind' | 'id'>>,
) =>
  sheet.sheet_kind === 'supplement'
    ? `${sheet.work_date}:${sheet.id}`
    : sheet.work_date;

export function readDraftSheets(owner: string) {
  const drafts: LocalDraft[] = [];
  let warning = '';
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('jml.daily-tasks.v1:')) continue;
      try {
        const [account, date, dept] = JSON.parse(
          key.slice('jml.daily-tasks.v1:'.length),
        );
        if (account !== owner) continue;
        const draft = decodeDraft(localStorage.getItem(key), owner, date, dept);
        if (draft) drafts.push(draft);
      } catch {
        warning = '部分本地草稿无法读取，原缓存已保留。';
      }
    }
  } catch {
    warning = '无法读取浏览器草稿，原缓存未清理。';
  }
  return { drafts, warning };
}

export function mergeTaskSheets(
  sheets: TaskSheet[],
  drafts: LocalDraft[],
): SheetRow[] {
  const rows = new Map<string, SheetRow>(
    sheets.map((sheet) => [sheetKey(sheet), sheet]),
  );
  const draftSheetKey = (d: LocalDraft) =>
    sheetKey({ work_date: d.date, sheet_kind: d.sheet_kind, id: d.sheet_id });
  for (const key of new Set(drafts.map(draftSheetKey))) {
    const dayDrafts = drafts.filter((d) => draftSheetKey(d) === key);
    const date = dayDrafts[0].date;
    const whole = dayDrafts.find((d) => d.allDepartments);
    const selected = whole ? [whole] : dayDrafts;
    const existing = rows.get(key);
    if (existing && (sheetLocks(existing).plan || sheetLocks(existing).result))
      continue;
    const active = selected
      .flatMap((d) => d.items)
      .filter((item) => item.status === 'active');
    rows.set(
      key,
      existing
        ? { ...existing, localDraft: true }
        : {
            id: dayDrafts[0].sheet_id || 0,
            sheet_kind: dayDrafts[0].sheet_kind,
            work_date: date,
            status: 'draft',
            created_by: '',
            created_at: '',
            task_count: active.length,
            station_count: new Set(active.map((t) => t.station_id)).size,
            localDraft: true,
          },
    );
  }
  return [...rows.values()].sort(
    (a, b) => b.work_date.localeCompare(a.work_date) || b.id - a.id,
  );
}
