import { request, useAccess } from '@umijs/max';
import { Button, Image, Input, Modal } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';
import { ImageUploadButton } from './product-images';

type Product = {
  code: string;
  name: string;
  drawing: string;
  process: string;
  customer_material: string;
};

type ProductList = { products: Product[]; revision: number };
const categoryApi = '/api/admin/material-coding/category';
const pageKey = 'accessory-products';
const fields = [
  { key: 'name', label: '名称', limit: 240, lines: 2 },
  { key: 'process', label: '工艺', limit: 120, lines: 1 },
  { key: 'customer_material', label: '客供材料', limit: 2000, lines: 3 },
] as const;

const useStyles = createStyles(({ token, css }) => ({
  scroll: css`overflow-x: auto;`,
  table: css`
    width: 100%;
    min-width: 700px;
    border-collapse: collapse;
    text-align: left;
    th, td { padding: 10px 14px; vertical-align: middle; }
    th { background: #d9eaf7; color: #17365d; white-space: nowrap; }
    td { border-bottom: 1px solid ${token.colorBorderSecondary}; white-space: pre-wrap; overflow-wrap: anywhere; }
    td:first-child { font-family: ${token.fontFamilyCode}; font-variant-numeric: tabular-nums; }
    td:nth-child(3) { width: 144px; }
    td:nth-child(4) { white-space: nowrap; }
  `,
  field: css`
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
  `,
}));

export default function AccessoryProducts() {
  const { styles } = useStyles();
  const access = useAccess();
  const canEdit = access.can('material-coding.edit');
  const [list, setList] = useState<ProductList>();
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<Product>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [versions, setVersions] = useState<Record<string, number>>({});

  useEffect(() => {
    let current = true;
    request<{ data: ProductList }>(categoryApi, { params: { key: pageKey }, skipErrorHandler: true })
      .then(({ data }) => { if (current) setList(data); })
      .catch(() => { if (current) setLoadError(true); });
    return () => { current = false; };
  }, [attempt]);

  const save = async () => {
    if (!list || !draft || saving) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await request<{ data: ProductList }>(`${categoryApi}/save`, {
        method: 'POST',
        data: {
          key: pageKey, revision: list.revision,
          products: list.products.map((row) => row.code === draft.code ? draft : row),
        },
        skipErrorHandler: true,
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

  return <>
    <h2 id="material-coding-section">辅料产品明细</h2>
    {loadError && <div role="alert">辅料产品明细读取失败 <Button onClick={() => {
      setLoadError(false);
      setAttempt((value) => value + 1);
    }}>重试</Button></div>}
    {!list && !loadError && <p role="status">正在读取辅料产品明细…</p>}
    {list && <div className={styles.scroll} role="region" aria-label="辅料清单" tabIndex={0}>
      <table className={styles.table} aria-label="辅料产品明细">
        <thead><tr>
          <th scope="col">序号</th><th scope="col">名称</th><th scope="col">CAD</th>
          <th scope="col">工艺</th><th scope="col">客供材料</th>
          {canEdit && <th scope="col">操作</th>}
        </tr></thead>
        <tbody>
          {list.products.map((row) => <tr key={row.code}>
            <td>{row.code}</td><td>{row.name}</td>
            <td><Image width={120} height={82} style={{ objectFit: 'contain' }}
              src={`/api/admin/material-coding/accessory-drawing?id=${row.drawing}&v=${versions[row.drawing] ?? 0}`}
              alt={`CAD 图纸 ${row.code}`} preview={{ cover: '查看图纸' }} />
              {canEdit && <div><ImageUploadButton endpoint="accessory-drawing" link
                fields={{ id: row.drawing }} label={`上传 ${row.code} 图纸`}
                onUploaded={() => setVersions((current) => ({ ...current, [row.drawing]: Date.now() }))}>
                上传图纸
              </ImageUploadButton></div>}
            </td>
            <td>{row.process}</td><td>{row.customer_material}</td>
            {canEdit && <td><Button type="link" size="small" aria-label={`编辑 ${row.code}`} onClick={() => {
              setError('');
              setDraft(row);
            }}>编辑</Button></td>}
          </tr>)}
          {!list.products.length && <tr><td colSpan={canEdit ? 6 : 5}>暂无辅料明细</td></tr>}
        </tbody>
      </table>
    </div>}
    <Modal open={!!draft} title={`编辑辅料 ${draft?.code ?? ''}`} okText="保存" cancelText="取消"
      confirmLoading={saving} onOk={save} onCancel={() => { if (!saving) setDraft(undefined); }}>
      {draft && fields.map(({ key, label, limit, lines }) => <label key={key} className={styles.field}>
        {label}
        <Input.TextArea value={draft[key]} maxLength={limit} rows={lines}
          onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
      </label>)}
      {error && <p role="alert">{error}</p>}
    </Modal>
  </>;
}
