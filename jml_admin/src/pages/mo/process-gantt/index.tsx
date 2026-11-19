import {
  ApartmentOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Bar } from '@ant-design/plots';
import { Button, Card, Select, Space, Statistic, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { getDashboardProcessGantt } from '../service';
import styles from './index.less';

const { Paragraph, Text, Title } = Typography;
const AUTO_REFRESH_MS = 2 * 60 * 1000;

type ProcessExecution = {
  y: string;
  type: 'done' | 'processing';
  start: string;
  end: string;
  qty: number;
  mo_code: string;
  sort_seq: number;
  seq: number;
};

type ChartExecution = ProcessExecution & {
  row: string;
  startDate: Date;
  endDate: Date;
};

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  done: { label: '已完工', color: '#20b486' },
  processing: { label: '进行中', color: '#f59e0b' },
};

const ProcessGanttPage: React.FC = () => {
  const [data, setData] = useState<ProcessExecution[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [rangeDays, setRangeDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<dayjs.Dayjs | null>(null);

  useEffect(() => {
    setLoading(true);
    getDashboardProcessGantt()
      .then((response) => {
        if (response.code === 0) {
          setData(response.data ?? []);
          setLastUpdated(dayjs());
        }
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  useEffect(() => {
    const timer = setInterval(
      () => setRefreshKey((key) => key + 1),
      AUTO_REFRESH_MS,
    );
    return () => clearInterval(timer);
  }, []);

  const processOptions = useMemo(
    () =>
      Array.from(new Set(data.map((item) => item.y)))
        .sort((left, right) => left.localeCompare(right, 'zh-CN'))
        .map((value) => ({ value, label: value })),
    [data],
  );

  const windowStart = dayjs()
    .subtract(rangeDays - 1, 'day')
    .format('YYYY-MM-DD');
  const windowEnd = dayjs().add(1, 'day').format('YYYY-MM-DD');

  const filteredData = useMemo(
    () =>
      data.filter((item) => {
        if (
          selectedProcesses.length > 0 &&
          !selectedProcesses.includes(item.y)
        ) {
          return false;
        }
        if (statusFilter !== 'all' && item.type !== statusFilter) return false;
        return item.type === 'processing' || item.end >= windowStart;
      }),
    [data, selectedProcesses, statusFilter, windowStart],
  );

  const chartData = useMemo<ChartExecution[]>(
    () =>
      filteredData
        .map((item) => {
          const start = item.start < windowStart ? windowStart : item.start;
          const rawEnd =
            item.type === 'processing'
              ? dayjs().format('YYYY-MM-DD')
              : item.end;
          const end =
            rawEnd <= start
              ? dayjs(start).add(1, 'day').format('YYYY-MM-DD')
              : rawEnd;
          return {
            ...item,
            row: `${item.y}｜${item.mo_code}-${item.sort_seq}｜${item.seq}`,
            startDate: new Date(start),
            endDate: new Date(end),
          };
        })
        .sort((left, right) => {
          const processOrder = left.y.localeCompare(right.y, 'zh-CN');
          if (processOrder !== 0) return processOrder;
          return left.start.localeCompare(right.start);
        }),
    [filteredData, windowStart],
  );

  const processCount = new Set(filteredData.map((item) => item.y)).size;
  const processingCount = filteredData.filter(
    (item) => item.type === 'processing',
  ).length;
  const completedQty = filteredData
    .filter((item) => item.type === 'done')
    .reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const chartHeight = Math.max(420, chartData.length * 34 + 100);

  const config = {
    data: chartData,
    xField: 'row',
    yField: ['startDate', 'endDate'] as [string, string],
    colorField: 'type',
    scale: {
      y: {
        type: 'time' as const,
        domain: [new Date(windowStart), new Date(windowEnd)],
      },
      color: {
        domain: Object.keys(TYPE_MAP),
        range: Object.values(TYPE_MAP).map((item) => item.color),
      },
    },
    axis: {
      x: {
        labelFormatter: (value: unknown) => {
          const [process, workOrder] = String(value).split('｜');
          return `${process}  ${workOrder}`;
        },
      },
      y: {
        title: false,
        labelFormatter: (value: Date) => dayjs(value).format('MM/DD'),
      },
    },
    style: { inset: 3, radius: 3 },
    label: {
      text: (item: ChartExecution) =>
        item.qty > 0 ? `${Math.round(item.qty)} 件` : '',
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
        (item: ChartExecution) => ({ name: '工序', value: item.y }),
        (item: ChartExecution) => ({
          name: '工单',
          value: `${item.mo_code}-${item.sort_seq}`,
        }),
        (item: ChartExecution) => ({
          name: '状态',
          value: TYPE_MAP[item.type]?.label ?? item.type,
        }),
        (item: ChartExecution) => ({ name: '开始', value: item.start }),
        (item: ChartExecution) => ({
          name: '结束',
          value: item.type === 'processing' ? '进行中' : item.end,
        }),
        (item: ChartExecution) => ({
          name: '数量',
          value: `${Math.round(item.qty)} 件`,
        }),
      ],
    },
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <Text className={styles.eyebrow}>现场执行时间轴</Text>
          <Title level={2} className={styles.title}>
            工序甘特图
          </Title>
          <Paragraph className={styles.description}>
            按工序和工单保留实际开始、结束时间，不再移动重叠记录。
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
            title="涉及工序"
            value={processCount}
            suffix="个"
            prefix={<ApartmentOutlined />}
          />
        </Card>
        <Card className={styles.metricCard}>
          <Statistic
            title="执行记录"
            value={filteredData.length}
            suffix="条"
            prefix={<ClockCircleOutlined />}
          />
        </Card>
        <Card className={styles.metricCard}>
          <Statistic
            title="当前进行中"
            value={processingCount}
            suffix="条"
            prefix={<ClockCircleOutlined />}
          />
        </Card>
        <Card className={styles.metricCard}>
          <Statistic
            title={`近 ${rangeDays} 日完工数量`}
            value={completedQty}
            suffix="件"
            prefix={<CheckCircleOutlined />}
          />
        </Card>
      </section>

      <Card className={styles.chartCard}>
        <div className={styles.toolbar}>
          <div className={styles.filters}>
            <Select
              mode="multiple"
              placeholder="筛选工序（默认全部）"
              value={selectedProcesses}
              onChange={setSelectedProcesses}
              options={processOptions}
              className={styles.processSelect}
              maxTagCount="responsive"
              allowClear
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              className={styles.statusSelect}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'processing', label: '仅进行中' },
                { value: 'done', label: '仅已完工' },
              ]}
            />
            <Select
              value={rangeDays}
              onChange={setRangeDays}
              className={styles.rangeSelect}
              options={[
                { value: 7, label: '近 7 日' },
                { value: 14, label: '近 14 日' },
                { value: 30, label: '近 30 日' },
              ]}
            />
          </div>
          <Tag color="blue">近 {rangeDays} 日实际执行记录</Tag>
        </div>

        {chartData.length > 0 ? (
          <div className={styles.chartScroller}>
            <Bar {...config} height={chartHeight} />
          </div>
        ) : (
          <div className={styles.empty}>当前条件下暂无工序执行记录</div>
        )}
      </Card>
    </div>
  );
};

export default ProcessGanttPage;
