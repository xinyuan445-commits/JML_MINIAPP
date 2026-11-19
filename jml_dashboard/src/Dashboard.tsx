import MoonOutlined from '@ant-design/icons/MoonOutlined';
import SunOutlined from '@ant-design/icons/SunOutlined';
import { Tooltip } from 'antd';
import dayjs from 'dayjs';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './dashboard.module.less';
import {
  buildDashboardView,
  chunks,
  knownUnit,
  stepAnomalies,
  stepLabel,
  stepState,
} from './model';
import type {
  DashboardOperations,
  DashboardOrder,
  DashboardStep,
} from './service';
import { getDashboardOperations } from './service';

const REFRESH_MS = 120000;
const THEME_KEY = 'production-dashboard-theme';
const DISPLAY_MODE_KEY = 'production-dashboard-display-mode';
const AUTO_SCROLL_INTERVAL_MS = 40;
const PROCESS_ROW_HEIGHT = 92;
type DisplayMode = 'page' | 'scroll';
const emptyData: DashboardOperations = {
  generated_at: '',
  today: '',
  orders: [],
  daily: [],
  warnings: [],
};

const numberText = (value: number | null) =>
  value == null
    ? '—'
    : value.toLocaleString('zh-CN', { maximumFractionDigits: 4 });

const customerText = (order: DashboardOrder) =>
  order.customer_name?.trim() || '未关联客户';

const dueText = (value?: string | null) =>
  value ? dayjs(value).format('MM-DD') : '未排期';

const activityText = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '暂无';

type ProcessSelection = {
  order: DashboardOrder;
  step: DashboardStep;
  anomalies: string[];
};

const ScreenClock = () => {
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <time
      className={styles.clock}
      aria-label="当前时间"
    >
      {now.format('YYYY-MM-DD HH:mm:ss')}
    </time>
  );
};

function stateLabel(step: DashboardStep) {
  return stepLabel(step);
}

function stateQuantity(step: DashboardStep, unit?: string | null) {
  const state = stepState(step);
  const suffix = knownUnit(unit) ? unit : '';
  if (state === 'work') {
    if (step.normal_received_qty == null) return '';
    return `${numberText(step.normal_done_qty)}/${numberText(
      step.normal_received_qty,
    )}${suffix}`;
  }
  if (state === 'done') return `${numberText(step.normal_done_qty)}${suffix}`;
  if (state === 'rework')
    return `${numberText(step.rework_remaining_qty)}${suffix}`;
  if (state === 'ready')
    return `${numberText(step.receive_available_qty)}${suffix}`;
  if (state === 'received')
    return `${numberText(step.normal_remaining_qty)}${suffix}`;
  return '';
}

function receiveCalculation(order: DashboardOrder, step: DashboardStep) {
  const calculation = step.first_issue_calculation;
  if (calculation?.mode === 'panel_area' && step.first_issued_qty != null) {
    return (
      <div className={styles.receiveCalculation}>
        <strong>拼皮领料面积折算</strong>
        {(calculation.materials || []).map((material, index) => (
          <span key={`${material.sub_code}:${index}`}>
            {material.sub_code} · 已领 {numberText(material.qty_issued)} / 应领 {numberText(material.qty_plan)} ㎡
          </span>
        ))}
        <span>
          计划 {numberText(order.plan_qty)} 张 × 已领 {numberText(calculation.issued_area ?? null)}
          {' ÷ 应领 '}{numberText(calculation.required_area ?? null)} ㎡
        </span>
        <span>实领折算 {numberText(step.first_issued_qty)} 张</span>
        <span>
          减已接收 {numberText(step.normal_received_qty || 0)} 张，可接收 {numberText(step.receive_available_qty)} 张
        </span>
      </div>
    );
  }
  if (calculation?.mode !== 'bom_ratio' || step.first_issued_qty == null)
    return null;
  const ratio = calculation.bottleneck_ratio;
  const received = step.normal_received_qty || 0;
  return (
    <div className={styles.receiveCalculation}>
      <strong>可接收数量计算</strong>
      <span>
        计划 {numberText(order.plan_qty)} × 最低领料比例{' '}
        {ratio == null ? '—' : `${numberText(ratio * 100)}%`} = 折算领料{' '}
        {numberText(step.first_issued_qty)}
      </span>
      <span>
        可接收 = {numberText(step.first_issued_qty)} − 已接收{' '}
        {numberText(received)} = {numberText(step.receive_available_qty)}
      </span>
      <span>最低比例物料：{calculation.bottleneck_inv_code || '—'}</span>
      <span>
        已领 {numberText(calculation.bottleneck_issued_qty ?? null)} ÷ 应领{' '}
        {numberText(calculation.bottleneck_required_qty ?? null)}
        {calculation.material_count
          ? `（共 ${calculation.material_count} 条物料，单项最高按 100%）`
          : ''}
      </span>
    </div>
  );
}

function workTimeLines(step: DashboardStep) {
  if (!step.first_start_time) return [];
  const start = dayjs(step.first_start_time);
  const state = stepState(step);
  if (state === 'work' || state === 'received' || state === 'rework')
    return [`${start.format('MM-DD HH:mm')} → 进行中`];
  if (!step.last_end_time) return [`${start.format('MM-DD HH:mm')} → —`];
  const end = dayjs(step.last_end_time);
  return start.isSame(end, 'day')
    ? [`${start.format('MM-DD HH:mm')} → ${end.format('HH:mm')}`]
    : [`始 ${start.format('MM-DD HH:mm')}`, `终 ${end.format('MM-DD HH:mm')}`];
}

const ProcessCell = ({
  order,
  step,
  anomalies,
  unit,
  onSelect,
}: {
  order: DashboardOrder;
  step?: DashboardStep;
  anomalies: string[];
  unit?: string | null;
  onSelect: (selection: ProcessSelection) => void;
}) => {
  if (!step)
    return (
      <div className={[styles.processCell, styles.notInRoute].join(' ')}>
        <span>—</span>
      </div>
    );

  const state = stepState(step);
  const workTime = workTimeLines(step);
  return (
    <button
      type="button"
      className={[
        styles.processCell,
        styles[state],
        anomalies.length ? styles.anomaly : '',
      ].join(' ')}
      data-state={state}
      data-anomaly={anomalies.length ? 'true' : undefined}
      aria-label={`查看${step.process_name}详情`}
      onClick={() => onSelect({ order, step, anomalies })}
    >
      {anomalies.length > 0 && <i className={styles.anomalyBadge}>异常</i>}
      <div className={styles.processName}>{step.process_name}</div>
      <div className={styles.processStatus}>
        <strong>{stateLabel(step)}</strong>
        <span>{stateQuantity(step, unit)}</span>
      </div>
      {state === 'rework' && step.normal_remaining_qty ? (
        <small className={styles.normalPending}>
          正常待完 {numberText(step.normal_remaining_qty)}
        </small>
      ) : null}
      {workTime.length > 0 && (
        <small className={styles.processTime}>
          {workTime.map((line) => <span key={line}>{line}</span>)}
        </small>
      )}
    </button>
  );
};

const OrderRow = ({
  order,
  processCount,
  onSelectStep,
}: {
  order: DashboardOrder;
  processCount: number;
  onSelectStep: (selection: ProcessSelection) => void;
}) => {
  const orderedSteps = [...order.steps].sort((a, b) => a.seq - b.seq);
  const hasRework = order.steps.some(
    (step) => step.rework_remaining_qty > 0,
  );

  return (
    <article
      className={[
        styles.orderRow,
        hasRework ? styles.reworkRow : '',
        order.erp_deleted ? styles.deletedRow : '',
      ].join(' ')}
      style={{
        gridTemplateColumns: `minmax(210px, 1.15fr) minmax(240px, 1.45fr) 92px 105px 105px repeat(${processCount}, minmax(130px, 1fr))`,
      }}
      aria-label={`${customerText(order)} ${order.mo_code} 第${order.sort_seq}行`}
    >
      <div className={styles.orderIdentity}>
        <div className={styles.orderTitle}>
          <strong className={styles.orderCode}>
            {order.mo_code} · 第 {order.sort_seq} 行
          </strong>
          {order.erp_deleted && (
            <i className={styles.deletedBadge}>系统已删除</i>
          )}
          {order.is_closed && <i className={styles.closedBadge}>已关闭</i>}
          {order.has_reporting === false && (
            <i className={styles.unreportedBadge}>未报工</i>
          )}
        </div>
        <span
          className={[
            styles.customerName,
            customerText(order) === '待核对' ||
            customerText(order) === '未关联客户'
              ? styles.customerWarning
              : '',
          ].join(' ')}
        >
          {customerText(order)}
        </span>
      </div>
      <div className={styles.productCell}>
        <strong>
          {order.inv_name ||
            order.inv_code ||
            (order.erp_deleted ? '工单资料已删除' : '产品待补')}
        </strong>
        <div className={styles.productMeta}>
          <span>{order.inv_code || '—'}</span>
          <span>{order.inv_std || '—'}</span>
        </div>
      </div>
      <div className={styles.quantityCell}>
        <strong>{numberText(order.plan_qty)}</strong>
        <span>{knownUnit(order.unit_name) ? order.unit_name : ''}</span>
      </div>
      <div className={styles.startCell}>
        <strong>{dueText(order.plan_start_date)}</strong>
        {order.original_start_date && (
          <small className={styles.originalDate}>原 {dueText(order.original_start_date)}</small>
        )}
      </div>
      <div
        className={[styles.dueCell, order.original_due_date ? styles.hasOriginalDate : ''].join(' ')}
      >
        <strong>{dueText(order.plan_due_date)}</strong>
        {order.original_due_date && (
          <small className={styles.originalDate}>原 {dueText(order.original_due_date)}</small>
        )}
        {order.is_overdue && <i className={styles.overdueBadge}>逾期</i>}
      </div>
      {Array.from({ length: processCount }, (_, index) => (
        <ProcessCell
          key={index}
          order={order}
          step={orderedSteps[index]}
          anomalies={stepAnomalies(order, orderedSteps, index)}
          unit={order.unit_name}
          onSelect={onSelectStep}
        />
      ))}
    </article>
  );
};

const Kpi = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'blue' | 'amber' | 'red';
}) => (
  <div className={[styles.kpi, tone ? styles[tone] : ''].join(' ')}>
    <span>{label}</span>
    <strong>{value}</strong>
    <small>项</small>
  </div>
);

const DashboardPage: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    window.localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark',
  );
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() =>
    window.localStorage.getItem(DISPLAY_MODE_KEY) === 'scroll'
      ? 'scroll'
      : 'page',
  );
  const [data, setData] = useState<DashboardOperations | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [screenSize, setScreenSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const [matrixHeight, setMatrixHeight] = useState(0);
  const [selection, setSelection] = useState<ProcessSelection | null>(null);
  const matrixRef = useRef<HTMLElement>(null);
  const orderRowsRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const lastSuccess = useRef(0);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await getDashboardOperations();
      if (!mounted.current) return;
      if (result.code !== 0 || !result.data) throw new Error('看板读取失败');
      setData(result.data);
      setFailed(false);
      lastSuccess.current = Date.now();
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const refreshVisible = () => {
      if (!document.hidden && Date.now() - lastSuccess.current >= REFRESH_MS)
        void refresh();
    };
    const refreshTimer = window.setInterval(refreshVisible, REFRESH_MS);
    const resize = () =>
      setScreenSize({ width: window.innerWidth, height: window.innerHeight });
    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('resize', resize);
    return () => {
      mounted.current = false;
      window.clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', refreshVisible);
      window.removeEventListener('resize', resize);
    };
  }, [refresh]);

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(DISPLAY_MODE_KEY, displayMode);
    setRotation(0);
    if (orderRowsRef.current) orderRowsRef.current.scrollTop = 0;
  }, [displayMode]);

  useEffect(() => {
    const element = matrixRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setMatrixHeight(entry.contentRect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selection) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelection(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [selection]);

  const dashboardData = useMemo(() => {
    const source = data || emptyData;
    if (showClosed) return source;
    return {
      ...source,
      orders: source.orders.filter((order) => !order.is_closed),
    };
  }, [data, showClosed]);
  const view = useMemo(() => buildDashboardView(dashboardData), [dashboardData]);

  useEffect(() => {
    const element = orderRowsRef.current;
    if (!element || displayMode !== 'scroll' || selection) return;
    const timer = window.setInterval(() => {
      const maximum = element.scrollHeight - element.clientHeight;
      if (!document.hidden && maximum > 0) {
        const next = element.scrollTop + 1;
        element.scrollTop = next >= maximum ? 0 : next;
      }
    }, AUTO_SCROLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [displayMode, selection, view.orders.length]);

  const handleExport = async () => {
    if (exporting || !view.orders.length) return;
    setExporting(true);
    setExportFailed(false);
    try {
      const { exportDashboardExcel } = await import('./exportExcel');
      await exportDashboardExcel(view.orders);
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };
  const processCount = Math.max(
    1,
    ...view.orders.map((order) => order.steps.length),
  );
  const availableHeight =
    matrixHeight || Math.max(320, screenSize.height - 210);
  const rowCount = Math.max(
    1,
    Math.floor((availableHeight - 48) / PROCESS_ROW_HEIGHT),
  );

  const frames = useMemo(() => {
    const orderPages = chunks(view.orders, rowCount);
    return orderPages.map((orders) => ({ orders }));
  }, [view.orders, rowCount]);

  const frame = frames[rotation % Math.max(1, frames.length)];
  const displayedOrders =
    displayMode === 'scroll' ? view.orders : frame?.orders || [];
  const today = data?.today ? dayjs(data.today) : dayjs();
  const dueToday = view.orders.filter(
    (order) =>
      order.plan_due_date && dayjs(order.plan_due_date).isSame(today, 'day'),
  ).length;
  const selectedReceiveCalculation = selection
    ? receiveCalculation(selection.order, selection.step)
    : null;
  const overdue = view.orders.filter((order) => order.is_overdue).length;
  const rework = view.orders.filter((order) =>
    order.steps.some((step) => step.rework_remaining_qty > 0),
  ).length;

  const emptyText = data
    ? '当前没有在制工单'
    : failed
      ? '暂未取得数据，正在重试'
      : '正在读取生产记录…';

  return (
    <main
      className={[styles.page, theme === 'light' ? styles.lightTheme : ''].join(' ')}
      aria-label="生产现场大屏"
    >
      <header className={styles.header}>
        <h1>生产现场看板</h1>
        <div className={styles.headerActions}>
          <label className={styles.displayMode}>
            <span>展示方式</span>
            <select
              aria-label="展示方式"
              value={displayMode}
              onChange={(event) =>
                setDisplayMode(event.target.value as DisplayMode)
              }
            >
              <option value="page">翻页</option>
              <option value="scroll">自动循环滚动</option>
            </select>
          </label>
          <button
            type="button"
            className={styles.exportButton}
            disabled={exporting || !view.orders.length}
            onClick={handleExport}
          >
            {exporting ? '正在导出…' : '导出 Excel'}
          </button>
          <button
            type="button"
            className={styles.closedToggle}
            role="switch"
            aria-checked={showClosed}
            onClick={() => setShowClosed((value) => !value)}
          >
            <span className={styles.toggleTrack}><i /></span>
            <em>显示已关闭</em>
          </button>
          <button
            type="button"
            className={styles.themeToggle}
            aria-label={`切换到${theme === 'dark' ? '浅色' : '深色'}主题`}
            title={`切换到${theme === 'dark' ? '浅色' : '深色'}主题`}
            onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
          </button>
          <ScreenClock />
        </div>
      </header>

      <section className={styles.kpis} aria-label="生产概况">
        <Kpi label="在制工单" value={view.orders.length} tone="blue" />
        <Kpi label="今日计划完工" value={dueToday} tone="amber" />
        <Kpi label="逾期工单" value={overdue} tone="red" />
        <Kpi label="返工待完" value={rework} tone="red" />
      </section>

      <section
        ref={matrixRef}
        className={styles.matrix}
        aria-label="工单工序进度矩阵"
      >
        {displayedOrders.length ? (
          <>
            <div
              className={styles.matrixHeader}
              style={{
                gridTemplateColumns: `minmax(210px, 1.15fr) minmax(240px, 1.45fr) 92px 105px 105px repeat(${processCount}, minmax(130px, 1fr))`,
              }}
            >
              <span>工单 / 客户</span>
              <span>产品</span>
              <span>计划数量</span>
              <span>计划开工</span>
              <span>计划完工</span>
              {Array.from({ length: processCount }, (_, index) => (
                <strong key={index}>工序{index + 1}</strong>
              ))}
            </div>
            <div
              ref={orderRowsRef}
              className={[
                styles.orderRows,
                displayMode === 'scroll' ? styles.orderRowsAuto : '',
              ].join(' ')}
            >
              {displayedOrders.map((order) => (
                <OrderRow
                  key={`${order.mo_code}:${order.sort_seq}:${order.route_id}`}
                  order={order}
                  processCount={processCount}
                  onSelectStep={setSelection}
                />
              ))}
            </div>
          </>
        ) : (
          <div className={styles.empty}>{emptyText}</div>
        )}
      </section>

      <footer className={styles.footer}>
        <div className={styles.legend}>
          <span><i className={styles.doneDot} />已完成</span>
          <span><i className={styles.workDot} />生产中</span>
          <span><i className={styles.waitDot} />等待处理</span>
          <span><i className={styles.errorDot} />返工</span>
          <span><i className={styles.anomalyDot} />数据异常</span>
          <span><i className={styles.pendingDot} />未开始</span>
        </div>
        <div>
          {exportFailed && <span className={styles.failure}>导出失败，请重试</span>}
          {failed && <span className={styles.failure}>数据刷新失败，正在重试</span>}
          {displayMode === 'page' ? (
            <div className={styles.pager}>
              <button
                type="button"
                disabled={frames.length <= 1}
                onClick={() =>
                  setRotation((value) =>
                    (value - 1 + Math.max(1, frames.length)) %
                    Math.max(1, frames.length),
                  )
                }
              >
                上一页
              </button>
              <span>
                {frames.length ? (rotation % frames.length) + 1 : 1} /{' '}
                {Math.max(1, frames.length)}
              </span>
              <button
                type="button"
                disabled={frames.length <= 1}
                onClick={() =>
                  setRotation(
                    (value) => (value + 1) % Math.max(1, frames.length),
                  )
                }
              >
                下一页
              </button>
            </div>
          ) : (
            <span className={styles.autoScrollStatus}>
              自动循环 · 共 {view.orders.length} 条
            </span>
          )}
        </div>
      </footer>

      {selection && (
        <div
          className={styles.detailMask}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelection(null);
          }}
        >
          <section
            className={styles.detailPanel}
            role="dialog"
            aria-modal="true"
            aria-label="工序详情"
          >
            <header>
              <div>
                <span>工序 {selection.step.seq}</span>
                <h2>{selection.step.process_name}</h2>
              </div>
              <button
                type="button"
                aria-label="关闭工序详情"
                onClick={() => setSelection(null)}
              >
                ×
              </button>
            </header>
            <div className={styles.detailOrder}>
              <strong>
                {selection.order.mo_code} · 第 {selection.order.sort_seq} 行
              </strong>
              <span>{selection.order.inv_name || selection.order.inv_code || '—'}</span>
            </div>
            {selection.anomalies.length > 0 && (
              <div className={styles.detailAnomaly}>
                <strong>数据异常</strong>
                {selection.anomalies.map((item) => <span key={item}>{item}</span>)}
              </div>
            )}
            <div className={styles.detailGrades} aria-label="完工等级数量">
              {[
                ['合计', selection.step.normal_done_qty],
                ['A', selection.step.qty_a],
                ['A1', selection.step.qty_a1],
                ['A2', selection.step.qty_a2],
                ['C', selection.step.qty_c],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{numberText(value as number)}</strong>
                </div>
              ))}
            </div>
            <div className={styles.detailGrid}>
              <span>当前状态</span><strong>{stateLabel(selection.step)}</strong>
              <span>工站</span><strong>{selection.step.station_name || '未指定'}</strong>
              <span>累计接收</span><strong>{numberText(selection.step.normal_received_qty)}</strong>
              <span>正常待完</span><strong>{numberText(selection.step.normal_remaining_qty)}</strong>
              <span>可接收</span>
              {selectedReceiveCalculation ? (
                <Tooltip
                  title={selectedReceiveCalculation}
                  styles={{ root: { maxWidth: 460 } }}
                >
                  <button
                    type="button"
                    className={styles.calculatedQuantity}
                    aria-label="查看可接收数量计算"
                  >
                    {numberText(selection.step.receive_available_qty)}
                  </button>
                </Tooltip>
              ) : (
                <strong>{numberText(selection.step.receive_available_qty)}</strong>
              )}
              <span>接收作业中</span><strong>{numberText(selection.step.receiving_qty)}</strong>
              <span>返工待完</span><strong>{numberText(selection.step.rework_remaining_qty)}</strong>
              <span>开工人员</span><strong>{selection.step.workers.join('、') || '暂无'}</strong>
              <span>返工人员</span><strong>{selection.step.rework_workers.join('、') || '暂无'}</strong>
              <span>最近记录</span><strong>{activityText(selection.step.last_activity)}</strong>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};

export default DashboardPage;
