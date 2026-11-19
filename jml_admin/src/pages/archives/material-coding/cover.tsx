import { request, useAccess } from '@umijs/max';
import { Button, Input, Modal } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';

type CoverInfo = { title: string; created_by: string; modified_by: string };
type Change = { date: string; description: string };
type Cover = CoverInfo & { changes: Change[]; revision: number };
type Editor =
  | { kind: 'info'; fields: CoverInfo }
  | { kind: 'change'; fields: Change; index?: number }
  | { kind: 'delete'; index: number };

const coverApi = '/api/admin/material-coding/cover';
const fields = [
  { key: 'title', label: '标题', limit: 240 },
  { key: 'created_by', label: 'Create By', limit: 120 },
  { key: 'modified_by', label: 'Modified By', limit: 120 },
] as const;

const useStyles = createStyles(({ token, css }) => ({
  header: css`
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px 16px;
    h2, h3 { margin: 0; color: #17365d; }
    h3 { font-size: 16px; }
  `,
  credits: css`
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 8px 20px;
    margin: 16px 0 28px;
    dt { color: ${token.colorTextSecondary}; }
    dd { margin: 0; overflow-wrap: anywhere; }
  `,
  table: css`
    width: 100%;
    margin-top: 10px;
    border-collapse: collapse;
    th, td { padding: 10px 14px; text-align: left; vertical-align: top; }
    th { color: #17365d; background: #d9eaf7; white-space: nowrap; }
    td { border-bottom: 1px solid ${token.colorBorderSecondary}; white-space: pre-wrap; overflow-wrap: anywhere; }
    td:first-child, td:last-child:has(button) { width: 1%; white-space: nowrap; }
    @media (max-width: 700px) { th, td { padding: 8px; } }
  `,
  field: css`
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
  `,
  status: css`margin-top: 12px;`,
}));

export default function MaterialCodingCover() {
  const { styles } = useStyles();
  const access = useAccess();
  const canEdit = access.can('material-coding.edit');
  const [cover, setCover] = useState<Cover>();
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [editor, setEditor] = useState<Editor>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let current = true;
    request<{ data: Cover }>(coverApi, { skipErrorHandler: true })
      .then(({ data }) => { if (current) setCover(data); })
      .catch(() => { if (current) setLoadError(true); });
    return () => { current = false; };
  }, [retry]);

  const begin = (draft: Editor) => {
    setError('');
    setSaved(false);
    setEditor(draft);
  };

  const save = async () => {
    if (!cover || !editor || saving) return;
    let next = { ...cover };
    if (editor.kind === 'info') {
      if (fields.some(({ key }) => !editor.fields[key].trim())) {
        setError('请填写标题、创建人和修改人。');
        return;
      }
      next = { ...next, ...editor.fields };
    } else if (editor.kind === 'delete') {
      next.changes = cover.changes.filter((_, index) => index !== editor.index);
    } else {
      if (!editor.fields.date || !editor.fields.description.trim()) {
        setError('请填写变更日期和说明。');
        return;
      }
      next.changes = editor.index === undefined
        ? [editor.fields, ...cover.changes]
        : cover.changes.map((row, index) => index === editor.index ? editor.fields : row);
    }

    setSaving(true);
    setError('');
    try {
      const { data } = await request<{ data: Cover }>(`${coverApi}/save`, {
        method: 'POST', data: next, skipErrorHandler: true,
      });
      setCover(data);
      setEditor(undefined);
      setSaved(true);
    } catch (failure) {
      const response = (failure as { response?: { data?: { message?: string } } }).response;
      setError(response?.data?.message || '保存失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  if (!cover) {
    return <>
      <h2 id="material-coding-section">Cover Page</h2>
      {loadError ? <div role="alert">封面读取失败 <Button onClick={() => {
        setLoadError(false);
        setRetry((value) => value + 1);
      }}>重试</Button></div> : <p role="status">正在读取封面…</p>}
    </>;
  }

  const createChange = () => begin({
    kind: 'change',
    fields: {
      date: new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date()),
      description: '',
    },
  });

  return <>
    <header className={styles.header}>
      <h2 id="material-coding-section">{cover.title}</h2>
      {canEdit && <Button onClick={() => begin({kind: 'info', fields: {
        title: cover.title, created_by: cover.created_by, modified_by: cover.modified_by,
      }})}>编辑封面</Button>}
    </header>
    <dl className={styles.credits}>
      <dt>Create By：</dt><dd>{cover.created_by}</dd>
      <dt>Modified By：</dt><dd>{cover.modified_by}</dd>
      <dt>Last Modified Date：</dt><dd>{cover.changes[0]?.date ?? '—'}</dd>
    </dl>
    <div className={styles.header}>
      <h3>变更记录</h3>
      {canEdit && <Button type="primary" onClick={createChange}>新增记录</Button>}
    </div>
    {saved && <div role="status" className={styles.status}>已保存</div>}
    <table className={styles.table} aria-label="变更记录">
      <thead><tr>
        <th scope="col">日期</th><th scope="col">变更说明</th>
        {canEdit && <th scope="col">操作</th>}
      </tr></thead>
      <tbody>
        {cover.changes.map((change, index) => <tr key={`${change.date}:${index}`}>
          <td>{change.date}</td><td>{change.description}</td>
          {canEdit && <td><Button type="link" size="small" onClick={() =>
            begin({ kind: 'change', fields: change, index })
          }>编辑</Button></td>}
        </tr>)}
        {!cover.changes.length && <tr><td colSpan={canEdit ? 3 : 2}>暂无变更记录</td></tr>}
      </tbody>
    </table>
    <Modal
      open={!!editor}
      title={editor?.kind === 'info' ? '编辑封面'
        : editor?.kind === 'delete' ? '删除变更记录'
          : editor?.index === undefined ? '新增变更记录' : '编辑变更记录'}
      okText={editor?.kind === 'delete' ? '删除' : '保存'}
      cancelText="取消"
      confirmLoading={saving}
      onOk={save}
      onCancel={() => { if (!saving) setEditor(undefined); }}
      okButtonProps={{ danger: editor?.kind === 'delete' }}
    >
      {editor?.kind === 'info' && fields.map(({ key, label, limit }) =>
        <label key={key} className={styles.field}>
          {label}
          <Input value={editor.fields[key]} maxLength={limit} onChange={(event) =>
            setEditor({ ...editor, fields: { ...editor.fields, [key]: event.target.value } })
          } />
        </label>,
      )}
      {editor?.kind === 'change' && <>
        <label className={styles.field}>
          变更日期
          <Input type="date" value={editor.fields.date} onChange={(event) =>
            setEditor({ ...editor, fields: { ...editor.fields, date: event.target.value } })
          } />
        </label>
        <label className={styles.field}>
          变更说明
          <Input.TextArea value={editor.fields.description} rows={8} maxLength={8000} onChange={(event) =>
            setEditor({ ...editor, fields: { ...editor.fields, description: event.target.value } })
          } />
        </label>
        {editor.index !== undefined &&
          <Button danger type="link" onClick={() => begin({ kind: 'delete', index: editor.index! })}>删除记录</Button>}
      </>}
      {editor?.kind === 'delete' && <p>删除 {cover.changes[editor.index].date} 的变更记录？</p>}
      {error && <p role="alert">{error}</p>}
    </Modal>
  </>;
}
