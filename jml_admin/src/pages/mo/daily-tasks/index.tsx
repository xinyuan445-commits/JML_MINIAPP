import { useAccess, useModel } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  DatePicker,
  Drawer,
  Input,
  Modal,
  Select,
  Table,
} from 'antd';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import DailyTaskDetail from './detail';
import { businessToday } from './candidateFilter';
import NonorderExecution from './NonorderExecution';
import { sheetLabel, sheetLocks } from './lifecycle';
import { createTaskSheet, getTaskSheets, type TaskSheet } from './service';
import {
  mergeTaskSheets,
  readDraftSheets,
  type SheetRow,
  sheetKey,
} from './sheets';

const useStyles = createStyles(({ css, token }) => ({
  root: css`padding:24px; min-height:calc(100vh - 100px); background:${token.colorBgLayout};`,
  toolbar: css`display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px;
    h2 { margin:0 auto 0 0; font-size:22px; }`,
  panel: css`padding:20px; background:${token.colorBgContainer}; border:1px solid ${token.colorBorderSecondary}; border-radius:12px;`,
  form: css`display:grid; gap:20px; margin:24px 0; label { display:grid; gap:8px; }`,
  muted: css`color:${token.colorTextSecondary}; font-size:12px;`,
  pending: css`color:${token.colorWarningText}; font-size:12px; margin-left:8px;`,
}));

export default function DailyTaskSheets() {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const access = useAccess();
  const { initialState } = useModel('@@initialState');
  const user = initialState?.currentUser;
  const owner = user?.adminAccountId
    ? `account:${user.adminAccountId}`
    : user?.username
      ? `user:${user.username}`
      : '';
  const canManage = access.can('daily-tasks.manage') && Boolean(owner);
  const [sheets, setSheets] = useState<TaskSheet[]>([]);
  const [local, setLocal] = useState(() => readDraftSheets(owner));
  const [selected, setSelected] = useState<TaskSheet>();
  const [execution, setExecution] = useState(false);
  const [focusAssignment, setFocusAssignment] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<string>();
  const [stateFilter, setStateFilter] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(dayjs(businessToday()).add(1, 'day').format('YYYY-MM-DD'));
  const [createError, setCreateError] = useState('');
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    setLocal(readDraftSheets(owner));
    try {
      setSheets(await getTaskSheets());
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取失败，请重试');
    } finally {
      setBusy(false);
    }
  }, [owner]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const refreshDrafts = () => setLocal(readDraftSheets(owner));
    window.addEventListener('storage', refreshDrafts);
    return () => window.removeEventListener('storage', refreshDrafts);
  }, [owner]);
  const rows = mergeTaskSheets(sheets, local.drafts);
  const filtered = rows.filter(
    (row) =>
      (!dateFilter || row.work_date === dateFilter) &&
      (!stateFilter ||
        (stateFilter === 'local'
          ? row.localDraft
          : row.id > 0 && row.status === stateFilter)) &&
      `${row.work_date} ${row.creator_display_name || ''} ${row.created_by}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const open = async (row: TaskSheet) => {
    if (row.id) {
      setSelected(row);
      return;
    }
    if (!canManage || saving) return;
    setSaving(true);
    try {
      const result = await createTaskSheet(row.work_date);
      setSelected(result.sheet);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '安排单创建失败');
    } finally {
      setSaving(false);
    }
  };
  const create = async () => {
    if (!canManage || saving) return;
    setCreateError('');
    // Old browser-only drafts remain editable without changing their base revision.
    const existing = rows.find(
      (row) => row.work_date === date && row.sheet_kind !== 'supplement',
    );
    if (existing) {
      setCreating(false);
      await open(existing);
      message.info('已打开此日期的安排单');
      return;
    }
    setSaving(true);
    try {
      const result = await createTaskSheet(date);
      setCreating(false);
      setSelected(result.sheet);
      message.success(result.created ? '安排单已创建' : '已打开已有安排单');
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '创建失败，请重试');
    } finally {
      setSaving(false);
    }
  };
  const supplement = async (parent: TaskSheet) => {
    if (!canManage || saving) return;
    setSaving(true);
    try {
      const result = await createTaskSheet(parent.work_date, parent.id);
      setSelected(result.sheet);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '补充安排创建失败');
    } finally {
      setSaving(false);
    }
  };
  const supplementNonorder = async (workDate: string, assignment: number) => {
    if (!canManage || saving) return;
    setSaving(true);
    try {
      const sameDay = sheets.filter((row) => row.work_date === workDate);
      let target = sameDay.find((row) => !sheetLocks(row).plan && !sheetLocks(row).result);
      if (!target) {
        const parent = sameDay.find((row) => row.sheet_kind !== 'supplement');
        target = (await createTaskSheet(workDate, parent?.id)).sheet;
      }
      setExecution(false);
      setFocusAssignment(assignment);
      setSelected(target);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '补充安排创建失败');
    } finally {
      setSaving(false);
    }
  };
  if (selected)
    return (
      <DailyTaskDetail
        key={sheetKey(selected)}
        sheet={selected}
        focusAssignment={focusAssignment}
        onBack={() => {
          setSelected(undefined);
          setFocusAssignment(undefined);
          void load();
        }}
      />
    );
  return (
    <main className={styles.root}>
      <div className={styles.toolbar}>
        <h2>任务安排单</h2>
        <Button loading={busy} onClick={() => void load()}>
          刷新
        </Button>
        {(access.can('nonorder.view') || access.can('nonorder.transfer')) && <Button onClick={() => setExecution(true)}>无工单执行查询</Button>}
        {canManage && (
          <Button
            type="primary"
            disabled={busy || !!error}
            onClick={() => {
              setDate(dayjs(businessToday()).add(1, 'day').format('YYYY-MM-DD'));
              setCreateError('');
              setCreating(true);
            }}
          >
            新建安排单
          </Button>
        )}
      </div>
      {error && <Alert type="error" title={error} showIcon />}
      {local.warning && <Alert type="warning" title={local.warning} showIcon />}
      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <Input
            allowClear
            placeholder="搜索日期或创建人"
            aria-label="搜索安排单"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <DatePicker
            placeholder="全部执行日期"
            aria-label="筛选执行日期"
            value={dateFilter ? dayjs(dateFilter) : null}
            onChange={(value) => setDateFilter(value?.format('YYYY-MM-DD'))}
          />
          <Select
            allowClear
            placeholder="全部状态"
            aria-label="筛选安排单状态"
            style={{ width: 150 }}
            value={stateFilter}
            onChange={setStateFilter}
            options={[
              { value: 'draft', label: '草稿' },
              { value: 'published', label: '已发布' },
              { value: 'partial', label: '部分已发布' },
              { value: 'local', label: '有本地修改' },
            ]}
          />
          <span className={styles.muted}>共 {filtered.length} 张</span>
        </div>
        <Table<SheetRow>
          rowKey={sheetKey}
          loading={busy}
          dataSource={filtered}
          pagination={false}
          scroll={{ x: 1000 }}
          locale={{ emptyText: '暂无安排单' }}
          columns={[
            {
              title: '执行日期',
              dataIndex: 'work_date',
              width: 140,
              render: (_, row) => (
                <Button type="link" onClick={() => void open(row)}>
                  {row.work_date}
                </Button>
              ),
            },
            {
              title: '安排单',
              width: 150,
              render: (_, row) => sheetLabel(row),
            },
            {
              title: '状态',
              width: 200,
              render: (_, row) => (
                <>
                  <span>
                    {sheetLocks(row).result
                      ? '结果已锁定'
                      : sheetLocks(row).plan
                        ? '安排已锁定'
                        : !row.id
                          ? '仅本地草稿'
                          : row.status === 'published'
                            ? '已发布'
                            : row.status === 'partial'
                              ? '部分已发布'
                              : '草稿'}
                  </span>
                  {row.id > 0 && row.localDraft && (
                    <span className={styles.pending}>有本地修改</span>
                  )}
                </>
              ),
            },
            { title: '工站数', dataIndex: 'station_count', width: 90 },
            { title: '工单安排', dataIndex: 'task_count', width: 110 },
            ...(sheets.some((row) => row.nonorder_count !== undefined)
              ? [{ title: '无工单人员', dataIndex: 'nonorder_count', width: 110, render: (value: number | undefined) => value ?? '—' }]
              : []),
            {
              title: '创建人',
              width: 120,
              render: (_, row) => row.creator_display_name || row.created_by || '—',
            },
            {
              title: '创建时间',
              dataIndex: 'created_at',
              width: 175,
              render: (value) => value || '—',
            },
            {
              title: '操作',
              width: 200,
              fixed: 'right',
              render: (_, row) => (
                <>
                  <Button type="link" onClick={() => void open(row)}>
                    {canManage &&
                    !sheetLocks(row).plan &&
                    !sheetLocks(row).result
                      ? '维护安排'
                      : '查看'}
                  </Button>
                  {canManage &&
                    row.sheet_kind !== 'supplement' &&
                    sheetLocks(row).plan &&
                    !sheetLocks(row).result && (
                      <Button
                        type="link"
                        loading={saving}
                        onClick={() => void supplement(row)}
                      >
                        新建补充安排
                      </Button>
                    )}
                </>
              ),
            },
          ]}
        />
      </section>
      <Drawer title="无工单执行查询" size={1100} open={execution} destroyOnHidden onClose={() => setExecution(false)}>
        {execution && <NonorderExecution initialDate={dateFilter || businessToday()}
          onSupplement={canManage ? (workDate, assignment) => void supplementNonorder(workDate, assignment) : undefined} />}
      </Drawer>
      <Modal
        title="新建任务安排单"
        open={creating}
        onCancel={() => {
          if (!saving) setCreating(false);
        }}
        onOk={() => void create()}
        confirmLoading={saving}
        okText="创建并进入"
        cancelButtonProps={{ disabled: saving }}
      >
        <div className={styles.form}>
          <label htmlFor="daily-sheet-date">
            执行日期
            <DatePicker
              id="daily-sheet-date"
              aria-label="新建执行日期"
              allowClear={false}
              disabled={saving}
              value={dayjs(date)}
              disabledDate={(value) => value.format('YYYY-MM-DD') < businessToday()}
              onChange={(value) => {
                if (value) setDate(value.format('YYYY-MM-DD'));
              }}
            />
          </label>
        </div>
        {createError && <Alert type="error" title={createError} showIcon />}
      </Modal>
    </main>
  );
}
