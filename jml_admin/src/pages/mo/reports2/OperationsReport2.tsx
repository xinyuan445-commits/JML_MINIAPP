import { ReloadOutlined } from '@ant-design/icons';
import { history, useAccess } from '@umijs/max';
import type { TableColumnsType } from 'antd';
import { Alert, Button, Progress, Table, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ThemeModeButton } from '@/components/ThemeMode';
import {
  completionPercent,
  type FlowState,
  knownUnit,
  stepAnomalies,
  stepState,
} from '../dashboard/model';
import type {
  DashboardOperations,
  DashboardOrder,
  DashboardStep,
} from '../dashboard/service';
import { getDashboardOperations } from '../dashboard/service';
import styles from './OperationsReport2.less';

const { Text, Title } = Typography;
const AUTO_REFRESH_MS = 2 * 60 * 1000;
const orderKey = (order: DashboardOrder) =>
  `${order.mo_code}__${order.sort_seq}`;
const stationLabel = (step: DashboardStep) => step.station_name || '未标工站';
const numberText = (value: number | null | undefined) =>
  value == null
    ? '待核实'
    : value.toLocaleString('zh-CN', { maximumFractionDigits: 4 });
const timeText = (value?: string | null) =>
  value && dayjs(value).isValid() ? dayjs(value).format('MM-DD HH:mm') : '—';
const flowStateLabels: Record<FlowState, string> = {
  done: '已完成',
  work: '生产中',
  received: '待开工',
  ready: '待接收',
  rework: '返工',
  pending: '未开始',
  unknown: '待核对',
};

function stepQuantity(step: DashboardStep, unit?: string | null) {
  const suffix = knownUnit(unit) ? unit?.trim() : '';
  const state = stepState(step);
  if (state === 'work')
    return `${numberText(step.normal_done_qty)}/${numberText(step.normal_received_qty)}${suffix}`;
  if (state === 'done') return `${numberText(step.normal_done_qty)}${suffix}`;
  if (state === 'rework')
    return `返 ${numberText(step.rework_remaining_qty)}${suffix}`;
  if (state === 'ready')
    return `可接 ${numberText(step.receive_available_qty)}${suffix}`;
  if (state === 'received')
    return `待完 ${numberText(step.normal_remaining_qty)}${suffix}`;
  return '—';
}

function stepElapsedMinutes(step: DashboardStep) {
  if (!step.first_start_time || !dayjs(step.first_start_time).isValid())
    return null;
  const state = stepState(step);
  const active = ['work', 'received', 'rework'].includes(state);
  if (!active && (!step.last_end_time || !dayjs(step.last_end_time).isValid()))
    return null;
  const start = dayjs(step.first_start_time);
  const end = active ? dayjs() : dayjs(step.last_end_time);
  return Math.max(0, end.diff(start, 'minute'));
}

function durationAmount(totalMinutes: number) {
  const roundedMinutes = Math.round(totalMinutes * 10) / 10;
  const days = Math.floor(roundedMinutes / 1440);
  const hours = Math.floor((roundedMinutes % 1440) / 60);
  const minutes = Math.round((roundedMinutes % 60) * 10) / 10;
  return days
    ? `${days}天${hours ? `${hours}时` : ''}`
    : hours
      ? `${hours}时${minutes}分`
      : roundedMinutes
        ? `${minutes}分`
        : '不足1分';
}

function stepDuration(step: DashboardStep) {
  const totalMinutes = stepElapsedMinutes(step);
  if (totalMinutes == null)
    return step.first_start_time ? '用时待核实' : '未开工';
  const active = ['work', 'received', 'rework'].includes(stepState(step));
  const duration = durationAmount(totalMinutes);
  return `${active ? '已用' : '用时'} ${duration}`;
}

function progressValue(percent: number | null) {
  return percent == null ? 0 : Math.min(100, Math.max(0, percent));
}

function timeProgress(step: DashboardStep) {
  const elapsed = stepElapsedMinutes(step);
  const target = step.standard_task_minutes;
  if (step.capacity_state !== 'finite' || target == null || target <= 0)
    return {
      percent: null,
      detail:
        (
          {
            unlimited: '无限产能，不计算',
            inactive: '设备已停用',
            incomplete: '产能资料待补',
          } as Record<string, string>
        )[step.capacity_state || ''] || '未配置标准产能',
    };
  const percent = elapsed == null ? 0 : (elapsed / target) * 100;
  return {
    percent,
    detail: `${elapsed == null ? '未开工' : `实际${durationAmount(elapsed)}`} / 标准${durationAmount(target)}${step.capacity_unit ? `（按${step.capacity_unit}）` : ''}`,
  };
}

function stepTooltip(
  step: DashboardStep,
  unit: string | null | undefined,
  anomalies: string[],
) {
  const quantityPercent = completionPercent(step);
  const taskTime = timeProgress(step);
  return (
    <div className={styles.stepTooltip}>
      <strong>
        {step.seq}. {step.process_name} · {flowStateLabels[stepState(step)]}
      </strong>
      <div className={styles.tooltipProgresses}>
        <div>
          <span>任务数量</span>
          <Progress
            percent={progressValue(quantityPercent)}
            size="small"
            strokeColor="#1677ff"
            railColor="rgb(255 255 255 / 18%)"
            format={() =>
              quantityPercent == null
                ? '待核实'
                : `${Math.round(quantityPercent)}%`
            }
          />
          <small>
            {numberText(step.normal_done_qty)} /{' '}
            {numberText(step.normal_received_qty)} {knownUnit(unit) ? unit : ''}
          </small>
        </div>
        <div>
          <span>任务时间</span>
          <Progress
            percent={progressValue(taskTime.percent)}
            size="small"
            status={
              taskTime.percent != null && taskTime.percent > 100
                ? 'exception'
                : 'normal'
            }
            strokeColor={
              taskTime.percent != null && taskTime.percent > 100
                ? undefined
                : '#faad14'
            }
            railColor="rgb(255 255 255 / 18%)"
            format={() =>
              taskTime.percent == null
                ? '—'
                : `${Math.round(taskTime.percent)}%`
            }
          />
          <small>{taskTime.detail}</small>
        </div>
      </div>
      <dl>
        <div>
          <dt>工站</dt>
          <dd>{stationLabel(step)}</dd>
        </div>
        <div>
          <dt>累计接收</dt>
          <dd>
            {numberText(step.normal_received_qty)} {knownUnit(unit) ? unit : ''}
          </dd>
        </div>
        <div>
          <dt>累计完工</dt>
          <dd>
            {numberText(step.normal_done_qty)} {knownUnit(unit) ? unit : ''}
          </dd>
        </div>
        <div>
          <dt>正常待完</dt>
          <dd>{numberText(step.normal_remaining_qty)}</dd>
        </div>
        <div>
          <dt>还可接收</dt>
          <dd>{numberText(step.receive_available_qty)}</dd>
        </div>
        <div>
          <dt>返工待完</dt>
          <dd>{numberText(step.rework_remaining_qty)}</dd>
        </div>
        <div>
          <dt>首次开工</dt>
          <dd>{timeText(step.first_start_time)}</dd>
        </div>
        <div>
          <dt>末次完工</dt>
          <dd>{timeText(step.last_end_time)}</dd>
        </div>
        <div>
          <dt>工序用时</dt>
          <dd>{stepDuration(step)}</dd>
        </div>
        <div>
          <dt>开工人员</dt>
          <dd>{step.workers.join('、') || '未记录'}</dd>
        </div>
        {step.rework_workers.length > 0 && (
          <div>
            <dt>返工人员</dt>
            <dd>{step.rework_workers.join('、')}</dd>
          </div>
        )}
        <div>
          <dt>最近作业</dt>
          <dd>{timeText(step.last_activity)}</dd>
        </div>
      </dl>
      {anomalies.map((reason) => (
        <p className={styles.tooltipAnomaly} key={reason}>
          异常：{reason}
        </p>
      ))}
    </div>
  );
}

const ProcessFlow = ({
  order,
  expanded,
  onToggle,
}: {
  order: DashboardOrder;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const steps = [...order.steps].sort((a, b) => a.seq - b.seq);
  return (
    <div className={styles.processFlow}>
      {steps.map((step, index) => {
        const state = stepState(step);
        const anomalies = stepAnomalies(order, steps, index);
        const percent = completionPercent(step) ?? (state === 'done' ? 100 : 0);
        return (
          <React.Fragment key={step.seq}>
            {index > 0 && (
              <span className={styles.processConnector} aria-hidden="true" />
            )}
            <Tooltip
              title={stepTooltip(step, order.unit_name, anomalies)}
              classNames={{ root: styles.stepTooltipPopup }}
              getPopupContainer={() => document.body}
            >
              <button
                type="button"
                className={styles.processRing}
                data-state={state}
                data-anomaly={anomalies.length ? 'true' : undefined}
                style={
                  {
                    '--ring-progress': `${percent * 3.6}deg`,
                  } as React.CSSProperties
                }
                onClick={onToggle}
                aria-expanded={expanded}
                aria-label={`${step.process_name}，${flowStateLabels[state]}，${stepQuantity(step, order.unit_name)}${order.is_overdue ? '，工单逾期' : ''}`}
              >
                {order.is_overdue && (
                  <span className={styles.ringOverdueBadge}>逾期</span>
                )}
                <span className={styles.ringContent}>
                  <b>{step.process_name}</b>
                  <strong>{stepQuantity(step, order.unit_name)}</strong>
                  <span className={styles.ringDuration}>
                    {stepDuration(step)}
                  </span>
                </span>
              </button>
            </Tooltip>
          </React.Fragment>
        );
      })}
    </div>
  );
};

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

const OperationsReport2: React.FC = () => {
  const access = useAccess();
  const [data, setData] = useState<DashboardOperations | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const lastFetchAt = useRef(0);

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

  const orders = useMemo(
    () =>
      (data?.orders || [])
        .filter((order) => !order.is_closed)
        .sort(
          (a, b) =>
            Number(b.is_overdue) - Number(a.is_overdue) ||
            Number(b.has_rework) - Number(a.has_rework) ||
            Number(b.has_receivable) - Number(a.has_receivable) ||
            (b.last_activity || '').localeCompare(a.last_activity || '') ||
            a.mo_code.localeCompare(b.mo_code) ||
            a.sort_seq - b.sort_seq,
        ),
    [data],
  );
  const emptyText = !data
    ? loading
      ? '正在获取数据…'
      : '数据未能加载，请重试'
    : '当前没有未关闭工单';
  const openDetails = (order: DashboardOrder) =>
    access.canCompleted &&
    history.push(
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
          {access.canCompleted ? (
            <Button
              type="link"
              className={styles.tableLink}
              onClick={() => openDetails(order)}
            >
              {order.mo_code}
            </Button>
          ) : (
            <span>{order.mo_code}</span>
          )}
          <span className={styles.secondary}> · 第 {order.sort_seq} 行</span>
          {order.erp_deleted && (
            <span className={styles.deletedBadge}>工单资料已删除</span>
          )}
          <div className={styles.secondary}>
            {order.customer_name?.trim() ||
              order.customer_code?.trim() ||
              '未关联客户'}
          </div>
        </>
      ),
    },
    {
      title: '产品',
      key: 'product',
      width: 230,
      render: (_, order) => (
        <div className={styles.product}>
          <strong>
            {order.inv_name ||
              (order.erp_deleted ? '工单资料已删除' : '产品资料待核实')}
          </strong>
          <span>
            {order.inv_code || (order.erp_deleted ? '—' : '编码待核实')}
          </span>
          <span>
            {order.inv_std || (order.erp_deleted ? '—' : '规格未填写')}
          </span>
        </div>
      ),
    },
    {
      title: '计划数量',
      key: 'plan',
      width: 115,
      render: (_, order) => (
        <div className={styles.plan}>
          <strong>
            {numberText(order.plan_qty)}{' '}
            <small>{order.unit_name || '单位待核实'}</small>
          </strong>
        </div>
      ),
    },
    {
      title: '计划完工',
      dataIndex: 'plan_due_date',
      width: 110,
      render: (value: string | null | undefined, order) => (
        <div className={styles.dueDateCell}>
          <strong>{value ? dayjs(value).format('MM-DD') : '未提供'}</strong>
          {order.is_overdue && (
            <span className={styles.overdueBadge}>逾期</span>
          )}
        </div>
      ),
    },
    {
      title: '各工序进度 · 悬停查看，点击展开',
      key: 'steps',
      width: 600,
      render: (_, order) => (
        <ProcessFlow
          order={order}
          expanded={expandedKeys.includes(orderKey(order))}
          onToggle={() => toggleExpanded(order)}
        />
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
          <Title level={3}>生产报表2</Title>
          <Text type="secondary">未关闭工单明细</Text>
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
        {access.canCompleted && (
          <Button type="link" onClick={() => history.push('/board/completed')}>
            完工记录
          </Button>
        )}
        {access.canDashboard && (
          <Button type="link" onClick={() => history.push('/board/production')}>
            返回生产看板
          </Button>
        )}
        {access.canProductionLabel && (
          <Button
            type="link"
            onClick={() => history.push('/mo/production-label')}
          >
            生产标签打印
          </Button>
        )}
        {access.canWorkorder && (
          <Button type="link" onClick={() => history.push('/mo/workorder')}>
            工单路线指定
          </Button>
        )}
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
      <section className={styles.ordersPanel}>
        <div className={styles.panelHeading}>
          <div>
            <h2>生产工单</h2>
            <span className={styles.secondary}>
              {data ? `${orders.length} 行` : '等待数据'} ·
              各工序可同时作业，数量不跨站相加
            </span>
          </div>
          <div className={styles.processLegend}>
            <span>
              <i data-state="done" />
              已完成
            </span>
            <span>
              <i data-state="work" />
              生产中
            </span>
            <span>
              <i data-state="ready" />
              等待处理
            </span>
            <span>
              <i data-state="rework" />
              返工
            </span>
            <span>
              <i data-anomaly="true" />
              数据异常
            </span>
            <span>
              <i data-state="pending" />
              未开始
            </span>
          </div>
        </div>
        <Table<DashboardOrder>
          size="small"
          rowKey={orderKey}
          columns={orderColumns}
          dataSource={orders}
          loading={loading && !data}
          locale={{ emptyText }}
          scroll={{ x: 1420 }}
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
      </section>
    </div>
  );
};

export default OperationsReport2;
