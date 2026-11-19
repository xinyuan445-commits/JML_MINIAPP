import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { history, useAccess } from '@umijs/max';
import type { TableColumnsType } from 'antd';
import {
  Alert,
  Button,
  Card,
  Input,
  Segmented,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ThemeModeButton } from '@/components/ThemeMode';
import type {
  DashboardDaily,
  DashboardOperations,
  DashboardOrder,
  DashboardStep,
} from '../dashboard/service';
import { getDashboardOperations } from '../dashboard/service';
import styles from './OperationsReport.less';

const { Text, Title } = Typography;
const AUTO_REFRESH_MS = 2 * 60 * 1000;
type TaskFilter = 'all' | 'work' | 'receive' | 'rework' | 'overdue';
type DailySummary = {
  key: string;
  date: string;
  unit: string;
  normal: number;
  rework: number;
  finalNormal: number;
  finalRework: number;
  batches: number;
};
const metricDefinitions = [
  { key: 'work', title: '当前在制', hint: '仍有正常待完或返工作业' },
  { key: 'receive', title: '可接收', hint: '已有可继续接收的数量' },
  { key: 'rework', title: '返工中', hint: '仍有返工数量未完成' },
  {
    key: 'overdue',
    title: '已过计划日期',
    hint: '计划日期已过且尚有待处理任务',
  },
] as const;
const orderKey = (order: DashboardOrder) =>
  `${order.mo_code}__${order.sort_seq}`;
const stationLabel = (step: DashboardStep) => step.station_name || '未标工站';
const numberText = (value: number | null | undefined) =>
  value == null
    ? '待核实'
    : value.toLocaleString('zh-CN', { maximumFractionDigits: 4 });
const timeText = (value?: string | null) =>
  value && dayjs(value).isValid() ? dayjs(value).format('MM-DD HH:mm') : '—';
const hasWork = (step: DashboardStep) =>
  (step.normal_remaining_qty != null && step.normal_remaining_qty > 0) ||
  step.rework_remaining_qty > 0 ||
  (step.normal_remaining_qty == null && step.status === 'processing');
const isPending = (order: DashboardOrder) =>
  order.is_active ||
  order.plan_shortfall_qty == null ||
  order.plan_shortfall_qty > 0;

function matchesTask(
  order: DashboardOrder,
  task: TaskFilter,
  station?: string,
) {
  const steps = station
    ? order.steps.filter((step) => stationLabel(step) === station)
    : order.steps;
  if (task === 'work')
    return station ? steps.some(hasWork) : order.has_work || order.has_rework;
  if (task === 'receive')
    return station
      ? steps.some((step) => (step.receive_available_qty ?? 0) > 0)
      : order.has_receivable;
  if (task === 'rework')
    return station
      ? steps.some((step) => step.rework_remaining_qty > 0)
      : order.has_rework;
  if (task === 'overdue') return order.is_overdue;
  return true;
}

function groupDaily(rows: DashboardDaily[]): DailySummary[] {
  const grouped = new Map<string, DailySummary>();
  rows.forEach((row) => {
    const unit = row.unit_name || '单位待核实';
    const key = `${row.date}__${unit}`;
    const current = grouped.get(key) || {
      key,
      date: row.date,
      unit,
      normal: 0,
      rework: 0,
      finalNormal: 0,
      finalRework: 0,
      batches: 0,
    };
    if (row.kind === 'normal') {
      current.normal += row.qty;
      if (row.is_final) current.finalNormal += row.qty;
    } else {
      current.rework += row.qty;
      if (row.is_final) current.finalRework += row.qty;
    }
    current.batches += row.batch_count;
    grouped.set(key, current);
  });
  return [...grouped.values()].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || a.unit.localeCompare(b.unit, 'zh-CN'),
  );
}

function stepSummary(step: DashboardStep) {
  const labels: string[] = [];
  if (step.status === 'received') labels.push('待开工');
  if (step.normal_remaining_qty == null) labels.push('待完待核实');
  else if (step.normal_remaining_qty > 0)
    labels.push(`待完 ${numberText(step.normal_remaining_qty)}`);
  if (step.receive_available_qty == null) labels.push('可接待核实');
  else if (step.receive_available_qty > 0)
    labels.push(`可接 ${numberText(step.receive_available_qty)}`);
  if (step.rework_remaining_qty > 0)
    labels.push(`返工 ${numberText(step.rework_remaining_qty)}`);
  if (!labels.length) {
    if (step.normal_done_qty > 0) labels.push('已接收部分做完');
    else if (step.status === 'processing') labels.push('进行中');
    else labels.push('尚未接收');
  }
  return labels.join(' · ');
}

const stepColumns: TableColumnsType<DashboardStep> = [
  {
    title: '工序 / 工站',
    key: 'step',
    width: 170,
    render: (_, step) => (
      <>
        <strong>
          {step.seq}. {step.process_name}
        </strong>
        <div className={styles.secondary}>{stationLabel(step)}</div>
      </>
    ),
  },
  {
    title: '累计正常接收',
    dataIndex: 'normal_received_qty',
    width: 110,
    render: numberText,
  },
  {
    title: '累计正常完工',
    dataIndex: 'normal_done_qty',
    width: 110,
    render: numberText,
  },
  {
    title: '正常待完',
    dataIndex: 'normal_remaining_qty',
    width: 100,
    render: numberText,
  },
  {
    title: '还可接收',
    dataIndex: 'receive_available_qty',
    width: 100,
    render: numberText,
  },
  {
    title: '返工剩余',
    dataIndex: 'rework_remaining_qty',
    width: 100,
    render: (value: number) =>
      value > 0 ? (
        <Text type="warning">{numberText(value)}</Text>
      ) : (
        numberText(value)
      ),
  },
  {
    title: '开工人员',
    dataIndex: 'workers',
    width: 150,
    render: (workers: string[]) =>
      workers.length ? workers.join('、') : '未记录',
  },
  {
    title: '返工人员',
    dataIndex: 'rework_workers',
    width: 150,
    render: (workers: string[]) =>
      workers.length ? workers.join('、') : '未记录',
  },
  {
    title: '最近作业',
    dataIndex: 'last_activity',
    width: 120,
    render: timeText,
  },
];

const dailyColumns: TableColumnsType<DailySummary> = [
  {
    title: '日期',
    dataIndex: 'date',
    width: 100,
    render: (value: string) => dayjs(value).format('MM-DD'),
  },
  { title: '单位', dataIndex: 'unit', width: 90 },
  {
    title: '正常报工',
    dataIndex: 'normal',
    align: 'right',
    render: numberText,
  },
  {
    title: '返工报工',
    dataIndex: 'rework',
    align: 'right',
    render: numberText,
  },
  {
    title: '其中末站正常',
    dataIndex: 'finalNormal',
    align: 'right',
    render: numberText,
  },
  {
    title: '其中末站返工',
    dataIndex: 'finalRework',
    align: 'right',
    render: numberText,
  },
  {
    title: '批次',
    dataIndex: 'batches',
    width: 70,
    align: 'right',
    render: numberText,
  },
];

const OperationsReport: React.FC = () => {
  const access = useAccess();
  const [data, setData] = useState<DashboardOperations | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [department, setDepartment] = useState<string | undefined>(
    () =>
      new URLSearchParams(history.location.search).get('department') ||
      undefined,
  );
  const [station, setStation] = useState<string | undefined>(
    () =>
      new URLSearchParams(history.location.search).get('station') || undefined,
  );
  const [keyword, setKeyword] = useState('');
  const [scope, setScope] = useState<'pending' | 'all'>(() =>
    new URLSearchParams(history.location.search).get('scope') === 'all'
      ? 'all'
      : 'pending',
  );
  const [task, setTask] = useState<TaskFilter>(() => {
    const initialTask = new URLSearchParams(history.location.search).get(
      'task',
    );
    return initialTask &&
      ['work', 'receive', 'rework', 'overdue'].includes(initialTask)
      ? (initialTask as TaskFilter)
      : 'all';
  });
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const lastFetchAt = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  const loadDashboard = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (mounted.current) setLoading(true);
    try {
      const response = await getDashboardOperations();
      if (!mounted.current) return;
      if (response.code !== 0 || !response.data)
        throw new Error('报表数据未能更新');
      setData(response.data);
      setLoadError(false);
      lastFetchAt.current = Date.now();
    } catch {
      if (mounted.current) setLoadError(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadDashboard();
    const refreshWhenVisible = () => {
      if (
        !document.hidden &&
        Date.now() - lastFetchAt.current >= AUTO_REFRESH_MS
      )
        void loadDashboard();
    };
    const timer = window.setInterval(refreshWhenVisible, AUTO_REFRESH_MS);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadDashboard]);

  const departmentOptions = useMemo(
    () =>
      [
        ...new Set(
          data?.orders.map((order) => order.dept_name || '部门待核实') || [],
        ),
      ]
        .sort()
        .map((value) => ({ value, label: value })),
    [data],
  );
  const stationOptions = useMemo(
    () =>
      [
        ...new Set(
          data?.orders.flatMap((order) => order.steps.map(stationLabel)) || [],
        ),
      ]
        .sort()
        .map((value) => ({ value, label: value })),
    [data],
  );
  const departmentOrders = useMemo(() => {
    const search = keyword.trim().toLocaleLowerCase();
    return (data?.orders || []).filter(
      (order) =>
        (!department || (order.dept_name || '部门待核实') === department) &&
        (!search ||
          [
            order.mo_code,
            order.sort_seq,
            order.inv_code,
            order.inv_name,
            order.inv_std,
            order.customer_code,
            order.customer_name,
            order.source_so_code,
          ]
            .join(' ')
            .toLocaleLowerCase()
            .includes(search)),
    );
  }, [data, department, keyword]);
  const filteredOrders = useMemo(
    () =>
      departmentOrders.filter(
        (order) =>
          !station ||
          order.steps.some((step) => stationLabel(step) === station),
      ),
    [departmentOrders, station],
  );
  const metrics = useMemo(
    () =>
      metricDefinitions.map((definition) => ({
        ...definition,
        count: filteredOrders.filter((order) =>
          matchesTask(order, definition.key, station),
        ).length,
      })),
    [filteredOrders, station],
  );
  const orders = useMemo(
    () =>
      filteredOrders
        .filter(
          (order) =>
            (scope === 'all' || isPending(order)) &&
            matchesTask(order, task, station),
        )
        .sort(
          (a, b) =>
            Number(b.is_overdue) - Number(a.is_overdue) ||
            Number(b.has_rework) - Number(a.has_rework) ||
            Number(b.has_receivable) - Number(a.has_receivable) ||
            (b.last_activity || '').localeCompare(a.last_activity || '') ||
            a.mo_code.localeCompare(b.mo_code) ||
            a.sort_seq - b.sort_seq,
        ),
    [filteredOrders, scope, task, station],
  );
  const stationTasks = useMemo(() => {
    const grouped = new Map<
      string,
      { name: string; receiving: number; work: number; rework: number }
    >();
    departmentOrders.forEach((order) => {
      order.steps.forEach((step) => {
        const name = stationLabel(step);
        const item = grouped.get(name) || {
          name,
          receiving: 0,
          work: 0,
          rework: 0,
        };
        if ((step.receive_available_qty ?? 0) > 0) item.receiving += 1;
        if (hasWork(step)) item.work += 1;
        if (step.rework_remaining_qty > 0) item.rework += 1;
        grouped.set(name, item);
      });
    });
    return [...grouped.values()]
      .filter((item) => item.receiving || item.work || item.rework)
      .sort(
        (a, b) =>
          b.rework - a.rework ||
          b.work - a.work ||
          b.receiving - a.receiving ||
          a.name.localeCompare(b.name, 'zh-CN'),
      );
  }, [departmentOrders]);
  const daily = useMemo(
    () =>
      groupDaily(
        (data?.daily || []).filter(
          (row) => !station || (row.station_name || '未标工站') === station,
        ),
      ),
    [data, station],
  );
  const todayRows = daily.filter((row) => row.date === data?.today);
  const emptyText = !data
    ? loading
      ? '正在获取数据…'
      : '数据未能加载，请重试'
    : '当前范围没有记录';

  const resetPage = () => setCurrentPage(1);
  const selectTask = (next: TaskFilter) => {
    setTask(task === next ? 'all' : next);
    resetPage();
  };
  const openDetails = (order: DashboardOrder) =>
    access.canCompleted && history.push(
      `/board/completed?mo_code=${encodeURIComponent(order.mo_code)}&sort_seq=${encodeURIComponent(order.sort_seq)}&source=dashboard`,
    );
  const toggleExpanded = (order: DashboardOrder) => {
    const key = orderKey(order);
    setExpandedKeys((keys) =>
      keys.includes(key)
        ? keys.filter((value) => value !== key)
        : [...keys, key],
    );
  };
  const orderColumns: TableColumnsType<DashboardOrder> = [
    {
      title: '工单 / 行号',
      key: 'order',
      width: 180,
      fixed: 'left',
      render: (_, order) => (
        <>
          {access.canCompleted ? <Button
            type="link"
            className={styles.tableLink}
            onClick={() => openDetails(order)}
          >
            {order.mo_code}
          </Button> : <span>{order.mo_code}</span>}
          <div className={styles.secondary}>
            第 {order.sort_seq} 行 · {order.dept_name || '部门待核实'}
          </div>
          {order.is_overdue && (
            <Tag color="warning" className={styles.orderTag}>
              已过计划日期
            </Tag>
          )}
        </>
      ),
    },
    {
      title: '产品',
      key: 'product',
      width: 230,
      render: (_, order) => (
        <div className={styles.product}>
          <strong>{order.inv_name || '产品资料待核实'}</strong>
          <span>{order.inv_code || '编码待核实'}</span>
          <span>{order.inv_std || '规格未填写'}</span>
          {order.customer_name && <span>客户：{order.customer_name}</span>}
          {order.source_so_code && (
            <span>
              来源：{order.source_so_code}
              {order.source_account ? `（${order.source_account}）` : ''}
            </span>
          )}
        </div>
      ),
    },
    {
      title: '计划 / 末站',
      key: 'plan',
      width: 150,
      render: (_, order) => (
        <div className={styles.plan}>
          <strong>
            {numberText(order.plan_qty)}{' '}
            <small>{order.unit_name || '单位待核实'}</small>
          </strong>
          <Tooltip title="计划数量减去末工序累计正常完工数量；返工完工不重复计入。">
            <span>计划余量 {numberText(order.plan_shortfall_qty)}</span>
          </Tooltip>
          <span>
            计划日期{' '}
            {order.plan_due_date
              ? dayjs(order.plan_due_date).format('MM-DD')
              : '未提供'}
          </span>
        </div>
      ),
    },
    {
      title: '各工序进度 · 点击展开数量和人员',
      key: 'steps',
      width: 460,
      render: (_, order) => (
        <div className={styles.stepStrip}>
          {order.steps.map((step) => (
            <button
              type="button"
              key={step.seq}
              className={`${styles.stepChip} ${step.rework_remaining_qty > 0 ? styles.stepRework : hasWork(step) ? styles.stepWork : ''} ${station && stationLabel(step) !== station ? styles.stepMuted : ''}`}
              onClick={() => toggleExpanded(order)}
              aria-expanded={expandedKeys.includes(orderKey(order))}
            >
              <strong>
                {step.seq}. {step.process_name}
              </strong>
              <span>{stepSummary(step)}</span>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: '最近作业',
      dataIndex: 'last_activity',
      width: 120,
      render: timeText,
    },
    {
      title: '',
      key: 'detail',
      width: 65,
      render: (_, order) => (
        <Button
          type="link"
          className={styles.tableLink}
          onClick={() => openDetails(order)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <Title level={3}>生产报表</Title>
          <Text type="secondary">工单明细与批次报工</Text>
        </div>
        <div className={styles.refreshArea}>
          <span className={styles.secondary}>
            {data ? `上次成功 ${timeText(data.generated_at)}` : '尚未取得数据'}{' '}
            · 每 2 分钟刷新
          </span>
          <ThemeModeButton />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void loadDashboard()}
            loading={loading}
          >
            刷新
          </Button>
        </div>
      </header>
      <nav className={styles.quickLinks} aria-label="生产常用功能">
        {access.canCompleted && <Button type="link" onClick={() => history.push('/board/completed')}>
          完工记录
        </Button>}
        {access.canDashboard && <Button type="link" onClick={() => history.push('/board/production')}>
          返回生产看板
        </Button>}
        {access.canProductionLabel && <Button
              type="link"
              onClick={() => history.push('/mo/production-label')}
            >
              生产标签打印
            </Button>}
        {access.canWorkorder && <Button type="link" onClick={() => history.push('/mo/workorder')}>
              工单路线指定
            </Button>}
      </nav>
      {loadError && (
        <Alert
          className={styles.alert}
          type="warning"
          showIcon
          title={
            data
              ? '本次刷新失败，当前仍显示上次成功取得的数据。'
              : '报表暂时未能加载，请点击刷新重试。'
          }
        />
      )}
      {data && data.warnings.length > 0 && (
        <details className={styles.warnings}>
          <summary>
            有 {data.warnings.length} 项数据说明，部分数量需核实
          </summary>
          <ul>
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
      <section className={styles.filters} aria-label="工单筛选">
        <label className={styles.filterField} htmlFor="dashboard-department">
          <span>生产部门</span>
          <Select
            id="dashboard-department"
            aria-label="生产部门"
            allowClear
            showSearch={{ optionFilterProp: 'label' }}
            placeholder="全部部门"
            value={department}
            options={departmentOptions}
            onChange={(value) => {
              setDepartment(value);
              resetPage();
            }}
          />
        </label>
        <label className={styles.filterField} htmlFor="dashboard-station">
          <span>工站</span>
          <Select
            id="dashboard-station"
            aria-label="工站"
            allowClear
            showSearch={{ optionFilterProp: 'label' }}
            placeholder="全部工站"
            value={station}
            options={stationOptions}
            onChange={(value) => {
              setStation(value);
              resetPage();
            }}
          />
        </label>
        <label
          className={`${styles.filterField} ${styles.searchField}`}
          htmlFor="dashboard-keyword"
        >
          <span>查找工单</span>
          <Input
            id="dashboard-keyword"
            aria-label="查找工单"
            prefix={<SearchOutlined />}
            placeholder="工单号、产品名称或编码"
            allowClear
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              resetPage();
            }}
          />
        </label>
        <Button
          type="text"
          onClick={() => {
            setDepartment(undefined);
            setStation(undefined);
            setKeyword('');
            setTask('all');
            setScope('pending');
            resetPage();
          }}
        >
          重置
        </Button>
      </section>
      <section className={styles.metricsGrid} aria-label="工单状态筛选">
        {metrics.map((metric) => (
          <button
            type="button"
            className={`${styles.metric} ${task === metric.key ? styles.metricSelected : ''}`}
            key={metric.key}
            onClick={() => selectTask(metric.key)}
            aria-pressed={task === metric.key}
            disabled={!data}
          >
            <span>{metric.title}</span>
            <strong>
              {data ? metric.count.toLocaleString('zh-CN') : '—'}
              <small>工单行</small>
            </strong>
            <span className={styles.metricHint}>{metric.hint}</span>
          </button>
        ))}
      </section>
      <section className={styles.ordersPanel} ref={listRef}>
        <div className={styles.panelHeading}>
          <div>
            <h2>生产工单</h2>
            <span className={styles.secondary}>
              {data ? `${orders.length} 行` : '等待数据'} ·
              各工序可同时作业，数量不跨站相加
            </span>
          </div>
          <div className={styles.listControls}>
            {task !== 'all' && (
              <Button
                size="small"
                type="link"
                onClick={() => {
                  setTask('all');
                  resetPage();
                }}
              >
                清除“
                {metricDefinitions.find((item) => item.key === task)?.title}
                ”筛选
              </Button>
            )}
            <Segmented
              value={scope}
              options={[
                { label: '待处理', value: 'pending' },
                { label: '全部', value: 'all' },
              ]}
              onChange={(value) => {
                setScope(value as 'pending' | 'all');
                resetPage();
              }}
            />
          </div>
        </div>
        <Table<DashboardOrder>
          size="small"
          rowKey={orderKey}
          columns={orderColumns}
          dataSource={orders}
          loading={loading && !data}
          locale={{ emptyText }}
          scroll={{ x: 1260 }}
          pagination={{
            current: Math.min(
              currentPage,
              Math.max(1, Math.ceil(orders.length / pageSize)),
            ),
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total) => `共 ${total} 行`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpandedRowsChange: (keys) => setExpandedKeys([...keys]),
            rowExpandable: (order) => order.steps.length > 0,
            expandedRowRender: (order) => (
              <div className={styles.stepDetails}>
                <div className={styles.detailHeading}>
                  <strong>{order.route_name || '工艺路线'}</strong>
                  <span>
                    以下数量单位：{order.unit_name || '待核实'}
                    ；正常完工与返工分开统计
                  </span>
                </div>
                <Table<DashboardStep>
                  size="small"
                  rowKey="seq"
                  columns={stepColumns}
                  dataSource={order.steps}
                  pagination={false}
                  scroll={{ x: 1210 }}
                />
              </div>
            ),
          }}
        />
        <p className={styles.tableFootnote}>
          “待处理”包含当前作业、计划尚有余量及数量待核实的工单。接收部分做完，不等于整单全部完成。
        </p>
      </section>
      <section className={styles.lowerGrid}>
        <Card
          size="small"
          title="工站任务概览"
          extra={<Text type="secondary">点击筛选工单</Text>}
          className={styles.panelCard}
        >
          <p className={styles.panelNote}>
            按当前部门、工单筛选统计；每条工序算一项任务，可同时在制和返工。
          </p>
          {stationTasks.length ? (
            <div className={styles.stationList}>
              {stationTasks.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  className={`${styles.stationTask} ${station === item.name ? styles.stationSelected : ''}`}
                  onClick={() => {
                    setStation(station === item.name ? undefined : item.name);
                    setTask('all');
                    resetPage();
                    listRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }}
                  aria-pressed={station === item.name}
                >
                  <strong>{item.name}</strong>
                  <span>
                    可接收 <b>{item.receiving}</b>
                  </span>
                  <span>
                    在制 <b>{item.work}</b>
                  </span>
                  <span className={item.rework ? styles.reworkText : undefined}>
                    返工 <b>{item.rework}</b>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>{emptyText}</div>
          )}
        </Card>
        <Card
          size="small"
          title={`今日报工 · ${data?.today || '日期待获取'}`}
          className={styles.panelCard}
        >
          <p className={styles.panelNote}>
            {station ? `${station}，` : '全部工站，'}
            按实际完工批次统计。此处不随部门、工单筛选变化。
          </p>
          {todayRows.length ? (
            <div className={styles.todayList}>
              {todayRows.map((row) => (
                <div className={styles.todayRow} key={row.key}>
                  <div>
                    <Tag>{row.unit}</Tag>
                    <span className={styles.secondary}>
                      {numberText(row.batches)} 批次
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>正常报工</dt>
                      <dd>{numberText(row.normal)}</dd>
                    </div>
                    <div>
                      <dt>返工报工</dt>
                      <dd>{numberText(row.rework)}</dd>
                    </div>
                    <div>
                      <dt>其中末站正常</dt>
                      <dd>{numberText(row.finalNormal)}</dd>
                    </div>
                    <div>
                      <dt>其中末站返工</dt>
                      <dd>{numberText(row.finalRework)}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              {data ? '今日暂无已记录的完工批次' : emptyText}
            </div>
          )}
        </Card>
      </section>
      <Card
        size="small"
        title="近 7 日批次报工"
        className={styles.panelCard}
        extra={
          <Text type="secondary">{station || '全部工站'} · 按单位分别统计</Text>
        }
      >
        <p className={styles.panelNote}>
          正常报工为各工序批次数量合计，不是成品产量；末站数量是其中一部分，返工不计为新增产品。此处不随部门、工单筛选变化。
        </p>
        <Table<DailySummary>
          size="small"
          rowKey="key"
          columns={dailyColumns}
          dataSource={daily}
          pagination={
            daily.length > 14 ? { pageSize: 14, showSizeChanger: false } : false
          }
          locale={{ emptyText }}
          scroll={{ x: 760 }}
        />
      </Card>
    </div>
  );
};

export default OperationsReport;
