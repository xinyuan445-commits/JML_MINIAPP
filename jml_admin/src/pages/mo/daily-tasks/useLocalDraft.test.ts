import { act, renderHook } from '@testing-library/react';
import { draftKey, type LocalDraft } from './draft';
import { useLocalDraft } from './useLocalDraft';

function draft(owner: string): LocalDraft {
  return {
    version: 1,
    owner,
    date: '2026-11-12',
    dept: '部门',
    revision: 1,
    stamp: 'test-1',
    items: [],
    carries: [],
    target_headers: [],
  };
}

test('local changes survive unmount and remain separated by account', () => {
  const owner = 'cache-test';
  const value = draft(owner);
  const first = renderHook(() => useLocalDraft(owner, value.date, value.dept));
  act(() => first.result.current.write(value));
  first.unmount();
  const second = renderHook(() => useLocalDraft(owner, value.date, value.dept));
  expect(second.result.current.draft).toEqual(value);
  const other = renderHook(() =>
    useLocalDraft('other-account', value.date, value.dept),
  );
  expect(other.result.current.draft).toBeUndefined();
  act(() => second.result.current.discard());
  expect(
    localStorage.getItem(draftKey(owner, value.date, value.dept)),
  ).toBeNull();
});

test('storage-full failure preserves memory draft and warns rather than losing it', () => {
  const value = draft('quota-test');
  const view = renderHook(() =>
    useLocalDraft(value.owner, value.date, value.dept),
  );
  const spy = jest
    .spyOn(Object.getPrototypeOf(localStorage), 'setItem')
    .mockImplementationOnce(() => {
      throw new Error('quota');
    });
  act(() => view.result.current.write(value));
  expect(view.result.current.draft).toEqual(value);
  expect(view.result.current.warning).toContain('缓存写入失败');
  spy.mockRestore();
  act(() => view.result.current.discard());
});

test('another tab draft cannot be silently overwritten or cleared', () => {
  const value = draft('tabs-test');
  const view = renderHook(() =>
    useLocalDraft(value.owner, value.date, value.dept),
  );
  act(() => view.result.current.write(value));
  const newer = { ...value, stamp: 'newer' };
  localStorage.setItem(
    draftKey(value.owner, value.date, value.dept),
    JSON.stringify(newer),
  );
  expect(() =>
    act(() => view.result.current.write({ ...value, stamp: 'third' })),
  ).toThrow('另一标签页');
  expect(() => act(() => view.result.current.discard())).toThrow('另一标签页');
  expect(
    JSON.parse(
      localStorage.getItem(draftKey(value.owner, value.date, value.dept)) ||
        '{}',
    ).stamp,
  ).toBe('newer');
});
