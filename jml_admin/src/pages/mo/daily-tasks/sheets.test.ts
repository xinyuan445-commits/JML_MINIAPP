import { draftKey, type LocalDraft } from './draft';
import type { TaskSheet } from './service';
import { mergeTaskSheets, readDraftSheets } from './sheets';

const sheet: TaskSheet = {
  id: 1,
  work_date: '2026-11-12',
  dept_name: '生产',
  status: 'published',
  revision: 3,
  task_count: 2,
  station_count: 1,
  created_by: 'PMC',
  created_at: '2026-11-11 12:00:00',
};
const draft: LocalDraft = {
  version: 1,
  owner: 'account:1',
  date: sheet.work_date,
  dept: '生产',
  revision: 3,
  stamp: 'test',
  items: [],
  carries: [],
  target_headers: [],
};

test('existing sheets retain server totals and status while marking local changes', () => {
  const rows = mergeTaskSheets([sheet], [draft]);
  expect(rows).toEqual([{ ...sheet, localDraft: true }]);
});

test('old browser-only drafts get a recoverable entry without a server write', () => {
  const rows = mergeTaskSheets(
    [sheet],
    [{ ...draft, date: '2026-11-13', revision: 0 }],
  );
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    id: 0,
    work_date: '2026-11-13',
    localDraft: true,
  });
  expect(rows[1]).toEqual(sheet);
});

test('draft discovery isolates accounts and keeps malformed storage untouched', () => {
  const storage = new Map<string, string>([
    [draftKey(draft.owner, draft.date, draft.dept), JSON.stringify(draft)],
    [
      draftKey('account:2', draft.date, draft.dept),
      JSON.stringify({ ...draft, owner: 'account:2' }),
    ],
    [draftKey(draft.owner, '2026-11-14', draft.dept), '{broken'],
  ]);
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      length: storage.size,
      key: (index: number) => [...storage.keys()][index],
      getItem: (key: string) => storage.get(key),
    },
  });
  try {
    const result = readDraftSheets(draft.owner);
    expect(result.drafts).toEqual([draft]);
    expect(result.warning).toContain('原缓存已保留');
    expect(storage.size).toBe(3);
  } finally {
    if (original) Object.defineProperty(window, 'localStorage', original);
  }
});
