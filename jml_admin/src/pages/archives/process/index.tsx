import { Link, useAccess, useLocation } from '@umijs/max';
import { Button } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';
import { PROCESS_ARCHIVE_PATH, processArchiveSections } from '@/utils/adminPermissions';
import ArchiveEmail from '../ArchiveEmail';
import {
  approvalTable, archiveContents, archiveTables, archiveTitle, coverCredits, getArchiveSnapshot,
  type ArchiveSnapshot, type ArchiveTable,
} from './document';

const useStyles = createStyles(({ token, css }) => ({
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    h1 {
      margin: 0;
      font-size: ${token.fontSizeHeading4}px;
      font-weight: 600;
    }
  `,
  tabs: css`
    display: flex;
    gap: 24px;
    margin-bottom: 16px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    a {
      padding: 8px 0;
      color: ${token.colorTextSecondary};
      border-bottom: 2px solid transparent;
    }
    a:hover,
    a[aria-current='page'] {
      color: ${token.colorPrimary};
    }
    a[aria-current='page'] {
      border-bottom-color: ${token.colorPrimary};
      font-weight: 600;
    }
  `,
  actions: css`
    display: flex;
    align-items: center;
    gap: 12px;
  `,
  document: css`
    padding: clamp(16px, 2.5vw, 32px);
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: ${token.borderRadiusLG}px;
    color: #18283b;
    h2 {
      margin: 0 0 20px;
      color: #17365d;
      font-size: 25px;
      font-weight: 650;
    }
    h3 {
      margin: 26px 0 10px;
      color: #17365d;
      font-size: 16px;
    }
  `,
  credits: css`
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 8px 20px;
    margin: 0 0 22px;
    dt { color: #475569; }
    dd { margin: 0; }
  `,
  table: css`
    width: 100%;
    border-collapse: collapse;
    th, td {
      padding: 10px 14px;
      border-bottom: 1px solid #e2e8f0;
      text-align: left;
      vertical-align: middle;
      white-space: pre-line;
      overflow-wrap: anywhere;
    }
    th {
      color: #17365d;
      background: #d9eaf7;
      font-weight: 650;
    }
    tr[data-kind='group'] td {
      background: #f0f5fa;
      font-weight: 650;
    }
    tr[data-kind='version'] td:nth-child(2) {
      padding-inline-start: 32px;
    }
    tr[data-inactive='true'] td {
      color: #64748b;
      text-decoration: line-through;
    }
  `,
  notice: css`
    display: flex;
    align-items: center;
    gap: 12px;
  `,
}));

function DocumentTable({ table }: { table: ArchiveTable }) {
  const { styles } = useStyles();
  const width = table.columns.reduce((total, col) => total + col.width, 0);
  return (
    <table className={styles.table} aria-label={table.title}>
      <colgroup>
        {table.columns.map((col) => <col key={col.label} style={{ width: `${100 * col.width / width}%` }} />)}
      </colgroup>
      <thead>
        <tr>{table.columns.map((col) => <th key={col.label} scope="col">{col.label}</th>)}</tr>
      </thead>
      <tbody>
        {table.rows.map((row) => (
          <tr key={row.key} data-inactive={row.inactive || undefined} data-kind={row.kind}>
            {row.values.map((value, index) => <td key={table.columns[index].label}>{value}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ProcessArchive() {
  const access = useAccess();
  const { search } = useLocation();
  const { styles } = useStyles();
  const sections = processArchiveSections.filter(({ access: permission }) => access[permission]);
  const active = sections.find(({ key }) => key === new URLSearchParams(search).get('tab'));
  const canMaintain = active && ['add', 'edit', 'toggle', 'restore'].some((action) => access.can(`${active.key}.${action}`));
  const [snapshot, setSnapshot] = useState<ArchiveSnapshot>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);

  useEffect(() => {
    let current = true;
    setSnapshot(undefined);
    setFailed(false);
    getArchiveSnapshot().then((result) => {
      if (result.code !== 0 || !result.data) throw new Error('工艺档案读取失败');
      if (current) setSnapshot(result.data);
    }).catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [search, attempt]);

  const download = async () => {
    if (!snapshot || exporting) return;
    setExporting(true);
    setExportFailed(false);
    try {
      const { exportArchive } = await import('./exportExcel');
      await exportArchive();
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };

  const tables = snapshot ? archiveTables(snapshot) : {};
  const table = active && tables[active.key];
  const approvals = snapshot?.approvals && approvalTable(snapshot.approvals);

  return (
    <section aria-label="工艺档案">
      <header className={styles.header}>
        <h1>工艺档案</h1>
        <div className={styles.actions}>
          {active && <Link to={PROCESS_ARCHIVE_PATH}>返回封面</Link>}
          {canMaintain && <Link to={active.path}>维护资料</Link>}
          <Button loading={exporting} disabled={!snapshot} onClick={download}>导出 Excel</Button>
          <ArchiveEmail archive="archive-process" title="工艺档案" />
        </div>
      </header>
      <nav className={styles.tabs} aria-label="工艺档案页签">
        {sections.map(({ key, label }) => (
          <Link key={key} to={`${PROCESS_ARCHIVE_PATH}?tab=${key}`} aria-current={key === active?.key ? 'page' : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      {exportFailed && <p role="alert">导出失败，请重试</p>}
      {failed ? (
        <div className={styles.notice} role="alert">工艺档案读取失败<Button onClick={() => setAttempt((value) => value + 1)}>重试</Button></div>
      ) : !snapshot ? <p role="status">正在读取工艺档案…</p> : table ? (
        <div className={styles.document}>
          <h2>{table.title}</h2>
          <DocumentTable table={table} />
        </div>
      ) : (
        <section className={styles.document} aria-label="工艺档案封面">
          <h2>{archiveTitle}</h2>
          <dl className={styles.credits}>
            {coverCredits(snapshot.last_modified_date).map(([label, value]) => (
              <React.Fragment key={label}><dt>{label}：</dt><dd>{value}</dd></React.Fragment>
            ))}
          </dl>
          <p>{archiveContents(tables)}</p>
          {approvals && <><h3>{approvals.title}</h3><DocumentTable table={approvals} /></>}
        </section>
      )}
    </section>
  );
}
