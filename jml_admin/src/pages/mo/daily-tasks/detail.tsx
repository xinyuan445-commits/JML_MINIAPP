import { useAccess, useModel } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Dropdown,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
  Table,
  Tabs,
} from 'antd';
import { createStyles } from 'antd-style';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  arrangeRoute,
  type DraftChange,
  draftChanges,
  routeCandidates,
} from './arrangementActions';
import {
  businessToday,
  candidateDateWindow,
  candidateOrderKey,
  followupHint,
  groupCandidatesForDisplay,
  type StartDateRange,
} from './candidateFilter';
import {
  availableNow,
  editDraft,
  type LocalDraft,
  previewDraft,
  taskReadiness,
  waitingToArrange,
} from './draft';
import { businessTime, sheetLabel, sheetLocks } from './lifecycle';
import { arrangementRows, isNonorderDrag, laneGroups, NonorderCard, NonorderLane, NonorderPool, PERSON_DRAG } from './NonorderSchedule';
import NonorderExecution from './NonorderExecution';
import NonorderPublish from './NonorderPublish';
import NonorderWorkEditor from './NonorderWorkEditor';
import { editLabels, editsToSave, type NonorderEdit } from './nonorderDraft';
import { groupKey, type NonorderCandidate, type NonorderCreation } from './nonorderService';
import { printTasks } from './print';
import {
  type Candidate,
  type DailyData,
  exportTasks,
  getPrintTasks,
  getTasks,
  saveTask,
  type Task,
  type TaskSheet,
} from './service';
import {
  createSheetDraft,
  draftScope,
  sheetBatchPayload,
  sheetHasConflict,
} from './sheetDraft';
import { readDraftSheets } from './sheets';
import TaskCard from './TaskCard';
import { useLocalDraft } from './useLocalDraft';

const useStyles = createStyles(({ css, token }) => ({
  root: css`padding: 20px; background: ${token.colorBgLayout}; min-height: calc(100vh - 100px);
    &[data-arrange=true] { display:flex; flex-direction:column; box-sizing:border-box; min-height:0; height:var(--daily-task-height, calc(100dvh - 144px)); overflow:hidden;
      > * { flex-shrink:0; }
    }
    @media print { height:auto !important; overflow:visible !important; padding: 0; background: white; .no-print { display: none !important; } }
  `,
  toolbar: css`display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:16px;
    h2 { margin:0 auto 0 0; font-size:22px; color:${token.colorText}; }
  `,
  switchLabel: css`display:flex; align-items:center; gap:8px;`,
  summary: css`display:flex; gap:28px; padding:18px 24px; background:${token.colorBgContainer}; border:1px solid ${token.colorBorderSecondary}; border-radius:12px; margin-bottom:16px;
    strong { font-size:24px; display:block; color:${token.colorPrimary}; } span { color:${token.colorTextSecondary}; }
  `,
  board: css`display:flex; flex:1 1 0 !important; gap:18px; align-items:stretch; min-height:0; min-width:0;
    @media(max-width:900px) { flex-direction:column; }
  `,
  pool: css`flex:0 0 300px; min-height:0; background:${token.colorBgContainer}; border:1px solid ${token.colorBorderSecondary}; border-radius:12px; display:flex; flex-direction:column; overflow:hidden;
    > header { flex-shrink:0; padding:16px; border-bottom:1px solid ${token.colorBorderSecondary}; } h3 { margin:0 0 12px; }
    @media(max-width:900px) { flex:0 0 45%; }
  `,
  list: css`overflow:auto; overscroll-behavior:contain; min-height:0; padding:12px; flex:1 1 0;`,
  lanes: css`display:grid; flex:1; min-width:0; min-height:0; gap:14px; overflow:auto; overscroll-behavior:contain; align-content:start; padding-right:8px;
    grid-auto-flow:column; grid-auto-columns:min(292px,100%); grid-template-rows:minmax(0,1fr);
    &[data-wrap=true] {
      grid-auto-flow:row; grid-auto-columns:auto; grid-template-rows:none;
      grid-template-columns:repeat(auto-fill,minmax(min(292px,100%),1fr)); grid-auto-rows:100%;
    }
  `,
  lane: css`min-width:0; min-height:0; overflow:hidden; background:${token.colorFillQuaternary}; border:1px solid ${token.colorBorderSecondary}; border-radius:12px; display:flex; flex-direction:column;
    &[data-located=true] { border-color:${token.colorPrimary}; box-shadow:0 0 0 2px ${token.colorPrimaryBg}; }
    > header { flex-shrink:0; padding:16px; border-bottom:1px solid ${token.colorBorderSecondary}; background:${token.colorBgContainer}; border-radius:12px 12px 0 0; } h3 { margin:0 0 8px; font-size:16px; }
  `,
  card: css`background:${token.colorBgContainer}; border:1px solid ${token.colorBorderSecondary}; border-left:4px solid ${token.colorPrimary}; border-radius:9px; padding:14px; margin-bottom:12px;
    &[data-expanded=false] [data-task-detail] { display:none; }
    &[data-expanded=true] [data-task-summary] { display:none; }
    [data-task-toggle] { float:right; border:0; background:transparent; color:${token.colorTextSecondary}; font-size:12px; cursor:pointer; padding:0 0 4px 8px; }
    &[draggable=true] { cursor:grab; } &:hover { border-color:${token.colorPrimary}; }
    h4 { margin:0 0 7px; font-size:14px; } p { margin:6px 0; color:${token.colorTextSecondary}; font-size:12px; overflow-wrap:anywhere; }
  `,
  numbers: css`display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:12px 0; font-size:12px; color:${token.colorTextSecondary};
    b { display:block; font-size:17px; color:${token.colorText}; margin-top:3px; }
  `,
  quantityLead: css`display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; margin:12px 0 8px; border-radius:7px; border:1px solid #bfdbfe; background:#eff6ff; color:#1d4ed8; font-size:13px; font-weight:600;
    strong { font-size:24px; font-variant-numeric:tabular-nums; } small { font-size:12px; margin-left:4px; }
  `,
  waitingQuantity: css`background:#fff7ed; color:#9a3412 !important; border:1px solid #fdba74; border-radius:7px; padding:8px 10px; font-weight:600;`,
  noWaiting: css`background:${token.colorFillQuaternary}; color:${token.colorTextSecondary} !important; border-color:${token.colorBorderSecondary}; strong { font-size:12px; }`,
  productFields: css`display:grid; grid-template-columns:56px minmax(0,1fr); gap:6px 10px; margin:10px 0; font-size:12px; line-height:1.6;
    dt { color:${token.colorTextSecondary}; } dd { margin:0; color:${token.colorText}; overflow-wrap:anywhere; white-space:pre-wrap; }
  `,
  compactQuantities: css`display:grid; grid-template-columns:1fr 1.5fr; gap:5px; margin-top:10px;
    > div { min-width:0; margin:0; padding:6px; flex-direction:column; align-items:flex-start; gap:3px; font-size:11px; border-radius:5px; }
    > div:first-child { background:${token.colorFillQuaternary}; border-color:${token.colorBorderSecondary}; color:${token.colorText}; }
    strong { font-size:17px; overflow-wrap:anywhere; } small { font-size:10px; margin-left:2px; }
  `,
  actions: css`display:flex; gap:4px; flex-wrap:wrap; margin-top:10px;`,
  laterLink: css`display:block; width:100%; margin-top:12px; padding:10px; text-align:left; cursor:pointer; border:1px solid ${token.colorPrimaryBorder}; border-radius:7px; background:${token.colorPrimaryBg}; color:${token.colorPrimaryText};
    &:hover, &:focus-visible { border-color:${token.colorPrimary}; background:${token.colorPrimaryBgHover}; }
    > span:first-child { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; font-weight:600; }
    > span:last-child { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-top:5px; font-size:11px; line-height:1.6; color:${token.colorTextSecondary}; }
  `,
  hint: css`padding:24px 14px; text-align:center; color:${token.colorTextTertiary}; font-size:13px;`,
  warning: css`color:${token.colorWarningText} !important;`,
  badge: css`font-size:12px; border-radius:4px; padding:3px 7px; background:${token.colorPrimaryBg}; color:${token.colorPrimaryText};`,
  lastStep: css`display:inline-block; font-size:11px; font-weight:600; border-radius:4px; padding:2px 6px; margin-left:6px; background:#ecfdf3; color:#166534; border:1px solid #bbf7d0;`,
  form: css`display:grid; gap:14px; margin:20px 0; label { display:grid; gap:7px; }`,
}));

const number = (value: number | null | undefined) =>
  value == null
    ? '待核对'
    : Number(value.toFixed(4)).toLocaleString('zh-CN', {
        maximumFractionDigits: 4,
      });
const waitingLabel = (
  waiting: number | null,
  total: number,
  unit: string,
  source: Candidate | undefined,
  prefix = '其中',
) => {
  if (waiting == null) return '数量及原因待核对';
  if (waiting === 0) return '无需等待';
  const reason =
    source?.waiting_reason === 'material'
      ? '等领料'
      : source?.waiting_reason === 'upstream'
        ? `等${source.waiting_process_name || '前道'}完工`
        : '原因待核对';
  return `${waiting >= total ? '' : prefix}${number(waiting)}${unit}${reason}`;
};
const identity = (item: Candidate) =>
  `${item.mo_code}/${item.sort_seq}/${item.route_id}/${item.seq}/${item.kind}`;
const status = (t: Task) =>
  t.status === 'cancelled'
    ? '已取消'
    : t.remaining <= 0
      ? t.transferred_qty > 0
        ? '余量已转出'
        : '已完成'
      : (t.actual.done || 0) > 0
        ? '部分完成'
        : '未完成';
const labels: Record<string, string> = {
  create: '新建安排单',
  add: '新增任务',
  edit: '修改任务',
  cancel: '取消任务',
  restore: '恢复任务',
  reorder: '调整顺序',
  publish: '发布任务',
  carry: '转出余量',
  carry_in: '承接余量',
};

export default function DailyTaskDetail({
  sheet,
  onBack,
  focusAssignment,
}: {
  sheet: TaskSheet;
  onBack: () => void;
  focusAssignment?: number;
}) {
  const { styles } = useStyles();
  const { message, modal } = App.useApp();
  const access = useAccess();
  const { initialState } = useModel('@@initialState');
  const user = initialState?.currentUser;
  const owner = user?.adminAccountId
    ? `account:${user.adminAccountId}`
    : user?.username
      ? `user:${user.username}`
      : '';
  const hasManagePermission =
    access.can('daily-tasks.manage') && Boolean(owner);
  const date = sheet.work_date;
  const [today, setToday] = useState(businessToday);
  useEffect(() => {
    const updateToday = () => setToday(businessToday());
    const timer = window.setInterval(updateToday, 60000);
    window.addEventListener('focus', updateToday);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', updateToday);
    };
  }, []);
  const [dept, setDept] = useState('');
  const [data, setData] = useState<DailyData>();
  const selectedSheet = data?.sheet || sheet;
  const [clock, setClock] = useState(Date.now);
  const clockAnchor = useRef({ server: Date.now(), local: Date.now() });
  useEffect(() => {
    const serverTime = businessTime(selectedSheet.server_time);
    clockAnchor.current = {
      server: Number.isNaN(serverTime) ? Date.now() : serverTime,
      local: Date.now(),
    };
    const tick = () =>
      setClock((previous) => {
        const next =
          clockAnchor.current.server + Date.now() - clockAnchor.current.local;
        const before = sheetLocks(selectedSheet, previous);
        const after = sheetLocks(selectedSheet, next);
        return before.plan === after.plan && before.result === after.result
          ? previous
          : next;
      });
    tick();
    const timer = window.setInterval(tick, 1000);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, [
    selectedSheet.server_time,
    selectedSheet.plan_cutoff,
    selectedSheet.result_cutoff,
    selectedSheet.arrangement_locked,
    selectedSheet.result_locked,
  ]);
  const locks = sheetLocks(selectedSheet, clock);
  const locked = locks.plan || locks.result;
  const canManage = hasManagePermission && !locked;
  const local = useLocalDraft(owner, date, draftScope(sheet));
  const draft = locked ? undefined : local.draft;
  const [stationIds, setStationIds] = useState<number[]>([]);
  const [hideEmptyStations, setHideEmptyStations] = useState(false);
  const [wrapStations, setWrapStations] = useState(false);
  const [location, setLocation] = useState<{ id: number; request: number }>();
  const laneRefs = useRef(new Map<number, HTMLElement>());
  const [search, setSearch] = useState('');
  const [laterOrder, setLaterOrder] = useState<Candidate>();
  const [startDateRange, setStartDateRange] = useState<StartDateRange>('1');
  const [busy, setBusy] = useState(false);
  const [saveReview, setSaveReview] = useState<{
    draft: LocalDraft;
    changes: DraftChange[];
    publish: boolean;
    onlyNonorder: boolean;
    workOrderPublishCount: number;
  }>();
  const [bulk, setBulk] = useState<{
    source: Candidate;
    stations: Record<string, number>;
  }>();
  const saveInFlight = useRef(false);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [printing, setPrinting] = useState(false);
  const [tab, setTab] = useState('arrange');
  const [taskType, setTaskType] = useState(focusAssignment ? 'nonorder' : 'all');
  const [creationEditor, setCreationEditor] = useState<{ initial?: NonorderCreation }>();
  const [workEditor, setWorkEditor] = useState<NonorderEdit>();
  const [focusedPerson, setFocusedPerson] = useState(focusAssignment);
  const pageRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page || tab !== 'arrange') return;
    const resize = () => {
      let bottomSpace = 0;
      for (
        let parent = page.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        const style = window.getComputedStyle(parent);
        bottomSpace +=
          (Number.parseFloat(style.paddingBottom) || 0) +
          (Number.parseFloat(style.marginBottom) || 0);
      }
      const top = page.getBoundingClientRect().top + window.scrollY;
      page.style.setProperty(
        '--daily-task-height',
        `${Math.max(0, window.innerHeight - top - bottomSpace)}px`,
      );
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (page.parentElement) observer.observe(page.parentElement);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      page.style.removeProperty('--daily-task-height');
    };
  }, [tab]);
  useEffect(() => {
    if (locks.result) setTab('check');
  }, [locks.result]);
  const [filter, setFilter] = useState('all');
  const [dialog, setDialog] = useState<{
    source: Candidate;
    task?: Task;
  }>();
  useEffect(() => {
    if (locked) {
      setDialog(undefined);
      setSaveReview(undefined);
      setBulk(undefined);
    }
  }, [locked]);
  const [quantity, setQuantity] = useState<number | null>(null);
  const [station, setStation] = useState<number>();
  const [remark, setRemark] = useState('');
  const drag = useRef<{ candidate?: Candidate; task?: Task } | undefined>(
    undefined,
  );
  const requestId = useRef(0);
  const autoRefreshing = useRef(false);
  useEffect(() => {
    if (
      !data ||
      tab !== 'arrange' ||
      !location ||
      (stationIds.length && !stationIds.includes(location.id))
    )
      return;
    laneRefs.current.get(location.id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [location, stationIds, tab, data, wrapStations]);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setBusy(true);
    setError('');
    try {
      const result = await getTasks(date, false, sheet.id || undefined);
      if (id !== requestId.current) return;
      setData(result);
      setRefreshError('');
    } catch (e) {
      if (id === requestId.current)
        setError(e instanceof Error ? e.message : '读取失败，请刷新');
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }, [date, sheet.id]);
  useEffect(() => {
    void load();
    return () => {
      ++requestId.current;
    };
  }, [load]);
  const previousLocks = useRef(locks);
  useEffect(() => {
    const crossed =
      (!previousLocks.current.plan && locks.plan) ||
      (!previousLocks.current.result && locks.result);
    previousLocks.current = locks;
    if (crossed) void load();
  }, [locks.plan, locks.result, load]);
  useEffect(() => {
    if (busy || (locks.result && !!data?.sheet?.result_frozen_at)) return;
    let disposed = false;
    const refresh = async () => {
      if (document.hidden || drag.current || autoRefreshing.current) return;
      autoRefreshing.current = true;
      const id = ++requestId.current;
      try {
        const result = await getTasks(date, true, sheet.id || undefined);
        if (disposed || id !== requestId.current || drag.current) return;
        // The draft and open editor remain untouched; previewDraft overlays local work.
        setData(result);
        setRefreshError('');
      } catch {
        if (!disposed && id === requestId.current)
          setRefreshError('现场数据自动刷新失败，已保留当前内容，将自动重试。');
      } finally {
        autoRefreshing.current = false;
      }
    };
    const timer = window.setInterval(() => void refresh(), 30000);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [busy, date, sheet.id, locks.result, data?.sheet?.result_frozen_at]);
  const server = data?.date === date ? data : undefined;
  useEffect(() => {
    if (
      !server ||
      !local.ready ||
      draft ||
      !owner ||
      locked ||
      sheet.sheet_kind === 'supplement'
    )
      return;
    const legacy = readDraftSheets(owner).drafts.filter(
      (d) => d.date === date && !d.allDepartments,
    );
    if (legacy.length) {
      try {
        local.write(createSheetDraft(server, owner, legacy));
      } catch (e) {
        setError(e instanceof Error ? e.message : '原草稿读取失败');
      }
    }
  }, [server, local, owner, date, draft, locked, sheet.sheet_kind]);
  const current =
    server && !locked && tab === 'arrange'
      ? previewDraft(server, draft)
      : server;
  const savedWorkOrders = server?.items.filter((t) => t.status === 'active') || [];
  const savedNonorder = server?.nonorder?.items.filter((row) => !row.cancelled_at) || [];
  const published = savedWorkOrders.length + savedNonorder.length > 0 &&
    savedWorkOrders.every((row) => row.header_status === 'published') &&
    savedNonorder.every((row) => row.status === 'published');
  const conflict = !!server && sheetHasConflict(server, draft);
  const tasks =
    current?.items.filter((t) => !dept || t.dept_name === dept) || [];
  const active = tasks.filter((t) => t.status === 'active');
  const publicationItems = (draft?.items || server?.items || []).filter(
    (t) => t.status === 'active',
  );
  const candidates =
    current?.candidates.filter(
      (c) =>
        (!dept || c.dept_name === dept) &&
        (!stationIds.length ||
          c.allowed_station_ids.some((id) => stationIds.includes(id))) &&
        `${c.mo_code} ${c.inv_name} ${c.inv_code} ${c.process_name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) || [];
  const relevantIds = new Set([
    ...(current?.candidates
      .filter((c) => !dept || c.dept_name === dept)
      .flatMap((c) => c.allowed_station_ids) || []),
    ...tasks.map((t) => t.station_id),
  ]);
  const candidateGroups = groupCandidatesForDisplay(
    candidates,
    current?.candidates || [],
    today,
    startDateRange,
  );
  const laterRows = laterOrder
    ? candidateGroups
        .flatMap((group) => group.orders)
        .filter((order) => order.key === candidateOrderKey(laterOrder))
        .flatMap((order) => order.later)
        .sort((a, b) => a.seq - b.seq)
    : [];
  const candidateCount = candidateGroups.reduce(
    (sum, group) => sum + group.orders.length,
    0,
  );
  const candidateWindow = candidateDateWindow(today, startDateRange);
  const showNonorder = !!server?.nonorder && taskType !== 'workorder';
  const showNonorderPool = showNonorder && taskType === 'nonorder';
  const showWorkOrders = !server?.nonorder || taskType !== 'nonorder';
  const nonorderRows = arrangementRows(server?.nonorder?.items, tab === 'arrange' ? draft?.nonorder : undefined,
    server?.nonorder?.candidates);
  const nonorderCandidates = (server?.nonorder?.candidates || [])
    .filter((row) => !focusedPerson || row.assignment.id === focusedPerson)
    .filter((row) => row.group.type !== 'station' || !stationIds.length || stationIds.includes(Number(row.group.id)))
    .filter((row) => row.started || !candidateWindow || !row.division.planned_date || row.division.planned_date <= candidateWindow.end)
    .filter((row) => `${row.task.content} ${row.division.content} ${row.assignment.staff_name} ${row.assignment.responsibility} ${row.group.name}`.toLowerCase().includes(search.toLowerCase()))
    .map((row) => draft?.nonorder?.some((edit) => edit.person.assignment.id === row.assignment.id)
      ? { ...row, occupied: true } : row);
  const groups = laneGroups(nonorderRows, showNonorderPool ? nonorderCandidates : []);
  const canEditNonorder = canManage && local.ready && !busy && !conflict;
  const canCreateNonorder = canEditNonorder && !!server?.nonorder?.supports_sheet_creation &&
    access.can('nonorder.manage') && access.can('nonorder.publish');
  const staged = (tab === 'arrange' ? draft?.nonorderCreations || [] : []).flatMap((entry) =>
    entry.task.divisions.map((division, index) => {
      const group = division.station_id
        ? { type: 'station' as const, id: division.station_id, name: division.station_name || `工站${division.station_id}` }
        : { type: 'leader' as const, id: entry.task.responsible_staff_id, name: entry.responsible_name };
      const key = `${group.type}:${group.id}`;
      groups.set(key, group);
      return { entry, division, key, id: `${entry.request_id}:${index}` };
    }),
  );
  const canPublishNonorder = savedNonorder.some((row) => row.can_plan && row.can_publish && row.status === 'draft') ||
    !!draft?.nonorder?.some((row) => row.action !== 'cancel' && (row.plan?.can_publish ?? true)) ||
    (canCreateNonorder && !!draft?.nonorderCreations?.length);
  const canPublishWorkOrders = publicationItems.some((row) => row.header_status !== 'published') ||
    (!!draft && publicationItems.length > 0 && !!server && draftChanges(server, draft).length > 0);
  if (showNonorder) {
    for (const group of groups.values()) {
      if (group.type === 'station') relevantIds.add(Number(group.id));
    }
  }
  const stations = (current?.stations || []).filter((s) =>
    relevantIds.has(s.id),
  );
  const visibleStations = stations.filter(
    (s) =>
      (showWorkOrders || groups.has(`station:${s.id}`)) &&
      (!hideEmptyStations ||
        location?.id === s.id ||
        (showWorkOrders && active.some((task) => task.station_id === s.id)) ||
        (showNonorder && (staged.some((row) => row.key === `station:${s.id}`) ||
          nonorderRows.some((row) => groupKey(row.person) === `station:${s.id}` &&
            row.action !== 'cancel' && row.plan?.status !== 'cancelled')))) &&
      (!stationIds.length ||
        stationIds.includes(s.id) ||
        laterRows.some((row) => row.allowed_station_ids.includes(s.id))),
  );
  const stationName = (id: number) =>
    current?.stations.find((s) => s.id === id)?.station_name || `工站${id}`;
  const locateStation = (id: number) => {
    setStationIds((ids) =>
      ids.length && !ids.includes(id) ? [...ids, id] : ids,
    );
    setLocation((previous) => ({
      id,
      request: (previous?.request || 0) + 1,
    }));
  };
  const editNonorder = (edits: NonorderEdit[], remove?: number) => {
    if (!server || !canEditNonorder) return;
    try {
      const base = draft || createSheetDraft(server, owner);
      const byPerson = new Map(base.nonorder?.map((edit) => [edit.person.assignment.id, edit]));
      if (remove !== undefined) byPerson.delete(remove);
      for (const edit of edits) byPerson.set(edit.person.assignment.id, edit);
      local.write({ ...base, nonorder: [...byPerson.values()], stamp: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '本地修改失败');
    }
  };
  const stageCreation = (entry: NonorderCreation, remove = false) => {
    if (!server || !canCreateNonorder) throw new Error('当前安排单无法修改');
    const base = draft || createSheetDraft(server, owner);
    const entries = new Map(base.nonorderCreations?.map((row) => [row.request_id, row]));
    if (remove) entries.delete(entry.request_id);
    else entries.set(entry.request_id, entry);
    local.write({
      ...base, nonorderCreations: [...entries.values()],
      stamp: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
    if (!remove) {
      if (taskType === 'workorder') setTaskType('all');
      setTab('arrange');
      setStationIds([]);
    }
  };
  const addNonorder = (people: NonorderCandidate[]) => {
    const positions = new Map<string, number>();
    for (const row of nonorderRows) {
      const key = groupKey(row.person);
      positions.set(key, Math.max(positions.get(key) || 0, row.sort_order));
    }
    const edits = people.filter((person) => person.can_plan && !person.occupied).map((person) => {
      const key = groupKey(person);
      const sort_order = (positions.get(key) || 0) + 1;
      positions.set(key, sort_order);
      return { person, action: 'add' as const, remark: '', sort_order };
    });
    if (edits.length) editNonorder(edits);
  };
  const dropNonorder = (event: React.DragEvent, key: string) => {
    if (!event.dataTransfer.types.includes(PERSON_DRAG)) return;
    const raw = event.dataTransfer.getData(PERSON_DRAG);
    if (!/^\[\d+(,\d+)*\]$/.test(raw)) return;
    const ids: number[] = JSON.parse(raw);
    const people = nonorderCandidates.filter((row) => ids.includes(row.assignment.id) && groupKey(row) === key && !row.occupied);
    if (people.length) addNonorder(people);
    else message.warning('请选择该工站或负责线长下的人员');
  };
  const moveNonorder = (key: string, id: number, before: number) => {
    const rows = nonorderRows.filter((row) => groupKey(row.person) === key && row.person.can_plan &&
      (row.action === 'update' || row.action === 'add') && row.plan?.status !== 'cancelled' && (row.plan?.can_publish ?? true));
    const moving = rows.find((row) => row.person.assignment.id === id);
    if (!moving || id === before) return;
    const next = rows.filter((row) => row !== moving);
    const target = next.findIndex((row) => row.person.assignment.id === before);
    if (target < 0) return;
    next.splice(target, 0, moving);
    const edits = next.map((row, index) => ({ ...row, sort_order: rows[0].sort_order + index }))
      .filter((row, index) => row.sort_order !== next[index].sort_order);
    if (edits.length) editNonorder(edits);
  };
  const renderNonorderLane = (key: string) => (
    <>
      <NonorderLane group={key} rows={nonorderRows.filter((row) => groupKey(row.person) === key)}
        canEdit={canEditNonorder} save={editNonorder} move={moveNonorder} drop={dropNonorder}
        undo={(id) => editNonorder([], id)} empty={!locked && !staged.some((row) => row.key === key)}
        onEdit={(row) => {
          if (row.person.can_edit_work) setWorkEditor(row);
          else if (row.person.assignment.status === 'done') message.info('该人员已完成核对，原记录已保留');
          else if (['pending', 'materials'].includes(row.person.assignment.status)) message.info('该人员已提交，请在执行核对中处理');
          else if (row.person.can_edit_work === undefined) message.info('当前服务未返回修改权限，请刷新后重试');
          else message.info('当前人员分工不可修改');
        }} />
      {staged.filter((row) => row.key === key).map(({ entry, division, id }) => (
        <NonorderCard key={id} workItem={division.content}
          onDoubleClick={canCreateNonorder ? (event) => {
            if (!(event.target as HTMLElement).closest('button')) setCreationEditor({ initial: entry });
          } : undefined}>
          {division.members.map((person) => (
            <div key={person.staff_id}>{person.staff_name} · {person.responsibility}</div>
          ))}
          <p>{entry.task.content} · 本地草稿</p>
          {canCreateNonorder && <div className={styles.toolbar}>
            <Button size="small" onClick={() => setCreationEditor({ initial: entry })}>修改</Button>
            <Button size="small" onClick={() => {
              try { stageCreation(entry, true); }
              catch (failure) { message.error(failure instanceof Error ? failure.message : '移除草稿失败'); }
            }}>移除草稿</Button>
          </div>}
        </NonorderCard>
      ))}
    </>
  );
  const requestSave = (publish = false) => {
    if (!server || !canManage || !local.ready || busy || conflict) return;
    if (!draft && !publish) return;
    try {
      if (draft) local.assertCurrent();
      const pending: LocalDraft = JSON.parse(
        JSON.stringify(draft || createSheetDraft(server, owner)),
      );
      pending.nonorder = editsToSave(server, pending.nonorder, publish);
      const changes = draftChanges(server, pending);
      const workOrderPublishCount = publish ? publicationItems.filter((item) => item.header_status !== 'published').length : 0;
      setError('');
      setSaveReview({
        draft: pending,
        changes,
        publish,
        onlyNonorder: !!(pending.nonorder.length || pending.nonorderCreations?.length) && !changes.length && !workOrderPublishCount,
        workOrderPublishCount,
      });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '草稿读取失败');
    }
  };
  const saveServer = async () => {
    if (
      !saveReview ||
      !server ||
      !canManage ||
      !local.ready ||
      busy ||
      saveInFlight.current
    )
      return;
    const { draft: reviewed, publish } = saveReview;
    saveInFlight.current = true;
    ++requestId.current;
    setBusy(true);
    setError('');
    let saved = false;
    try {
      if (draft) local.assertCurrent();
      if (
        (draft?.stamp || '') !== reviewed.stamp ||
        sheetHasConflict(server, reviewed)
      )
        throw new Error('任务已变化，请返回修改后重新核对保存清单');
      const result = await saveTask(
        sheetBatchPayload(
          {
            ...reviewed,
            sheet_id: sheet.id || undefined,
          },
          publish,
          saveReview.onlyNonorder,
        ),
      );
      if (reviewed.nonorderCreations?.length && !result.nonorder?.supports_sheet_creation)
        throw new Error('服务器尚未支持单内新增无工单，草稿已保留');
      saved = true;
      setSaveReview(undefined);
      setData(result);
      setRefreshError('');
      if (draft) local.discard();
      setDialog(undefined);
      message.success(publish ? '已保存并发布' : '已保存到服务器');
    } catch (e) {
      setError(
        `${saved ? '服务器已保存，本地草稿清理未完成：' : ''}${e instanceof Error ? e.message : '保存失败，本地草稿已保留'}`,
      );
    } finally {
      saveInFlight.current = false;
      setBusy(false);
    }
  };
  const mutate = async (body: Record<string, unknown>) => {
    if (!server || !canManage || !local.ready || busy) return;
    try {
      const base = draft || createSheetDraft(server, owner);
      local.write(editDraft(base, server, body));
      setDialog(undefined);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '本地修改失败');
    }
  };
  const arrange = (
    source: Candidate,
    stationId: number,
    includeWaiting = false,
  ) => {
    if (!canManage || busy) return;
    if (!source.allowed_station_ids.includes(stationId)) {
      message.warning('此工序不能安排到这个工站');
      return;
    }
    void mutate({
      action: 'add',
      mo_code: source.mo_code,
      sort_seq: source.sort_seq,
      route_id: source.route_id,
      seq: source.seq,
      kind: source.kind,
      station_id: stationId,
      auto_quantity: true,
      include_waiting: includeWaiting,
    });
  };
  const applyBulk = (source: Candidate, stations: Record<string, number>) => {
    if (!server || !canManage || !local.ready || busy) return;
    try {
      const result = arrangeRoute(
        draft || createSheetDraft(server, owner),
        server,
        source,
        stations,
      );
      local.write(result.draft);
      setBulk(undefined);
      message.success(`已暂存 ${result.count} 道工序，保存时统一核对`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '一键安排失败');
    }
  };
  const startBulk = (source: Candidate) => {
    if (!current || !canManage || !local.ready || busy) return;
    const rows = routeCandidates(current, source);
    const invalid = rows.find(
      (row) => !row.allowed_station_ids.length || availableNow(row) == null,
    );
    if (invalid) {
      message.warning(
        `${invalid.seq}. ${invalid.process_name}：工站或数量待核对，请先单独处理`,
      );
      return;
    }
    const stations = Object.fromEntries(
      rows
        .filter((row) => row.allowed_station_ids.length === 1)
        .map((row) => [identity(row), row.allowed_station_ids[0]]),
    );
    if (rows.some((row) => row.allowed_station_ids.length > 1))
      setBulk({ source, stations });
    else applyBulk(source, stations);
  };
  const bulkRows = current && bulk ? routeCandidates(current, bulk.source) : [];
  const openTask = (task: Task) => {
    setDialog({ source: task, task });
    setStation(task.station_id);
    setQuantity(task.quantity);
    setRemark(task.remark);
  };
  const reorder = (task: Task, targetId?: number, offset?: number) => {
    const lane = active
      .filter((t) => t.station_id === task.station_id)
      .map((t) => t.id);
    const from = lane.indexOf(task.id);
    const to =
      offset != null
        ? from + offset
        : targetId
          ? lane.indexOf(targetId)
          : lane.length - 1;
    if (to < 0 || to >= lane.length || to === from) return;
    lane.splice(from, 1);
    lane.splice(to, 0, task.id);
    void mutate({ action: 'reorder', station_id: task.station_id, ids: lane });
  };
  const drop = (stationId: number, targetId?: number) => {
    if (!canManage || busy) return;
    const value = drag.current;
    drag.current = undefined;
    if (value?.candidate) {
      arrange(value.candidate, stationId, availableNow(value.candidate) === 0);
    } else if (value?.task) {
      if (value.task.station_id !== stationId) {
        message.warning('已有任务只能在本工站调整顺序');
        return;
      }
      reorder(value.task, targetId);
    }
  };
  const reconciliation = tasks.filter(
    (t) =>
      filter === 'all' ||
      (filter === 'unfinished'
        ? t.remaining > 0
        : filter === 'over'
          ? t.difference > 0
          : t.status === 'cancelled'),
  );
  const checks = (
    <Table<Task>
      rowKey="id"
      dataSource={reconciliation}
      pagination={false}
      size="small"
      scroll={{ x: 1700 }}
      columns={[
        {
          title: '工站',
          dataIndex: 'station_id',
          width: 120,
          render: stationName,
        },
        {
          title: '工单 / 行',
          width: 170,
          render: (_, t) => `${t.mo_code} · ${t.sort_seq}`,
        },
        { title: '产品', dataIndex: 'inv_name', width: 180 },
        { title: '生产部门', dataIndex: 'dept_name', width: 120 },
        {
          title: '工序',
          width: 130,
          render: (_, t) =>
            `${t.seq}. ${t.process_name}${t.kind === 'rework' ? '（返工）' : ''}`,
        },
        { title: '单位', dataIndex: 'unit_name', width: 70 },
        { title: '安排', dataIndex: 'quantity', render: number, width: 80 },
        {
          title: '接收流水',
          render: (_, t) => number(t.actual.received || 0),
          width: 90,
        },
        ...(['qty_a', 'qty_a1', 'qty_a2', 'qty_c'] as const).map((f, i) => ({
          title: ['A', 'A1', 'A2', 'C'][i],
          width: 70,
          render: (_: unknown, t: Task) => number(t.actual[f] || 0),
        })),
        {
          title: '完工合计',
          render: (_, t) => number(t.actual.done || 0),
          width: 90,
        },
        {
          title: '差额',
          render: (_, t) => (
            <strong
              style={{
                color:
                  t.difference < 0
                    ? '#b54708'
                    : t.difference > 0
                      ? '#1677ff'
                      : '#237804',
              }}
            >
              {number(t.difference)}
            </strong>
          ),
          width: 80,
        },
        {
          title: '转出',
          dataIndex: 'transferred_qty',
          render: number,
          width: 70,
        },
        { title: '未完成', dataIndex: 'remaining', render: number, width: 80 },
        {
          title: '状态',
          render: (_, t) => (
            <span>
              {status(t)}
              {t.header_status === 'draft' ? ' · 草稿' : ''}
              {t.issue && <p className={styles.warning}>{t.issue}</p>}
            </span>
          ),
          width: 150,
        },
        { title: '备注', dataIndex: 'remark', width: 160 },
      ]}
    />
  );
  const renderLaterLink = (source: Candidate, rows: Candidate[]) => (
    <button
      type="button"
      className={styles.laterLink}
      aria-label={`${source.mo_code}第${source.sort_seq}行后续工序`}
      title={rows.map((row) => `${row.seq}. ${row.process_name}`).join(' → ')}
      draggable={false}
      onFocus={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        setLaterOrder(source);
      }}
    >
      <span>
        <span>后续待安排 · {rows.length} 道</span>
        <span>查看 ›</span>
      </span>
      <span>
        {rows.map((row) => `${row.seq}. ${row.process_name}`).join(' → ')}
      </span>
    </button>
  );
  const renderCandidate = (c: Candidate, later: Candidate[] = []) => (
    <TaskCard
      detailTitle={`${c.mo_code} · 第${c.sort_seq}行`}
      detailSubtitle={`${c.seq}. ${c.process_name}${c.kind === 'rework' ? ' · 返工' : ''}`}
      aria-label={`${c.mo_code}第${c.sort_seq}行待安排`}
      key={identity(c)}
      className={styles.card}
      draggable={
        canManage &&
        !busy &&
        local.ready &&
        c.ready != null &&
        c.unassigned > 0 &&
        c.allowed_station_ids.length > 0
      }
      onDragStart={(e) => {
        drag.current = { candidate: c };
        e.dataTransfer.setData('text/plain', identity(c));
      }}
      onDragEnd={() => {
        drag.current = undefined;
      }}
    >
      <h4>
        {c.mo_code} · 第{c.sort_seq}行
      </h4>
      <p data-task-detail>{c.dept_name}</p>
      <span className={styles.badge}>
        {c.seq}. {c.process_name}
        {c.kind === 'rework' ? ' · 返工' : ''}
      </span>
      {c.is_last_step === true && (
        <span className={styles.lastStep}>末工序</span>
      )}
      <p
        className={c.allowed_station_ids.length ? undefined : styles.warning}
        style={{
          margin: '4px 0 0',
          lineHeight: '18px',
        }}
      >
        工站：
        {c.allowed_station_ids.length
          ? c.allowed_station_ids.map((id, index) => (
              <span key={id}>
                {index > 0 && '、'}
                <Button
                  type="link"
                  size="small"
                  aria-label={`定位到${stationName(id)}`}
                  style={{
                    padding: 0,
                    height: 'auto',
                    fontSize: 'inherit',
                    lineHeight: 'inherit',
                    whiteSpace: 'normal',
                    textAlign: 'left',
                  }}
                  onFocus={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    locateStation(id);
                  }}
                >
                  {stationName(id)}
                </Button>
              </span>
            ))
          : '未配置可用工站'}
      </p>
      <section
        data-task-summary
        className={styles.compactQuantities}
        aria-label="待安排关键数量"
      >
        <div className={styles.quantityLead}>
          <span>{availableNow(c) === 0 ? '本次预安排' : '本次安排'}</span>
          <span>
            <strong>
              {number(availableNow(c) === 0 ? c.unassigned : availableNow(c))}
            </strong>
            <small>{c.unit_name}</small>
          </span>
        </div>
        <div
          className={`${styles.quantityLead} ${(waitingToArrange(c) || 0) > 0 ? styles.waitingQuantity : styles.noWaiting}`}
        >
          <span>生产条件</span>
          <strong style={{ fontSize: 12 }}>
            {waitingLabel(
              waitingToArrange(c),
              c.unassigned,
              c.unit_name,
              c,
              '另有',
            )}
          </strong>
        </div>
      </section>
      <dl data-task-detail className={styles.productFields}>
        <dt>产品料号</dt>
        <dd>{c.inv_code || '—'}</dd>
        <dt>产品名称</dt>
        <dd>{c.inv_name || '—'}</dd>
        <dt>规格型号</dt>
        <dd>{c.inv_std || '—'}</dd>
      </dl>
      <p data-task-detail>
        {c.plan_start_date
          ? `计划开工 ${c.plan_start_date.slice(0, 10)}`
          : '未维护计划开工'}
      </p>
      <div
        data-task-detail
        className={`${styles.quantityLead} ${availableNow(c) === 0 ? styles.waitingQuantity : ''}`}
      >
        <span>{availableNow(c) === 0 ? '本次预安排' : '本次安排'}</span>
        <span>
          <strong>
            {number(availableNow(c) === 0 ? c.unassigned : availableNow(c))}
          </strong>
          <small>{c.unit_name}</small>
        </span>
      </div>
      <p data-task-detail>
        未安排总量 {number(c.unassigned)}
        {c.unit_name}
      </p>
      <p data-task-detail>
        已接收待做 {number(c.received_remaining)} · 可接收{' '}
        {number(c.receivable)}
      </p>
      <p
        data-task-detail
        className={
          waitingToArrange(c) === 0
            ? styles.noWaiting
            : availableNow(c) != null && c.unassigned > (availableNow(c) || 0)
              ? styles.waitingQuantity
              : undefined
        }
      >
        {waitingLabel(
          waitingToArrange(c),
          c.unassigned,
          c.unit_name,
          c,
          '另有',
        )}
      </p>
      {c.reserved > 0 && (
        <p data-task-detail>
          已安排未完成 {number(c.reserved)}
          {c.unit_name}
        </p>
      )}
      {!!c.reservations.length && (
        <details data-task-detail>
          <summary>查看已有安排</summary>
          {c.reservations.map((r) => (
            <p key={r.id}>
              {r.date} · 剩余{number(r.quantity)}
              {c.unit_name}
            </p>
          ))}
        </details>
      )}
      <div data-task-detail className={styles.actions}>
        {canManage &&
          (c.allowed_station_ids.length > 1 ? (
            <Dropdown
              trigger={['click']}
              disabled={
                busy || !local.ready || c.ready == null || c.unassigned <= 0
              }
              menu={{
                items: c.allowed_station_ids.map((id) => ({
                  key: String(id),
                  label: stationName(id),
                })),
                onClick: ({ key }) =>
                  arrange(c, Number(key), availableNow(c) === 0),
              }}
            >
              <Button
                size="small"
                disabled={
                  busy || !local.ready || c.ready == null || c.unassigned <= 0
                }
              >
                {availableNow(c) === 0 ? '预安排到工站' : '安排到工站'}
              </Button>
            </Dropdown>
          ) : (
            <Button
              size="small"
              disabled={
                busy ||
                !local.ready ||
                !c.allowed_station_ids.length ||
                c.ready == null ||
                c.unassigned <= 0
              }
              onClick={() =>
                arrange(c, c.allowed_station_ids[0], availableNow(c) === 0)
              }
            >
              {availableNow(c) === 0 ? '预安排到工站' : '安排到工站'}
            </Button>
          ))}
        {canManage && c.kind === 'normal' && (
          <Button
            size="small"
            disabled={busy || !local.ready}
            onClick={() => startBulk(c)}
          >
            一键安排
          </Button>
        )}
      </div>
      {!!later.length && renderLaterLink(c, later)}
      {!later.length && followupHint(c, current?.candidates || []) && (
        <p style={{ margin: '10px 0 0' }}>
          {followupHint(c, current?.candidates || [])}
        </p>
      )}
    </TaskCard>
  );
  return (
    <main
      ref={pageRef}
      className={styles.root}
      data-arrange={tab === 'arrange'}
    >
      <div className={`${styles.toolbar} no-print`}>
        <Button
          disabled={busy || (!!draft && !!local.warning)}
          onClick={onBack}
        >
          返回列表
        </Button>
        <h2>
          {date} · {sheetLabel(sheet)}
        </h2>
        <Button loading={busy} onClick={() => void load()}>
          刷新
        </Button>
        {canManage && (
          <>
            <Button
              type="primary"
              loading={busy}
              disabled={!draft || !server || !local.ready || conflict}
              onClick={() => requestSave()}
            >
              保存到服务器
            </Button>
            <Button
              disabled={busy || (!draft && !local.warning)}
              onClick={() =>
                modal.confirm({
                  title: '放弃本地修改？',
                  content: '恢复服务器上的安排。',
                  onOk: async () => {
                    try {
                      local.discard();
                      setError('');
                      await load();
                    } catch (e) {
                      message.error(
                        e instanceof Error ? e.message : '清理失败',
                      );
                    }
                  },
                })
              }
            >
              放弃本地修改
            </Button>
          </>
        )}
        <Button
          disabled={!current || busy || !!draft}
          title="按执行日期导出主单和补充安排"
          onClick={() => {
            if (!server?.supports_day_export) {
              message.info('后台重启后可按执行日期导出');
              return;
            }
            void exportTasks(date).catch(() =>
              message.error('导出失败'),
            );
          }}
        >
          导出 Excel
        </Button>
        <Button
          disabled={!server || busy || !!draft}
          loading={printing}
          title="按执行日期打印主单和补充安排"
          onClick={() => {
            if (!server?.supports_day_print) {
              message.info('后台重启后可按执行日期打印');
              return;
            }
            setPrinting(true);
            void printTasks(() => getPrintTasks(date))
              .then((opened) => { if (!opened) message.warning('请允许打开打印窗口'); })
              .catch((failure) => message.error(failure instanceof Error ? failure.message : '打印任务读取失败'))
              .finally(() => setPrinting(false));
          }}
        >
          打印任务单
        </Button>
        {canManage && (
          <Button
            disabled={
              busy ||
              !local.ready ||
              conflict ||
              (!canPublishWorkOrders && !canPublishNonorder)
            }
            onClick={() => requestSave(true)}
          >
            {draft ? '保存并发布' : published ? '已发布' : '发布任务'}
          </Button>
        )}
      </div>
      {creationEditor && <NonorderPublish day={date} initial={creationEditor.initial}
        onClose={() => setCreationEditor(undefined)} onAdd={stageCreation} />}
      {workEditor && <NonorderWorkEditor row={workEditor} onClose={() => setWorkEditor(undefined)}
        onSave={(row) => { editNonorder([row]); setWorkEditor(undefined); }} />}
      {locked && (
        <Alert
          type="info"
          showIcon
          title={
            locks.result
              ? '安排与结果已锁定'
              : '安排已锁定，临时新增请返回列表创建补充安排'
          }
          description={
            selectedSheet.legacy_import
              ? '历史补存，以实际快照生成时间的数据为准。'
              : local.draft
                ? '未保存草稿未计入，当前展示服务器内容。'
                : undefined
          }
        />
      )}
      {error && <Alert type="error" title={error} showIcon />}
      {refreshError && !error && (
        <Alert type="warning" title={refreshError} showIcon />
      )}
      {local.warning && <Alert type="warning" title={local.warning} showIcon />}
      {draft && (conflict || tab !== 'arrange') && (
        <Alert
          type={conflict ? 'warning' : 'info'}
          showIcon
          title={
            conflict
              ? '服务器任务已变化，本地草稿保留中，请核对后再处理。'
              : '本地修改尚未保存'
          }
          description={
            tab === 'arrange' ? undefined : '执行核对和调整记录展示服务器数据。'
          }
        />
      )}
      {!error && !current && (
        <div className={styles.hint}>正在读取任务与现场报工…</div>
      )}
      {current && (
        <>
          <div className={styles.summary}>
            <span>
              <strong>{active.length}</strong>工单安排
            </span>
            {!!server?.nonorder && <span><strong>{nonorderRows.filter((row) => row.action !== 'cancel' && row.plan?.status !== 'cancelled').length +
              staged.reduce((count, row) => count + row.division.members.length, 0)}</strong>无工单人员安排</span>}
            <span>
              <strong>{active.filter((t) => t.remaining > 0).length}</strong>
              未完成任务
            </span>
            <span>
              <strong>{active.filter((t) => t.difference > 0).length}</strong>
              超额完成
            </span>

            <span style={{ marginLeft: 'auto', fontSize: 12 }}>
              报工更新于 {current.generated_at.slice(11)}
              <br />
              {locks.result
                ? `结果快照：${selectedSheet.result_frozen_at || '生成中'}`
                : locked
                  ? '安排已锁定 · 实绩更新中'
                  : published
                    ? '已发布 · 当天可调整'
                    : '草稿 · 当天可调整'}
            </span>
          </div>
          <Tabs
            className="no-print"
            activeKey={tab}
            onChange={setTab}
            items={[
              { key: 'arrange', label: '任务安排' },
              { key: 'check', label: '执行核对' },
              ...(server?.nonorder ? [{ key: 'nonorder-check', label: '无工单执行核对' }] : []),
              { key: 'history', label: '调整记录' },
            ]}
          />
          {tab === 'arrange' && (
            <>
              <div className={`${styles.toolbar} no-print`}>
                {!!server?.nonorder && <Select aria-label="任务类型" value={taskType} onChange={(value) => { setTaskType(value); setLaterOrder(undefined); setFocusedPerson(undefined); }}
                  options={[{ value: 'all', label: '全部任务' }, { value: 'workorder', label: '工单任务' }, { value: 'nonorder', label: '无工单任务' }]} />}
                {canCreateNonorder && (
                  <Button onClick={() => setCreationEditor({})}>新增无工单安排</Button>
                )}
                {focusedPerson && <Button onClick={() => setFocusedPerson(undefined)}>显示全部人员</Button>}
                {showWorkOrders && <Select
                  aria-label="筛选生产部门"
                  allowClear
                  showSearch={{ optionFilterProp: 'label' }}
                  placeholder="全部部门"
                  value={dept || undefined}
                  style={{ width: 180 }}
                  options={[
                    ...new Set([
                      ...(current?.candidates.map((c) => c.dept_name) || []),
                      ...(current?.items.map((t) => t.dept_name) || []),
                    ]),
                  ]
                    .sort()
                    .map((name) => ({ value: name, label: name }))}
                  onChange={(value) => {
                    setDept(value || '');
                    setStationIds([]);
                    setLocation(undefined);
                  }}
                />}
                <Select
                  mode="multiple"
                  aria-label="显示工站"
                  showSearch={{ optionFilterProp: 'label' }}
                  allowClear
                  placeholder="全部工站，可选择几个集中安排"
                  style={{ minWidth: 360, maxWidth: 750 }}
                  value={stationIds}
                  options={stations.map((s) => ({
                    value: s.id,
                    label: s.station_name,
                  }))}
                  onChange={setStationIds}
                />
                <Select
                  aria-label="定位工站"
                  showSearch={{ optionFilterProp: 'label' }}
                  allowClear
                  placeholder="搜索并定位工站"
                  style={{ width: 220 }}
                  value={location?.id}
                  options={stations.map((s) => ({
                    value: s.id,
                    label: s.station_name,
                  }))}
                  onClear={() => setLocation(undefined)}
                  onSelect={locateStation}
                />
                <span style={{ color: '#667085', fontSize: 12 }}>
                  拖入暂存，双击修改，上下拖动排序
                </span>
                <label
                  htmlFor="daily-task-hide-empty-stations"
                  className={styles.switchLabel}
                >
                  <Switch
                    id="daily-task-hide-empty-stations"
                    size="small"
                    aria-label="隐藏未分配工站"
                    checked={hideEmptyStations}
                    onChange={setHideEmptyStations}
                  />
                  隐藏未分配工站
                </label>
                <label htmlFor="daily-task-wrap-stations" className={styles.switchLabel}>
                  <Switch id="daily-task-wrap-stations" size="small" aria-label="工站换行"
                    checked={wrapStations} onChange={setWrapStations} />
                  工站换行
                </label>
              </div>
              <div className={styles.board}>
                <aside className={styles.pool}>
                  <header>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <h3 style={{ margin: 0 }}>{showNonorderPool ? '待安排无工单' : '待安排工单'}</h3>
                      <Select
                        aria-label={showNonorderPool ? '分工计划日期范围' : '计划开工日期范围'}
                        size="small"
                        style={{ width: 96 }}
                        value={startDateRange}
                        onChange={setStartDateRange}
                        options={[
                          { value: '1', label: '近1天' },
                          { value: '3', label: '近3天' },
                          { value: '7', label: '近7天' },
                          { value: 'all', label: '全部' },
                        ]}
                      />
                    </div>
                    {showWorkOrders && <section
                      aria-label="待安排分类数量"
                      style={{ display: 'grid', gap: 6, marginBottom: 10 }}
                    >
                      {candidateGroups.map((group) => (
                        <div
                          key={group.key}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <span>{group.label}</span>
                          <strong>
                            {group.orders.reduce(
                              (sum, order) => sum + order.current.length,
                              0,
                            )}{' '}
                            条
                            {group.orders.some(
                              (order) => order.later.length > 0,
                            ) && (
                              <small
                                style={{ fontWeight: 400, color: '#667085' }}
                              >
                                {' '}
                                · 后续{' '}
                                {group.orders.reduce(
                                  (sum, order) => sum + order.later.length,
                                  0,
                                )}{' '}
                                条
                              </small>
                            )}
                          </strong>
                        </div>
                      ))}
                    </section>}
                    <p
                      style={{
                        fontSize: 12,
                        color: '#667085',
                        margin: '0 0 10px',
                      }}
                    >
                      {candidateWindow
                        ? `${showNonorderPool ? '计划日期' : '计划开工'} ≤ ${candidateWindow.end}`
                        : showNonorderPool ? '计划日期不限' : '计划开工日期不限'}
                    </p>
                    <Input
                      aria-label="搜索待安排任务"
                      allowClear
                      placeholder={showNonorderPool ? '搜索任务、工作项、人员' : '工单、料号、产品、工序'}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </header>
                  {laterOrder ? (
                    <>
                      <header>
                        <Button
                          size="small"
                          onClick={() => setLaterOrder(undefined)}
                        >
                          ← 返回当前任务
                        </Button>
                        <h3 style={{ marginTop: 12, marginBottom: 4 }}>
                          {laterOrder.mo_code} · 第{laterOrder.sort_seq}行
                        </h3>
                        <span>后续工序 · {laterRows.length} 道</span>
                      </header>
                      <section
                        className={styles.list}
                        aria-label="后续工序列表"
                      >
                        {laterRows.map((row) => renderCandidate(row))}
                        {!laterRows.length && (
                          <div className={styles.hint}>
                            没有待预安排的后续工序
                          </div>
                        )}
                      </section>
                    </>
                  ) : (
                    <div className={styles.list}>
                      {showNonorderPool && !locked && <NonorderPool candidates={nonorderCandidates} canEdit={canEditNonorder}
                        onAdd={addNonorder} locate={locateStation} />}
                      {showWorkOrders && candidateGroups
                        .filter((group) => group.orders.length > 0)
                        .map((group) => (
                          <details
                            key={group.key}
                            open={group.key !== 'onsite'}
                          >
                            <summary
                              style={{
                                cursor: 'pointer',
                                fontWeight: 600,
                                margin: '0 0 12px',
                              }}
                            >
                              {group.label} ·{' '}
                              {group.orders.reduce(
                                (sum, order) => sum + order.current.length,
                                0,
                              )}
                              {group.orders.some(
                                (order) => order.later.length > 0,
                              ) && ' · 含后续'}
                              {group.key === 'onsite' && (
                                <small
                                  style={{ fontWeight: 400, color: '#667085' }}
                                >
                                  （不限日期）
                                </small>
                              )}
                            </summary>
                            {group.orders.map((order) => (
                              <section key={order.key}>
                                {order.current.map((row, index) =>
                                  renderCandidate(
                                    row,
                                    index === order.current.length - 1
                                      ? order.later
                                      : [],
                                  ),
                                )}
                                {!order.current.length &&
                                  !!order.later.length && (
                                    <div className={styles.card}>
                                      <h4>
                                        {order.source.mo_code} · 第
                                        {order.source.sort_seq}行
                                      </h4>
                                      {renderLaterLink(
                                        order.source,
                                        order.later,
                                      )}
                                    </div>
                                  )}
                              </section>
                            ))}
                          </details>
                        ))}
                      {showWorkOrders && !candidateCount && (
                        <div className={styles.hint}>没有匹配的待安排任务</div>
                      )}
                    </div>
                  )}
                </aside>
                <section className={styles.lanes} aria-label="工站任务区域" data-wrap={wrapStations} tabIndex={0}>
                  {visibleStations.map((s) => {
                    const lane = showWorkOrders ? active.filter((t) => t.station_id === s.id) : [];
                    const stationGroup = `station:${s.id}`;
                    const showNonorderLane = showNonorder && groups.has(stationGroup);
                    const units = Object.entries(
                      lane.reduce<Record<string, number>>((acc, t) => {
                        acc[t.unit_name] = (acc[t.unit_name] || 0) + t.quantity;
                        return acc;
                      }, {}),
                    );
                    const timed = lane.filter(
                      (t) =>
                        t.standard_unit_minutes != null &&
                        t.capacity_station_id === s.id,
                    );
                    const hours = timed.reduce(
                      (sum, t) =>
                        sum +
                        (t.quantity * (t.standard_unit_minutes || 0)) / 60,
                      0,
                    );
                    const unknown = lane.filter(
                      (t) =>
                        !timed.includes(t) && t.capacity_state !== 'unlimited',
                    ).length;
                    return (
                      <section
                        key={s.id}
                        ref={(element) => {
                          if (element) laneRefs.current.set(s.id, element);
                          else laneRefs.current.delete(s.id);
                        }}
                        data-located={location?.id === s.id}
                        className={styles.lane}
                        aria-label={`${s.station_name}任务`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (isNonorderDrag(e.dataTransfer)) dropNonorder(e, `station:${s.id}`);
                          else drop(s.id);
                        }}
                      >
                        <header>
                          <h3>
                            {s.station_name} {showWorkOrders && <small>· 工单 {lane.length}项</small>}
                          </h3>
                          {showWorkOrders && <span style={{ fontSize: 12, color: '#667085' }}>
                            {units
                              .map(([unit, q]) => `${number(q)}${unit}`)
                              .join(' / ') || (showNonorderLane ? '暂无工单安排' : '暂无安排')}
                          </span>}
                          {!!lane.length && (
                            <div
                              style={{
                                fontSize: 12,
                                color: '#667085',
                                marginTop: 6,
                              }}
                            >
                              参考工时 {number(Number(hours.toFixed(1)))}小时
                              {unknown
                                ? ` · ${unknown}项未配置或单位不匹配`
                                : ''}
                              {lane.some(
                                (t) => t.capacity_state === 'unlimited',
                              )
                                ? ' · 含无限产能任务'
                                : ''}
                            </div>
                          )}
                        </header>
                        <div className={styles.list}>
                          {lane.map((t, index) => (
                            <TaskCard
                              detailTitle={`${t.mo_code} · 第${t.sort_seq}行`}
                              detailSubtitle={`${t.seq}. ${t.process_name}${t.kind === 'rework' ? ' · 返工' : ''}`}
                              className={styles.card}
                              key={t.id}
                              onDoubleClick={(e) => {
                                if (
                                  canManage &&
                                  !busy &&
                                  !(e.target as HTMLElement).closest(
                                    'button, a, input',
                                  )
                                ) {
                                  openTask(t);
                                }
                              }}
                              draggable={canManage && !busy}
                              onDragStart={(e) => {
                                drag.current = { task: t };
                                e.dataTransfer.setData(
                                  'text/plain',
                                  String(t.id),
                                );
                              }}
                              onDragEnd={() => {
                                drag.current = undefined;
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                if (isNonorderDrag(e.dataTransfer)) return;
                                e.preventDefault();
                                e.stopPropagation();
                                drop(s.id, t.id);
                              }}
                            >
                              <h4>
                                {index + 1}. {t.mo_code} · 第{t.sort_seq}行
                              </h4>
                              <span className={styles.badge}>
                                {t.process_name}
                                {t.kind === 'rework' ? ' · 返工' : ''}
                              </span>
                              {(t.current?.is_last_step ?? t.is_last_step) ===
                                true && (
                                <span
                                  className={styles.lastStep}
                                  title="无后续工序"
                                >
                                  末工序
                                </span>
                              )}
                              <section
                                data-task-summary
                                className={styles.compactQuantities}
                                aria-label="任务关键数量"
                              >
                                <div className={styles.quantityLead}>
                                  <span>安排数量</span>
                                  <span>
                                    <strong>{number(t.quantity)}</strong>
                                    <small>{t.unit_name}</small>
                                  </span>
                                </div>
                                <div
                                  className={`${styles.quantityLead} ${(taskReadiness(t).waiting || 0) > 0 ? styles.waitingQuantity : styles.noWaiting}`}
                                >
                                  <span>生产条件</span>
                                  <strong style={{ fontSize: 12 }}>
                                    {waitingLabel(
                                      taskReadiness(t).waiting,
                                      t.remaining,
                                      t.unit_name,
                                      t.current,
                                    )}
                                  </strong>
                                </div>
                              </section>
                              <p data-task-detail>{t.dept_name}</p>
                              <dl
                                data-task-detail
                                className={styles.productFields}
                              >
                                <dt>产品料号</dt>
                                <dd>{t.inv_code || '—'}</dd>
                                <dt>产品名称</dt>
                                <dd>{t.inv_name || '—'}</dd>
                                <dt>规格型号</dt>
                                <dd>{t.inv_std || '—'}</dd>
                              </dl>
                              <div data-task-detail className={styles.numbers}>
                                <span>
                                  安排 / {t.unit_name}
                                  <b>{number(t.quantity)}</b>
                                </span>
                                <span>
                                  当天完成<b>{number(t.actual.done || 0)}</b>
                                </span>
                              </div>
                              <p data-task-detail>
                                {status(t)} · 未完成 {number(t.remaining)}
                                {t.transferred_qty > 0
                                  ? ` · 转出${number(t.transferred_qty)}`
                                  : ''}
                              </p>
                              {t.current && (
                                <p data-task-detail>
                                  当前已接收待做{' '}
                                  {number(t.current.received_remaining)} ·
                                  待接收 {number(t.current.receivable)}
                                </p>
                              )}
                              <p
                                data-task-detail
                                className={
                                  (taskReadiness(t).waiting || 0) > 0
                                    ? styles.waitingQuantity
                                    : styles.noWaiting
                                }
                              >
                                {waitingLabel(
                                  taskReadiness(t).waiting,
                                  t.remaining,
                                  t.unit_name,
                                  t.current,
                                )}
                              </p>
                              {t.issue && (
                                <p className={styles.warning}>{t.issue}</p>
                              )}
                              {t.remark && <p data-task-detail>{t.remark}</p>}
                              {draft?.carries.map((carry, index) =>
                                carry.id === t.id ? (
                                  <p
                                    key={carry.local_key}
                                    className={styles.warning}
                                  >
                                    待保存结转：{carry.target_date} ·{' '}
                                    {number(carry.quantity)}
                                    {t.unit_name}
                                    <Button
                                      type="link"
                                      size="small"
                                      disabled={busy}
                                      onClick={() =>
                                        void mutate({
                                          action: 'uncarry',
                                          id: t.id,
                                          index,
                                        })
                                      }
                                    >
                                      撤销
                                    </Button>
                                  </p>
                                ) : null,
                              )}
                              {canManage && (
                                <div
                                  data-task-detail
                                  data-close-task-popup
                                  className={`${styles.actions} no-print`}
                                >
                                  <Button
                                    size="small"
                                    disabled={busy}
                                    onClick={() => openTask(t)}
                                  >
                                    编辑
                                  </Button>

                                  <Button
                                    size="small"
                                    disabled={busy || index === 0}
                                    onClick={() => reorder(t, undefined, -1)}
                                  >
                                    上移
                                  </Button>
                                  <Button
                                    size="small"
                                    danger
                                    disabled={busy}
                                    onClick={() =>
                                      void mutate({
                                        action: 'cancel',
                                        id: t.id,
                                      })
                                    }
                                  >
                                    取消
                                  </Button>
                                </div>
                              )}
                            </TaskCard>
                          ))}
                          {showWorkOrders && !lane.length && !showNonorderLane && (
                            <div className={styles.hint}>
                              把左侧工单拖到这里
                              <br />
                              安排当天要做的数量
                            </div>
                          )}
                          {showNonorderLane && renderNonorderLane(stationGroup)}
                        </div>
                      </section>
                    );
                  })}
                  {showNonorder && [...groups].filter(([, group]) => group.type === 'leader' ||
                    group.type === 'station' && !current.stations.some((station) => station.id === group.id))
                    .map(([key, group]) => <section key={key} className={styles.lane}>
                      <header><h3>{group.type === 'leader' ? `无工站 · ${group.name}` : group.name}</h3></header>
                      <div className={styles.list}>{renderNonorderLane(key)}</div>
                    </section>)}
                  {!visibleStations.length && !(showNonorder && groups.size) && (
                    <div className={styles.hint}>
                      {!showWorkOrders
                        ? '暂无无工单安排'
                        : hideEmptyStations
                        ? '暂无已分配任务的工站'
                        : '请选择生产部门或配置工序工站'}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          {tab === 'check' && (
            <>
              <div className={`${styles.toolbar} no-print`}>
                <Select
                  value={filter}
                  style={{ width: 180 }}
                  onChange={setFilter}
                  options={[
                    { value: 'all', label: '全部任务' },
                    { value: 'unfinished', label: '未完成' },
                    { value: 'over', label: '超额完成' },
                    { value: 'cancelled', label: '已取消' },
                  ]}
                />
                <span style={{ fontSize: 12, color: '#667085' }}>
                  完工合计 = A + A1 + A2 + C；差额 = 完工 −
                  安排。接收按当天现存流水统计。
                </span>
              </div>
              {checks}
              <details style={{ marginTop: 16 }}>
                <summary>数据核对提示</summary>
                <p>缺少历史流水时不使用累计数量倒推当天接收或完工。</p>
                {current.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </details>
            </>
          )}
          {tab === 'nonorder-check' && <NonorderExecution initialDate={date} />}
          {tab === 'history' && !!server?.nonorder?.history?.length && <Table title={() => '无工单安排记录'} size="small"
            rowKey="key" pagination={{ pageSize: 8 }} dataSource={server.nonorder.history}
            columns={[
              { title: '时间', render: (_, row) => row.occurred_at.replace('T', ' ').slice(0, 16) },
              { title: '操作人', dataIndex: 'actor' },
              { title: '操作', render: (_, row) => editLabels[row.action] || row.action },
              { title: '工作项', dataIndex: 'work' },
              { title: '执行人员', dataIndex: 'staff_name' },
              { title: '执行日期', render: (_, row) => row.work_date === row.old_date ? row.work_date : `${row.old_date} → ${row.work_date}` },
              { title: '安排备注', dataIndex: 'remark' },
            ]} />}
          {tab === 'history' && (
            <Table
              rowKey="id"
              pagination={false}
              dataSource={current.changes}
              columns={[
                { title: '时间', dataIndex: 'created_at' },
                { title: '人员', dataIndex: 'actor' },
                {
                  title: '操作',
                  dataIndex: 'action',
                  render: (v: string) => labels[v] || v,
                },
                {
                  title: '任务',
                  render: (_, row) => {
                    const t = tasks.find((t) => t.id === row.item_id);
                    return t
                      ? `${t.mo_code} · 第${t.sort_seq}行 · ${t.process_name}`
                      : '全部任务';
                  },
                },
                {
                  title: '变更',
                  render: (_, row) => {
                    const parse = (v: unknown): Record<string, unknown> =>
                      typeof v === 'string'
                        ? JSON.parse(v) || {}
                        : ((v || {}) as Record<string, unknown>);
                    const a = parse(row.before_data),
                      b = parse(row.after_data);
                    if (row.action === 'reorder') return '工站内顺序已调整';
                    if (row.action === 'publish') return '草稿 → 已发布';
                    if (row.action === 'cancel') return '已取消，保留实际报工';
                    if (row.action === 'carry_in')
                      return `承接${b.quantity}，关联任务${row.related_item_id}`;
                    if (row.action === 'carry')
                      return `转出${b.quantity && b.target_date ? b.quantity : Number(b.transferred_qty || 0) - Number(a.transferred_qty || 0)}，关联任务${row.related_item_id}`;
                    return `${a.quantity ?? '—'} → ${b.quantity ?? '—'}${a.remark !== b.remark ? ' · 备注已更新' : ''}`;
                  },
                },
              ]}
            />
          )}
        </>
      )}

      <Modal
        title={saveReview?.publish ? '确认保存并发布' : '确认本次保存'}
        open={!!saveReview}
        width={1040}
        confirmLoading={busy}
        okText={saveReview?.publish ? '确认保存并发布' : '确认保存'}
        cancelText="返回修改"
        onCancel={() => {
          if (!busy) setSaveReview(undefined);
        }}
        onOk={() => void saveServer()}
        okButtonProps={{ disabled: !canManage || conflict }}
      >
        {saveReview && (
          <>
            <p>{date} · 包含此前暂存、尚未保存的修改。</p>
            {saveReview.workOrderPublishCount > 0 && <p>待发布工单 {saveReview.workOrderPublishCount} 条</p>}
            <p style={{ display: 'flex', gap: 20 }}>
              {(['新增', '修改', '取消'] as const).map((action) => (
                <strong
                  key={action}
                  style={{
                    color:
                      action === '新增'
                        ? '#167d45'
                        : action === '取消'
                          ? '#b42318'
                          : '#1d4ed8',
                  }}
                >
                  {action}{' '}
                  {
                    saveReview.changes.filter((row) => row.action === action)
                      .length
                  }{' '}
                  条
                </strong>
              ))}
            </p>
            {error && (
              <Alert type="error" title={error} style={{ marginBottom: 12 }} />
            )}
            {(saveReview.changes.length > 0 || !(saveReview.draft.nonorder?.length || saveReview.draft.nonorderCreations?.length)) && <Table<DraftChange>
              rowKey="key"
              size="small"
              pagination={false}
              dataSource={saveReview.changes}
              scroll={{ x: 900, y: '50vh' }}
              locale={{
                emptyText: saveReview.publish
                  ? `无任务修改，将发布 ${publicationItems.length} 条安排`
                  : '没有任务变更',
              }}
              columns={[
                {
                  title: '操作',
                  dataIndex: 'action',
                  width: 65,
                  render: (action: string) => (
                    <strong
                      style={{
                        color:
                          action === '新增'
                            ? '#167d45'
                            : action === '取消'
                              ? '#b42318'
                              : '#1d4ed8',
                      }}
                    >
                      {action}
                    </strong>
                  ),
                },
                {
                  title: '工单 / 行号',
                  width: 180,
                  render: (_, row) =>
                    `${row.task.mo_code} · 第${row.task.sort_seq}行`,
                },
                {
                  title: '工序',
                  width: 170,
                  render: (_, row) =>
                    `${row.task.seq}. ${row.task.process_name}${row.task.kind === 'rework' ? '（返工）' : ''}`,
                },
                {
                  title: '工站',
                  width: 140,
                  render: (_, row) =>
                    row.before && row.before.station_id !== row.task.station_id
                      ? `${stationName(row.before.station_id)} → ${stationName(row.task.station_id)}`
                      : stationName(row.task.station_id),
                },
                {
                  title: '安排数量',
                  width: 150,
                  render: (_, row) =>
                    `${row.before ? number(row.before.status === 'active' ? row.before.quantity : 0) : '—'} → ${number(row.task.status === 'active' ? row.task.quantity : 0)} ${row.task.unit_name}`,
                },
                {
                  title: '其他调整',
                  render: (_, row) =>
                    row.notes.length
                      ? row.notes.map((note) => <div key={note}>{note}</div>)
                      : '—',
                },
              ]}
            />}
            {!!saveReview.draft.nonorder?.length && <Table<NonorderEdit> title={() => '无工单安排'} size="small"
              rowKey={(row) => row.person.key} pagination={false} dataSource={saveReview.draft.nonorder}
              columns={[
                { title: '操作', render: (_, row) => row.action === 'update' && row.publish && row.plan?.status === 'draft' ? '发布' : editLabels[row.action] },
                { title: '工作项', render: (_, row) => row.work_edit?.content ?? row.person.division.content },
                { title: '执行人员', render: (_, row) => row.work_edit?.staff_name ?? row.person.assignment.staff_name },
                { title: '执行日期', render: (_, row) => row.target_date ? `${date} → ${row.target_date}` : date },
                { title: '工站 / 负责人', render: (_, row) => row.person.group.type === 'leader' ? `无工站 · ${row.person.group.name}` : row.person.group.name },
                { title: '个人职责', render: (_, row) => row.work_edit?.responsibility ?? row.person.assignment.responsibility },
              ]} />}
            {!!saveReview.draft.nonorderCreations?.length && <Table<NonorderCreation> title={() => '新增无工单安排'} size="small"
              rowKey="request_id" pagination={false} dataSource={saveReview.draft.nonorderCreations}
              columns={[
                { title: '任务', render: (_, row) => row.task.content },
                { title: '负责人', dataIndex: 'responsible_name' },
                { title: '执行人员', render: (_, row) => row.task.divisions.flatMap((division) => division.members.map((person) => person.staff_name)).join('、') },
                { title: '执行日期', render: () => date },
              ]} />}
          </>
        )}
      </Modal>
      <Modal
        title="一键安排 · 选择工站"
        open={!!bulk}
        okText="暂存全部安排"
        cancelText="取消"
        onCancel={() => setBulk(undefined)}
        onOk={() => {
          if (bulk) applyBulk(bulk.source, bulk.stations);
        }}
        okButtonProps={{
          disabled:
            !canManage ||
            busy ||
            !bulkRows.length ||
            bulkRows.some((row) => !bulk?.stations[identity(row)]),
        }}
      >
        {bulk && (
          <>
            <p>
              {bulk.source.mo_code} · 第{bulk.source.sort_seq}行 · 当前及后续{' '}
              {bulkRows.length} 道
            </p>
            <div className={styles.form}>
              {bulkRows.map((row) => (
                <label key={identity(row)} htmlFor={`bulk-${row.seq}`}>
                  {row.seq}. {row.process_name} ·{' '}
                  {number(
                    availableNow(row) === 0
                      ? row.unassigned
                      : availableNow(row),
                  )}
                  {row.unit_name}
                  <Select
                    id={`bulk-${row.seq}`}
                    aria-label={`${row.seq}. ${row.process_name}目标工站`}
                    placeholder="选择工站"
                    value={bulk.stations[identity(row)]}
                    disabled={row.allowed_station_ids.length === 1}
                    options={row.allowed_station_ids.map((id) => ({
                      value: id,
                      label: stationName(id),
                    }))}
                    onChange={(id) =>
                      setBulk(
                        (value) =>
                          value && {
                            ...value,
                            stations: {
                              ...value.stations,
                              [identity(row)]: id,
                            },
                          },
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </>
        )}
      </Modal>
      <Modal
        title="修改任务"
        open={!!dialog}
        confirmLoading={busy}
        onCancel={() => setDialog(undefined)}
        okText="暂存修改"
        cancelText="取消"
        onOk={() => {
          if (!dialog || !quantity || !station) return;
          void mutate({
            action: 'edit',
            id: dialog.task?.id,
            mo_code: dialog.source.mo_code,
            sort_seq: dialog.source.sort_seq,
            route_id: dialog.source.route_id,
            seq: dialog.source.seq,
            kind: dialog.source.kind,
            station_id: station,
            quantity,
            remark,
          });
        }}
      >
        {dialog && (
          <div className={styles.form}>
            <strong>
              {dialog.source.mo_code} · 第{dialog.source.sort_seq}行 ·{' '}
              {dialog.source.process_name}
              {dialog.source.kind === 'rework' ? '（返工）' : ''}
            </strong>
            <label htmlFor="daily-station">
              工站
              <Select
                id="daily-station"
                value={station}
                disabled
                options={[{ value: station, label: stationName(station || 0) }]}
              />
            </label>
            <label htmlFor="daily-quantity">
              安排完工数量（
              {dialog.source.unit_name}）
              <InputNumber
                id="daily-quantity"
                aria-label="安排数量"
                value={quantity}
                min={0.0001}
                precision={4}
                style={{ width: '100%' }}
                onChange={setQuantity}
              />
            </label>
            <label htmlFor="daily-remark">
              备注
              <Input.TextArea
                id="daily-remark"
                rows={2}
                maxLength={500}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </label>
          </div>
        )}
      </Modal>
    </main>
  );
}
