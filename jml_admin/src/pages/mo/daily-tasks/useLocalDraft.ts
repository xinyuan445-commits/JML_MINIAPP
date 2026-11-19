import { useCallback, useEffect, useState } from 'react';
import { decodeDraft, draftKey, type LocalDraft } from './draft';

// Keep a fallback while this page is open if browser storage is disabled/full.
const memory = new Map<
  string,
  { value: LocalDraft; persistedStamp?: string }
>();

export function useLocalDraft(owner: string, date: string, dept: string) {
  const key = owner && dept ? draftKey(owner, date, dept) : '';
  const [record, setRecord] = useState<{ key: string; value?: LocalDraft }>({
    key: '',
  });
  const [warning, setWarning] = useState('');
  const reload = useCallback(() => {
    setWarning('');
    if (!key) {
      setRecord({ key });
      return;
    }
    const pending = memory.get(key);
    if (pending) {
      setRecord({ key, value: pending.value });
      setWarning('草稿仅保留在当前页面内存中，请先保存到服务器再离开。');
      return;
    }
    try {
      const value = decodeDraft(localStorage.getItem(key), owner, date, dept);
      setRecord({ key, value });
    } catch {
      setRecord({ key, value: memory.get(key)?.value });
      setWarning(
        '浏览器草稿读取失败，请勿关闭页面；可重试读取或放弃本地草稿。',
      );
    }
  }, [key, owner, date, dept]);
  useEffect(() => {
    reload();
  }, [reload]);
  const draft = record.key === key ? record.value : undefined;
  const assertLegacy = () => {
    for (const [legacyKey, stamp] of Object.entries(
      draft?.legacyStamps || {},
    )) {
      const text = localStorage.getItem(legacyKey);
      if (!text || JSON.parse(text).stamp !== stamp)
        throw new Error('原部门草稿已在其他标签页修改，请核对后再保存');
    }
  };
  const assertCurrent = () => {
    let text: string | null;
    try {
      text = localStorage.getItem(key);
    } catch {
      return undefined;
    }
    const stored = decodeDraft(text, owner, date, dept);
    const expected = memory.has(key)
      ? memory.get(key)?.persistedStamp
      : draft?.stamp;
    if (stored?.stamp !== expected)
      throw new Error('另一标签页更新了草稿，请重新打开页面核对后继续');
    assertLegacy();
    return stored;
  };
  const write = (value: LocalDraft) => {
    // Never silently replace a newer draft written by another tab.
    const stored = assertCurrent();
    try {
      localStorage.setItem(key, JSON.stringify(value));
      memory.delete(key);
      setWarning('');
    } catch {
      memory.set(key, { value, persistedStamp: stored?.stamp });
      setWarning(
        '浏览器缓存写入失败，修改暂留当前页面，请保存到服务器后再离开。',
      );
    }
    setRecord({ key, value });
  };
  const discard = () => {
    try {
      let stored: LocalDraft | undefined;
      const text = localStorage.getItem(key);
      try {
        stored = decodeDraft(text, owner, date, dept);
      } catch {
        /* Explicit discard may clear an invalid old draft. */
      }
      const expected = memory.has(key)
        ? memory.get(key)?.persistedStamp
        : draft?.stamp;
      if (stored && draft && stored.stamp !== expected)
        throw new Error('另一标签页更新了草稿，请重新打开页面核对');
      assertLegacy();
      for (const legacyKey of Object.keys(draft?.legacyStamps || {}))
        localStorage.removeItem(legacyKey);
      localStorage.removeItem(key);
    } catch (e) {
      throw new Error(
        e instanceof Error ? e.message : '本地草稿清理失败，请重试',
      );
    }
    memory.delete(key);
    setRecord({ key });
    setWarning('');
  };
  useEffect(() => {
    if (!draft || !warning) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [draft, warning]);
  return {
    draft,
    write,
    discard,
    assertCurrent,
    warning,
    ready: record.key === key,
  };
}
