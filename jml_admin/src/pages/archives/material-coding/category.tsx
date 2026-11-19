import { Link, request, useAccess } from '@umijs/max';
import { Button, Image, Input, Modal } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MATERIAL_CODING_PATH } from '@/utils/adminPermissions';
import { CodingProductImages, ImageUploadButton, productImageUrl } from './product-images';

type Example = { code: string; description: string };
type CodeRow = [code: string, description: string, retired: boolean, images?: string[]];
type CodeGroup = { title: string; rows: CodeRow[]; note?: string; heading?: string; image_collection?: string };
type RuleSection = { title: string; examples: Example[]; groups: CodeGroup[] };
type Category = { sections: RuleSection[]; revision: number };
type DraftRow = { id: number; value: CodeRow; persisted: boolean };
type Draft =
  | { kind: 'example'; index: number; value: Example }
  | { kind: 'group'; index: number; title: string; rows: DraftRow[]; note?: string };

const categoryApi = '/api/admin/material-coding/category';
const supplierNoteLinkText = '详见供应商简称明细';
const veneerCodeGroup = '花色编码对照';
const referencePages: Record<string, Record<string, string>> = {
  'finished-accessories': { '序号/图纸号': 'accessory-products' },
  finished: { '设计部编码': 'product-models' },
  'veneer-finished': { 木种: 'veneer-design' },
  'grooved-finished': { 木种: 'veneer-design', '设计部编码': 'product-models' },
  'semi-finished': { '设计部编号': 'product-models' },
  'semi-finished-accessories': { '序号/图纸号': 'accessory-products' },
  'veneer-semi-finished': { 木种: 'veneer-design' },
  'primary-materials': { 木种: 'veneer-design', 年份色号: 'product-models', 色号: 'product-models' },
  'secondary-materials': { 木种: 'veneer-design', 原纸色号: 'product-models' },
};

const useStyles = createStyles(({ token, css }) => ({
  switches: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  `,
  sectionTitle: css`
    margin: 0 0 16px;
    color: ${token.colorTextHeading};
    font-size: ${token.fontSizeHeading4}px;
  `,
  example: css`
    display: grid;
    gap: 8px;
    margin-bottom: 20px;
    padding: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
    strong { color: ${token.colorTextHeading}; font-family: ${token.fontFamilyCode}; overflow-wrap: anywhere; }
    p { white-space: pre-wrap; overflow-wrap: anywhere; }
  `,
  exampleRow: css`
    display: grid;
    gap: 4px;
    & + & {
      padding-top: 8px;
      border-top: 1px solid ${token.colorBorderSecondary};
    }
  `,
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    h3 { margin: 0; font-size: 15px; }
  `,
  groups: css`
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(196px, 1fr);
    align-items: start;
    gap: 12px;
    overflow-x: auto;
    padding-bottom: 8px;
    &[data-image-groups='true'] { grid-auto-columns: minmax(240px, 1fr); }
    &[data-image-groups='true'][data-veneer-codes='true'] { grid-auto-columns: minmax(312px, 1fr); }
    &[data-code-change-view='true'] { grid-auto-columns: minmax(0, 560px); }
  `,
  groupHeading: css`
    grid-row: 1;
    margin: 0;
    padding: 6px 10px;
    border-radius: ${token.borderRadius}px;
    background: #d9eaf7;
    color: #17365d;
    font-size: 14px;
  `,
  group: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    overflow: hidden;
    header { min-height: 42px; padding: 6px 12px; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    th, td { padding: 7px 9px; vertical-align: top; overflow-wrap: anywhere; }
    th { color: #17365d; background: #d9eaf7; }
    td { border-top: 1px solid ${token.colorBorderSecondary}; white-space: pre-wrap; }
    tr > :first-child { width: 104px; }
    table[data-image-table='true'] {
      tr > :first-child { width: 70px; }
      tr > :last-child { width: 80px; }
    }
    [data-new-code='true'] { white-space: nowrap; }
    td[data-new-code='true'] { font-family: ${token.fontFamilyCode}; }
    td:first-child { font-family: ${token.fontFamilyCode}; }
    tr[data-retired='true'] td {
      color: ${token.colorTextDescription};
      text-decoration: line-through;
    }
    footer {
      padding: 8px 9px;
      border-top: 1px solid ${token.colorBorderSecondary};
      color: ${token.colorTextSecondary};
      font-size: 13px;
    }
  `,
  scrollableTable: css`
    max-height: 52dvh;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    th {
      position: sticky;
      top: 0;
      z-index: 1;
    }
  `,
  field: css`
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
  `,
  editRows: css`
    display: grid;
    gap: 8px;
    max-height: 45vh;
    overflow: auto;
    margin: 12px 0;
  `,
  editRow: css`
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) minmax(0, 2fr) max-content;
    gap: 8px;
    align-items: center;
    &[data-dragging='true'] { opacity: 0.5; }
    &[data-drop='before'] { box-shadow: 0 -2px 0 ${token.colorPrimary}; }
    &[data-drop='after'] { box-shadow: 0 2px 0 ${token.colorPrimary}; }
    &[data-retired='true'] input {
      color: ${token.colorTextDescription};
      text-decoration: line-through;
    }
  `,
  grip: css`
    display: grid;
    place-items: center;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: ${token.borderRadius}px;
    background: transparent;
    color: ${token.colorTextSecondary};
    font-size: 19px;
    cursor: grab;
    &:hover { background: ${token.colorFillSecondary}; }
    &:active { cursor: grabbing; }
  `,
  imageList: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 12px;
    max-height: 50vh;
    overflow: auto;
    margin-bottom: 12px;
    text-align: center;
  `,
}));

export default function MaterialCodingCategory({ pageKey, title }: { pageKey: string; title: string }) {
  const { styles } = useStyles();
  const access = useAccess();
  const canEdit = access.can('material-coding.edit');
  const [category, setCategory] = useState<Category>();
  const [sectionIndex, setSectionIndex] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<Draft>();
  const [draggedRow, setDraggedRow] = useState<number>();
  const [dropRow, setDropRow] = useState<number>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageTarget, setImageTarget] = useState<{ group: number; row: number }>();
  const [imageBusy, setImageBusy] = useState(false);
  const [imageVersions, setImageVersions] = useState<Record<string, Record<string, number>>>({});
  const groupsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let current = true;
    request<{ data: Category }>(categoryApi, {
      params: { key: pageKey }, skipErrorHandler: true,
    }).then(({ data }) => { if (current) setCategory(data); })
      .catch(() => { if (current) setLoadFailed(true); });
    return () => { current = false; };
  }, [pageKey, attempt]);

  const section = category?.sections[sectionIndex];
  const veneerGroups = pageKey === 'veneer-design' ? category?.sections.flatMap((item) => item.groups) ?? [] : [];
  const veneerChanges = veneerGroups.find((group) => group.title === veneerCodeGroup);
  const newVeneerCodes = new Map(veneerChanges?.rows.filter(([, , retired]) => !retired).map(([old, code]) => [old, code]));
  const veneerModels = new Set(veneerGroups.filter((group) => group.image_collection)
    .flatMap((group) => group.rows.map(([code]) => code)));
  const editingCodeChanges = draft?.kind === 'group' && draft.title === veneerChanges?.title;
  const imageGroup = imageTarget && section?.groups[imageTarget.group];
  const imageRow = imageTarget && imageGroup?.rows[imageTarget.row];
  const imageCollection = imageGroup?.image_collection;
  const imageFields = imageTarget && imageCollection && category ? {
    collection: imageCollection, row: String(imageTarget.row), revision: String(category.revision),
  } : undefined;

  useLayoutEffect(() => {
    const groups = groupsRef.current;
    if (!section || !groups) return;
    const tables = [...groups.querySelectorAll<HTMLElement>('[data-coding-table]')];
    const panel = groups.closest('section[aria-labelledby="material-coding-section"]');
    const main = groups.closest('main');
    const fitToViewport = () => {
      const bottomPadding = [main, panel, groups].reduce((total, element) =>
        total + (element ? Number.parseFloat(getComputedStyle(element).paddingBottom) : 0), 0);
      const heights = tables.map((table) => {
        const top = Math.max(0, table.getBoundingClientRect().top);
        const footer = table.nextElementSibling?.getBoundingClientRect().height ?? 0;
        return Math.max(160, Math.floor(window.innerHeight - top - bottomPadding - footer - 2));
      });
      tables.forEach((table, index) => { table.style.maxHeight = `${heights[index]}px`; });
      tables.forEach((table) => {
        if (table.scrollHeight > table.clientHeight) table.tabIndex = 0;
        else table.removeAttribute('tabindex');
      });
    };
    fitToViewport();
    const observer = new ResizeObserver(fitToViewport);
    if (panel) observer.observe(panel);
    window.addEventListener('resize', fitToViewport);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fitToViewport);
    };
  }, [section]);

  const headings: { title: string; start: number; length: number }[] = [];
  section?.groups.forEach(({ heading }, index) => {
    if (!heading) return;
    const previous = headings[headings.length - 1];
    if (previous?.title === heading && previous.start + previous.length === index) {
      previous.length += 1;
    } else {
      headings.push({ title: heading, start: index, length: 1 });
    }
  });
  const finishDrag = () => {
    setDraggedRow(undefined);
    setDropRow(undefined);
  };

  const edit = (next: Draft) => {
    setError('');
    finishDrag();
    setDraft(next);
  };


  const updateRow = <Field extends 0 | 1 | 2,>(id: number, field: Field, input: CodeRow[Field]) => {
    if (draft?.kind !== 'group') return;
    setDraft({ ...draft, rows: draft.rows.map((row) => {
      if (row.id !== id) return row;
      const value: CodeRow = [...row.value];
      value[field] = input;
      return { ...row, value };
    }) });
  };

  const moveRow = (id: number, target: number) => {
    if (draft?.kind !== 'group') return;
    const source = draft.rows.findIndex((row) => row.id === id);
    if (source < 0 || source === target || target < 0 || target >= draft.rows.length) return;
    const rows = [...draft.rows];
    const [moved] = rows.splice(source, 1);
    rows.splice(target, 0, moved);
    setDraft({ ...draft, rows });
  };

  const save = async () => {
    if (!category || !section || !draft || saving) return;
    const updatedSection = draft.kind === 'example'
      ? { ...section, examples: section.examples.map((item, index) => index === draft.index ? draft.value : item) }
      : { ...section, groups: section.groups.map((group, index) =>
        index === draft.index ? {
          ...group, rows: draft.rows.map(({ value }) => value), note: draft.note?.trim() || undefined,
        } : group) };
    const sections = category.sections.map((item, index) => index === sectionIndex ? updatedSection : item);
    setSaving(true);
    setError('');
    try {
      const { data } = await request<{ data: Category }>(`${categoryApi}/save`, {
        method: 'POST', data: { key: pageKey, sections, revision: category.revision }, skipErrorHandler: true,
      });
      setCategory(data);
      setDraft(undefined);
    } catch (failure) {
      const response = (failure as { response?: { data?: { message?: string } } }).response;
      setError(response?.data?.message || '保存失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  return <>
    <h2 id="material-coding-section">{title}</h2>
    {loadFailed && <div role="alert">编码规则读取失败 <Button onClick={() => {
      setLoadFailed(false);
      setAttempt((value) => value + 1);
    }}>重试</Button></div>}
    {!section && !loadFailed && <p role="status">正在读取编码规则…</p>}
    {category && section && <>
      {category.sections.length > 1 ? <div className={styles.switches} role="group" aria-label="产品规则">
        {category.sections.map((item, index) => (
          <Button key={item.title} type={index === sectionIndex ? 'primary' : 'default'}
            aria-pressed={index === sectionIndex} onClick={() => setSectionIndex(index)}>
            {item.title}
          </Button>
        ))}
      </div> : <h3 className={styles.sectionTitle}>{section.title}</h3>}
      {section.examples.length > 0 && <section aria-label="编码示例" className={styles.example}>
        <header className={styles.header}>
          <h3>编码示例</h3>
        </header>
        {section.examples.map((example, index) => (
          <div className={styles.exampleRow} key={`${example.code}:${index}`}>
            <div className={styles.header}>
              <strong>{example.code}</strong>
              {canEdit && <Button type="link" size="small"
                aria-label={section.examples.length > 1 ? `编辑示例 ${index + 1}` : undefined}
                onClick={() => edit({ kind: 'example', index, value: example })}>编辑示例</Button>}
            </div>
            <p>{example.description}</p>
          </div>
        ))}
      </section>}
      <div ref={groupsRef} className={styles.groups} role="region" aria-label="编码对照" tabIndex={0}
        data-image-groups={section.groups.some((group) => group.image_collection) || undefined}
        data-veneer-codes={Boolean(veneerChanges) || undefined}
        data-code-change-view={section.groups.some((group) => group === veneerChanges) || undefined}>
        {headings.map(({ title: heading, start, length }) =>
          <h3 key={start} className={styles.groupHeading} style={{ gridColumn: `${start + 1} / span ${length}` }}>{heading}</h3>
        )}
        {section.groups.map((group, index) => {
          const supplierNote = group.note?.startsWith(supplierNoteLinkText);
          const reference = supplierNote ? 'supplier-abbreviations' : referencePages[pageKey]?.[group.title];
          const collection = group.image_collection;
          const codeChanges = group === veneerChanges;
          const linkedCodes = Boolean(collection && veneerChanges);
          const table = (group.rows.length > 0 || !group.note) && <table aria-label={group.title}
            data-image-table={Boolean(collection) || undefined}>
            <thead><tr><th scope="col">{codeChanges || linkedCodes ? '前款号' : '编码'}</th>
              {linkedCodes && <th scope="col">新编码</th>}
              <th scope="col">{codeChanges ? '新编码' : '说明'}</th>
              {codeChanges && <th scope="col">档案关联</th>}
              {collection && <th scope="col">图片</th>}
            </tr></thead>
            <tbody>
              {group.rows.map(([code, description, retired, images], row) => (
                <tr key={`${code}:${row}`} data-retired={retired || undefined}>
                  <td>{code}</td>
                  {linkedCodes && <td data-new-code="true">{newVeneerCodes.get(code) || '—'}</td>}
                  <td data-new-code={codeChanges || undefined}>{description || (codeChanges ? '—' : '')}</td>
                  {codeChanges && <td>{veneerModels.has(code) ? '已关联' : '未关联'}</td>}
                  {collection && <td>
                    {images?.length ? <CodingProductImages collection={collection}
                      files={images} label={`${code} ${description}`} versions={imageVersions[collection]} /> : '—'}
                    {canEdit && <div><Button type="link" size="small" aria-label={`维护 ${code} 图片`}
                      onClick={() => setImageTarget({ group: index, row })}>维护图片</Button></div>}
                  </td>}
                </tr>
              ))}
              {!group.rows.length && <tr><td colSpan={2 + Number(Boolean(collection)) + Number(codeChanges || linkedCodes)}>暂无编码</td></tr>}
            </tbody>
          </table>;
          return (
            <section className={styles.group} key={`${group.title}:${index}`}
              style={headings.length ? { gridRow: 2, gridColumn: index + 1 } : undefined}>
              <header className={styles.header}>
                <h3>{group.title}</h3>
                {canEdit && <Button type="link" size="small" aria-label={`编辑${group.title}`} onClick={() =>
                  edit({ kind: 'group', index, title: group.title, note: group.note,
                    rows: group.rows.map((value, id) => ({ id, value, persisted: true })) })}>编辑</Button>}
              </header>
              {table && <div data-coding-table className={styles.scrollableTable}
                role="region" aria-label={`${group.title}清单`}>{table}</div>}
              {group.note && <footer>
                {reference ? <Link to={`${MATERIAL_CODING_PATH}?page=${reference}`}>
                  {supplierNote ? supplierNoteLinkText : group.note}
                </Link> : group.note}
                {supplierNote && group.note.slice(supplierNoteLinkText.length)}
              </footer>}
            </section>
          );
        })}
      </div>
    </>}
    <Modal
      open={!!draft}
      title={draft?.kind === 'group' ? `编辑${draft.title}` : '编辑编码示例'}
      width={620}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      onOk={save}
      onCancel={() => { if (!saving) setDraft(undefined); }}
    >
      {draft?.kind === 'example' && <>
        <label className={styles.field}>示例编码<Input value={draft.value.code} maxLength={240} onChange={(event) =>
          setDraft({ ...draft, value: { ...draft.value, code: event.target.value } })} /></label>
        <label className={styles.field}>示例说明<Input.TextArea value={draft.value.description} rows={4} maxLength={2000}
          onChange={(event) => setDraft({ ...draft, value: { ...draft.value, description: event.target.value } })} /></label>
      </>}
      {draft?.kind === 'group' && <>
        <div className={styles.editRows}>
          {draft.rows.map(({ id, value: [code, description, retired], persisted }, index) => (
            <div key={id} className={styles.editRow} data-retired={retired || undefined}
              data-dragging={draggedRow === id || undefined}
              data-drop={dropRow === id ? (draft.rows.findIndex((row) => row.id === draggedRow) < index ? 'after' : 'before') : undefined}
              onDragOver={(event) => {
                if (draggedRow === undefined) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDropRow(draggedRow === id ? undefined : id);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDropRow((current) => current === id ? undefined : current);
                }
              }}
              onDrop={(event) => {
                if (draggedRow === undefined) return;
                event.preventDefault();
                moveRow(draggedRow, index);
                finishDrag();
              }}>
              <button type="button" className={styles.grip} draggable={!saving} disabled={saving}
                aria-label={`调整第 ${index + 1} 行顺序`} title="拖动或用方向键排序"
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', String(id));
                  setDraggedRow(id);
                }}
                onDragEnd={finishDrag}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                  event.preventDefault();
                  moveRow(id, index + (event.key === 'ArrowUp' ? -1 : 1));
                }}>⠿</button>
              <Input aria-label={`${editingCodeChanges ? '前款号' : '编码'} ${index + 1}`}
                placeholder={editingCodeChanges ? '前款号' : '编码'} value={code} maxLength={240}
                onChange={(event) => updateRow(id, 0, event.target.value)} />
              <Input aria-label={`${editingCodeChanges ? '新编码' : '说明'} ${index + 1}`}
                placeholder={editingCodeChanges ? '新编码' : '说明'} value={description} maxLength={2000}
                onChange={(event) => updateRow(id, 1, event.target.value)} />
              {persisted
                ? <Button type="text" onClick={() => updateRow(id, 2, !retired)}>
                  {retired ? '恢复使用' : '标为废弃'}
                </Button>
                : <Button type="text" onClick={() => setDraft({
                  ...draft, rows: draft.rows.filter((row) => row.id !== id),
                })}>移除</Button>}
            </div>
          ))}
        </div>
        <Button onClick={() => setDraft({
          ...draft, rows: [...draft.rows, {
            id: Math.max(-1, ...draft.rows.map(({ id }) => id)) + 1,
            value: ['', '', false], persisted: false,
          }],
        })}>新增一行</Button>
        {draft.note !== undefined && <label className={styles.field}>
          分组备注
          <Input value={draft.note} maxLength={2000} onChange={(event) =>
            setDraft({ ...draft, note: event.target.value })} />
        </label>}
      </>}
      {error && <p role="alert">{error}</p>}
    </Modal>
    <Modal open={!!imageRow} title={imageRow ? `${imageRow[0]} ${imageRow[1]} · 维护图片` : '维护图片'}
      footer={null} onCancel={() => { if (!imageBusy) setImageTarget(undefined); }}>
      {imageFields && imageCollection && imageRow && <>
        {Boolean(imageRow[3]?.length) && <div className={styles.imageList}>
          {imageRow[3]?.map((filename, index) => {
            const original = productImageUrl(imageCollection, filename, imageVersions[imageCollection]?.[filename]);
            return <div key={filename}>
              <Image src={`${original}&size=thumbnail`} width={104} height={78} style={{ objectFit: 'contain' }}
                alt={`${imageRow[0]} 图片 ${index + 1}`} preview={{ src: original, cover: '查看' }} />
              <ImageUploadButton<Category> endpoint="veneer-image" fields={{ ...imageFields, replace: filename }}
                label={`更换第 ${index + 1} 张图片`} link disabled={imageBusy} onBusy={setImageBusy}
                onUploaded={(data) => {
                  setCategory(data);
                  setImageVersions((current) => ({
                    ...current, [imageCollection]: { ...current[imageCollection], [filename]: Date.now() },
                  }));
                }}>更换</ImageUploadButton>
            </div>;
          })}
        </div>}
        <ImageUploadButton<Category> endpoint="veneer-image" fields={imageFields} disabled={imageBusy}
          onBusy={setImageBusy} onUploaded={setCategory}>添加图片</ImageUploadButton>
      </>}
    </Modal>
  </>;
}
