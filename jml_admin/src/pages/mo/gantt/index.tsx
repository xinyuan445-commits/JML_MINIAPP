import {
  ApartmentOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Bar } from '@ant-design/plots';
import {
  Button,
  Card,
  DatePicker,
  Pagination,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { getDashboardGanttData } from '../service';
import styles from './index.less';

const { RangePicker } = DatePicker;
const { Paragraph, Text, Title } = Typography;
const Y_PLAN = '|p';
const Y_EXEC = '|e';
const AUTO_REFRESH_MS = 2 * 60 * 1000;
const PAGE_SIZE = 15;

type GanttItem = {
  y: string;
  type: 'planned' | 'done' | 'processing' | 'pending' | 'unstarted';
  name: string;
  start: string;
  end: string;
  seq?: number;
  inv_name?: string;
  dept_name?: string;
  qty?: number;
  range_source?: 'plan' | 'execution';
};

type WorkOrderStatus = 'done' | 'processing' | 'pending' | 'unstarted';

type WorkOrderOverview = {
  id: string;
  status: WorkOrderStatus;
  overdue: boolean;
};

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  planned: { label: '计划日期', color: '#2457d6' },
  done: { label: '已完工', color: '#20b486' },
  processing: { label: '进行中', color: '#f59e0b' },
  pending: { label: '待开工', color: '#8b95a7' },
  unstarted: { label: '未开工', color: '#cbd3df' },
};

function defaultRange(): [Dayjs, Dayjs] {
  const today = dayjs();
  return [today.subtract(29, 'day'), today.add(14, 'day')];
}

const GanttPage: React.FC = () => {
  const [range, setRange] = useState<[Dayjs, Dayjs]>(defaultRange);
  const [allData, setAllData] = useState<GanttItem[]>([]);
  const [woOptions, setWoOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [selectedWos, setSelectedWos] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [fallbackCount, setFallbackCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Dayjs | null>(null);

  const startStr = range[0].format('YYYY-MM-DD');
  const endStr = range[1].format('YYYY-MM-DD');

  useEffect(() => {
    setSelectedWos([]);
    setStatusFilter('all');
    setPage(1);
  }, [startStr, endStr]);

  useEffect(() => {
    setPage(1);
  }, [selectedWos, statusFilter]);

  useEffect(() => {
    setLoading(true);
    getDashboardGanttData({ start: startStr, end: endStr })
      .then((response) => {
        if (response.code === 0) {
          setAllData(response.data ?? []);
          setWoOptions(response.wo_options ?? []);
          setFallbackCount(Number(response.meta?.fallback_count ?? 0));
          setLastUpdated(dayjs());
        }
      })
      .finally(() => setLoading(false));
  }, [startStr, endStr, refreshKey]);

  useEffect(() => {
    const timer = setInterval(
      () => setRefreshKey((key) => key + 1),
      AUTO_REFRESH_MS,
    );
    return () => clearInterval(timer);
  }, []);

  const workOrders = useMemo<WorkOrderOverview[]>(() => {
    const groups = new Map<
      string,
      { planEnd?: string; executions: GanttItem[] }
    >();
    allData.forEach((item) => {
      const id = item.y.replace(/\|[pe]$/, '');
      const group = groups.get(id) ?? { executions: [] };
      if (item.y.endsWith(Y_PLAN)) group.planEnd = item.end;
      if (item.y.endsWith(Y_EXEC)) group.executions.push(item);
      groups.set(id, group);
    });

    return Array.from(groups.entries()).map(([id, group]) => {
      let status: WorkOrderStatus = 'pending';
      if (
        group.executions.length === 0 ||
        group.executions.every((item) => item.type === 'unstarted')
      ) {
        status = 'unstarted';
      } else if (group.executions.every((item) => item.type === 'done')) {
        status = 'done';
      } else if (group.executions.some((item) => item.type === 'processing')) {
        status = 'processing';
      }
      return {
        id,
        status,
        overdue:
          status !== 'done' &&
          Boolean(
            group.planEnd && dayjs(group.planEnd).isBefore(dayjs(), 'day'),
          ),
      };
    });
  }, [allData]);

  const matchedWorkOrders = useMemo(
    () =>
      workOrders.filter((item) => {
        if (selectedWos.length > 0 && !selectedWos.includes(item.id)) {
          return false;
        }
        if (statusFilter === 'overdue') return item.overdue;
        if (statusFilter !== 'all') return item.status === statusFilter;
        return true;
      }),
    [selectedWos, statusFilter, workOrders],
  );

  const visibleWorkOrders = useMemo(
    () => matchedWorkOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [matchedWorkOrders, page],
  );

  const filteredData = useMemo(() => {
    const visibleIds = new Set(visibleWorkOrders.map((item) => item.id));
    return allData.filter((item) =>
      visibleIds.has(item.y.replace(/\|[pe]$/, '')),
    );
  }, [allData, visibleWorkOrders]);

  const chartData = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD');
    const planDates: Record<string, { start: string; end: string }> = {};
    filteredData.forEach((item) => {
      if (item.y.endsWith(Y_PLAN)) {
        planDates[item.y.slice(0, -2)] = {
          start: item.start,
          end: item.end,
        };
      }
    });

    const groups: Record<string, GanttItem[]> = {};
    filteredData.forEach((item) => {
      if (!groups[item.y]) groups[item.y] = [];
      groups[item.y].push(item);
    });

    const result: (GanttItem & {
      startDate: Date;
      endDate: Date;
    })[] = [];

    Object.entries(groups).forEach(([y, items]) => {
      if (!y.endsWith(Y_EXEC)) {
        items.forEach((item) => {
          const end =
            item.end <= item.start
              ? dayjs(item.start).add(1, 'day').format('YYYY-MM-DD')
              : item.end;
          result.push({
            ...item,
            end,
            startDate: new Date(item.start),
            endDate: new Date(end),
          });
        });
        return;
      }

      const plan = planDates[y.slice(0, -2)];
      const sorted = [...items].sort(
        (left, right) => (left.seq ?? 0) - (right.seq ?? 0),
      );
      const actual = sorted.filter(
        (item) => item.type === 'done' || item.type === 'processing',
      );
      const waiting = sorted.filter(
        (item) => item.type !== 'done' && item.type !== 'processing',
      );

      if (actual.length === 0) {
        waiting.forEach((item) => {
          const end =
            item.end <= item.start
              ? dayjs(item.start).add(1, 'day').format('YYYY-MM-DD')
              : item.end;
          result.push({
            ...item,
            end,
            startDate: new Date(item.start),
            endDate: new Date(end),
          });
        });
        return;
      }

      let cursor = '';
      actual.forEach((item) => {
        const actualEnd =
          item.end <= item.start
            ? dayjs(item.start).add(1, 'day').format('YYYY-MM-DD')
            : item.end;
        const visibleStart =
          cursor && item.start < cursor ? cursor : item.start;
        const visibleEnd =
          actualEnd <= visibleStart
            ? dayjs(visibleStart).add(1, 'day').format('YYYY-MM-DD')
            : actualEnd;
        result.push({
          ...item,
          startDate: new Date(visibleStart),
          endDate: new Date(visibleEnd),
        });
        cursor = visibleEnd;
      });

      if (waiting.length > 0) {
        const slotStart = cursor > today ? cursor : today;
        const remainingDays = dayjs(plan?.end ?? today).diff(
          dayjs(slotStart),
          'day',
        );
        const slotDays = Math.max(
          1,
          Math.floor(remainingDays / waiting.length),
        );
        let slotCursor = slotStart;
        waiting.forEach((item) => {
          const visibleEnd = dayjs(slotCursor)
            .add(slotDays, 'day')
            .format('YYYY-MM-DD');
          result.push({
            ...item,
            startDate: new Date(slotCursor),
            endDate: new Date(visibleEnd),
          });
          slotCursor = visibleEnd;
        });
      }
    });
    return result;
  }, [filteredData]);

  const chartHeight = Math.max(
    360,
    new Set(chartData.map((item) => item.y)).size * 38 + 90,
  );
  const processingCount = matchedWorkOrders.filter(
    (item) => item.status === 'processing',
  ).length;
  const overdueCount = matchedWorkOrders.filter((item) => item.overdue).length;
  const unstartedCount = matchedWorkOrders.filter(
    (item) => item.status === 'unstarted',
  ).length;

  const config = {
    data: chartData,
    xField: 'y',
    yField: ['startDate', 'endDate'] as [string, string],
    colorField: 'type',
    scale: {
      y: { type: 'time' as const },
      color: {
        domain: Object.keys(TYPE_MAP),
        range: Object.values(TYPE_MAP).map((item) => item.color),
      },
    },
    axis: {
      x: {
        labelFormatter: (value: unknown) => {
          const text = String(value);
          if (text.endsWith(Y_PLAN)) return `${text.slice(0, -2)}  计划`;
          if (text.endsWith(Y_EXEC)) return `${text.slice(0, -2)}  执行`;
          return text;
        },
      },
      y: {
        title: false,
        labelFormatter: (value: Date) => dayjs(value).format('MM/DD'),
      },
    },
    style: { inset: 2, radius: 3 },
    label: {
      text: (item: GanttItem) =>
        item.type === 'done' || item.type === 'processing' ? item.name : '',
      position: 'inside' as const,
      style: { fill: '#fff', fontSize: 11, fontWeight: 600 },
    },
    legend: {
      color: {
        itemMarker: 'square',
        labelFormatter: (value: string) => TYPE_MAP[value]?.label ?? value,
      },
    },
    tooltip: {
      items: [
        (item: GanttItem) => ({
          name: '工单',
          value: item.y.replace(/\|[pe]$/, ''),
        }),
        (item: GanttItem) => ({ name: '内容', value: item.name }),
        (item: GanttItem) => ({ name: '开始', value: item.start }),
        (item: GanttItem) => ({ name: '结束', value: item.end }),
        (item: GanttItem) =>
          item.inv_name ? { name: '产品', value: item.inv_name } : null,
      ].filter(Boolean),
    },
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <Text className={styles.eyebrow}>计划执行对照</Text>
          <Title level={2} className={styles.title}>
            工单甘特图
          </Title>
          <Paragraph className={styles.description}>
            每个工单分为计划与执行两行，便于判断进度、未开工和计划逾期。
          </Paragraph>
        </div>
        <Space wrap>
          {lastUpdated && (
            <Text type="secondary">{lastUpdated.format('HH:mm:ss')} 更新</Text>
          )}
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            刷新
          </Button>
        </Space>
      </section>

      <section className={styles.metrics}>
        <Card className={styles.metricCard}>
          <Statistic
            title="当前显示工单"
            value={matchedWorkOrders.length}
            suffix="条"
            prefix={<ApartmentOutlined />}
          />
        </Card>
        <Card className={styles.metricCard}>
          <Statistic
            title="进行中"
            value={processingCount}
            suffix="条"
            prefix={<ClockCircleOutlined />}
          />
        </Card>
        <Card className={styles.metricCard}>
          <Statistic
            title="计划已逾期"
            value={overdueCount}
            suffix="条"
            prefix={<WarningOutlined />}
          />
        </Card>
        <Card className={styles.metricCard}>
          <Statistic
            title="尚未开工"
            value={unstartedCount}
            suffix="条"
            prefix={<CheckCircleOutlined />}
          />
        </Card>
      </section>

      <Card className={styles.chartCard}>
        <div className={styles.toolbar}>
          <div className={styles.filters}>
            <RangePicker
              value={range}
              allowClear={false}
              onChange={(value) =>
                value?.[0] && value?.[1] && setRange([value[0], value[1]])
              }
            />
            <Select
              mode="multiple"
              placeholder="筛选工单（默认全部）"
              value={selectedWos}
              onChange={setSelectedWos}
              options={woOptions}
              className={styles.workOrderSelect}
              maxTagCount="responsive"
              allowClear
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              className={styles.statusSelect}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'processing', label: '进行中' },
                { value: 'overdue', label: '计划已逾期' },
                { value: 'unstarted', label: '尚未开工' },
                { value: 'pending', label: '等待开工' },
                { value: 'done', label: '已完成' },
              ]}
            />
          </div>
          <Space wrap>
            {fallbackCount > 0 && (
              <Tag color="orange">
                {fallbackCount} 条暂无 U8 计划，显示执行范围
              </Tag>
            )}
            <Tag color="blue">
              {range[0].format('MM-DD')} 至 {range[1].format('MM-DD')}
            </Tag>
          </Space>
        </div>

        {chartData.length > 0 ? (
          <>
            <div className={styles.chartScroller}>
              <Bar {...config} height={chartHeight} />
            </div>
            <div className={styles.pagination}>
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={matchedWorkOrders.length}
                showSizeChanger={false}
                showTotal={(total, rangeValue) =>
                  `第 ${rangeValue[0]}-${rangeValue[1]} 条 / 共 ${total} 条`
                }
                onChange={setPage}
              />
            </div>
          </>
        ) : (
          <div className={styles.empty}>当前条件下暂无工单</div>
        )}
      </Card>
    </div>
  );
};

export default GanttPage;
