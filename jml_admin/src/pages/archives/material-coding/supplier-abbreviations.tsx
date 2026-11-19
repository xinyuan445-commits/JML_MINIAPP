import { request, useAccess } from '@umijs/max';
import { Button, Input, Modal } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';

type Supplier = { name: string; kind: string; products: string; code: string; remark: string };
type SupplierList = { suppliers: Supplier[]; revision: number };
type Draft = { originalCode?: string; supplier: Supplier };
const endpoint = '/api/admin/material-coding/category';
const pageKey = 'supplier-abbreviations';
const fields = [
  { key: 'name', label: '供应商', limit: 240 },
  { key: 'kind', label: '供应商属性', limit: 120 },
  { key: 'products', label: '所售产品', limit: 240 },
  { key: 'code', label: '供应商简称', limit: 40 },
  { key: 'remark', label: '备注', limit: 2000 },
] as const;
const emptySupplier: Supplier = { name: '', kind: '', products: '', code: '', remark: '' };

const useStyles = createStyles(({ token, css }) => ({
  header: css`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0 16px;
    margin-bottom: 12px;
    h2 { margin: 0; }
  `,
  actions: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  scroll: css`
    max-height: max(200px, calc(100dvh - 220px));
    overflow: auto;
    overscroll-behavior-y: contain;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
  `,
  table: css`
    width: 100%;
    min-width: 690px;
    border-collapse: separate;
    border-spacing: 0;
    text-align: left;
    th, td { padding: 9px 12px; vertical-align: top; }
    th { position: sticky; top: 0; z-index: 1; background: #d9eaf7; color: #17365d; white-space: nowrap; }
    td { border-bottom: 1px solid ${token.colorBorderSecondary}; white-space: pre-wrap; overflow-wrap: anywhere; }
    td[data-field='code'] { font-family: ${token.fontFamilyCode}; font-weight: 600; }
  `,
  field: css`
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
  `,
}));

export default function SupplierAbbreviations() {
  const { styles } = useStyles();
  const access = useAccess();
  const canEdit = access.can('material-coding.edit');
  const [list, setList] = useState<SupplierList>();
  const [query, setQuery] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<Draft>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    request<{ data: SupplierList }>(endpoint, { params: { key: pageKey }, skipErrorHandler: true })
      .then(({ data }) => { if (current) setList(data); })
      .catch(() => { if (current) setLoadFailed(true); });
    return () => { current = false; };
  }, [attempt]);

  const openEditor = (supplier?: Supplier) => {
    setError('');
    setDraft({ originalCode: supplier?.code, supplier: supplier ?? emptySupplier });
  };

  const save = async () => {
    if (!list || !draft || saving) return;
    const suppliers = draft.originalCode
      ? list.suppliers.map((row) => row.code === draft.originalCode ? draft.supplier : row)
      : [...list.suppliers, draft.supplier];
    setSaving(true);
    setError('');
    try {
      const { data } = await request<{ data: SupplierList }>(`${endpoint}/save`, {
        method: 'POST', data: { key: pageKey, revision: list.revision, suppliers }, skipErrorHandler: true,
      });
      setList(data);
      setDraft(undefined);
    } catch (failure) {
      const response = (failure as { response?: { data?: { message?: string } } }).response;
      setError(response?.data?.message || '保存失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  const keyword = query.trim().toLowerCase();
  const rows = list?.suppliers.filter((row) =>
    Object.values(row).some((value) => value.toLowerCase().includes(keyword))) ?? [];
  return <>
    <header className={styles.header}>
      <h2 id="material-coding-section">供应商简称明细</h2>
      {list && <div className={styles.actions}>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} allowClear
          placeholder="搜索供应商、简称或产品" aria-label="搜索供应商" style={{ width: 228 }} />
        {canEdit && <Button type="primary" onClick={() => openEditor()}>新增供应商</Button>}
      </div>}
    </header>
    {loadFailed && <div role="alert">供应商简称明细读取失败 <Button onClick={() => {
      setLoadFailed(false);
      setAttempt((value) => value + 1);
    }}>重试</Button></div>}
    {!list && !loadFailed && <p role="status">正在读取供应商简称明细…</p>}
    {list && <div className={styles.scroll} role="region" aria-label="供应商简称清单" tabIndex={0}>
      <table className={styles.table} aria-label="供应商简称明细">
        <thead><tr>
          {fields.map(({ key, label }) => <th key={key} scope="col">{label}</th>)}
          {canEdit && <th scope="col">操作</th>}
        </tr></thead>
        <tbody>
          {rows.map((row) => <tr key={row.code}>
            {fields.map(({ key }) => <td key={key} data-field={key}>{row[key]}</td>)}
            {canEdit && <td><Button type="link" size="small" aria-label={`编辑 ${row.code}`}
              onClick={() => openEditor(row)}>编辑</Button></td>}
          </tr>)}
          {!rows.length && <tr><td colSpan={canEdit ? 6 : 5}>{keyword ? '没有匹配的供应商' : '暂无供应商'}</td></tr>}
        </tbody>
      </table>
    </div>}
    <Modal open={!!draft} title={draft?.originalCode ? '编辑供应商' : '新增供应商'}
      okText="保存" cancelText="取消" confirmLoading={saving} onOk={save}
      onCancel={() => { if (!saving) setDraft(undefined); }}>
      {draft && fields.map(({ key, label, limit }) => <label key={key} className={styles.field}>
        {label}
        <Input value={draft.supplier[key]} maxLength={limit}
          onChange={(event) => setDraft({ ...draft, supplier: { ...draft.supplier, [key]: event.target.value } })} />
      </label>)}
      {error && <p role="alert">{error}</p>}
    </Modal>
  </>;
}
