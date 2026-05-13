import { ReloadOutlined } from '@ant-design/icons';
import { Bar } from '@ant-design/plots';
import { Button, Card, DatePicker, Select, Space, Typography } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { getDashboardGanttData } from '../service';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const Y_PLAN = '|p';
const Y_EXEC = '|e';
const AUTO_REFRESH_MS = 2 * 60 * 1000;

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  planned:    { label: '计划日期', color: '#1677ff' },
  done:       { label: '已完工',   color: '#52c41a' },
  processing: { label: '进行中',   color: '#fa8c16' },
  pending:    { label: '待开工',   color: '#8c8c8c' },
  unstarted:  { label: '未开工',   color: '#d9d9d9' },
};

function defaultRange(): [Dayjs, Dayjs] {
  const today = dayjs();
  const dow = today.day();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const thisMon = today.subtract(daysFromMon, 'day');
  return [thisMon.subtract(7, 'day'), thisMon.add(13, 'day')];
}

const GanttPage: React.FC = () => {
  const [range, setRange]             = useState<[Dayjs, Dayjs]>(defaultRange);
  const [allData, setAllData]         = useState<any[]>([]);
  const [woOptions, setWoOptions]     = useState<{ value: string; label: string }[]>([]);
  const [selectedWos, setSelectedWos] = useState<string[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshKey, setRefreshKey]   = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Dayjs | null>(null);

  const startStr = range[0].format('YYYY-MM-DD');
  const endStr   = range[1].format('YYYY-MM-DD');

  // Reset filter only when date range changes
  useEffect(() => {
    setSelectedWos([]);
  }, [startStr, endStr]);

  // Fetch on range change or refresh (filter preserved on refresh)
  useEffect(() => {
    setLoading(true);
    getDashboardGanttData({ start: startStr, end: endStr })
      .then(r => {
        if (r.code === 0) {
          setAllData(r.data ?? []);
          setWoOptions(r.wo_options ?? []);
          setLastUpdated(dayjs());
        }
      })
      .finally(() => setLoading(false));
  }, [startStr, endStr, refreshKey]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const timer = setInterval(() => setRefreshKey(k => k + 1), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const filteredData = useMemo(() => {
    if (selectedWos.length === 0) return allData;
    return allData.filter(d => selectedWos.includes(String(d.y).replace(/\|[pe]$/, '')));
  }, [allData, selectedWos]);

  const chartData = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD');

    // Build plan dates lookup from |p rows
    const planDates: Record<string, { start: string; end: string }> = {};
    for (const d of filteredData) {
      if (String(d.y).endsWith(Y_PLAN)) {
        const woId = String(d.y).slice(0, -2);
        planDates[woId] = { start: d.start, end: d.end };
      }
    }

    const groups: Record<string, any[]> = {};
    for (const d of filteredData) (groups[String(d.y)] ??= []).push(d);

    const result: any[] = [];

    for (const [y, items] of Object.entries(groups)) {
      if (!y.endsWith(Y_EXEC)) {
        // Plan rows: use actual dates as-is
        for (const d of items) {
          const endDate = d.end <= d.start ? dayjs(d.start).add(1, 'day').format('YYYY-MM-DD') : d.end;
          result.push({ ...d, end: endDate, startDate: new Date(d.start), endDate: new Date(endDate) });
        }
      } else {
        const woId   = y.slice(0, -2);
        const plan   = planDates[woId];
        const planEnd = plan?.end ?? today;

        const sorted  = [...items].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
        const actual  = sorted.filter(d => d.type === 'done' || d.type === 'processing');
        const waiting = sorted.filter(d => d.type !== 'done' && d.type !== 'processing');

        if (actual.length === 0) {
          // Whole WO not started: show gray bar over plan period
          for (const d of waiting) {
            const endDate = d.end <= d.start ? dayjs(d.start).add(1, 'day').format('YYYY-MM-DD') : d.end;
            result.push({ ...d, end: endDate, startDate: new Date(d.start), endDate: new Date(endDate) });
          }
          continue;
        }

        // Done / processing rows: use actual dates with cursor for same-day overlap
        let cursor = '';
        for (const d of actual) {
          const actualEnd = d.end <= d.start ? dayjs(d.start).add(1, 'day').format('YYYY-MM-DD') : d.end;
          const visStart  = cursor && d.start < cursor ? cursor : d.start;
          const visEnd    = actualEnd <= visStart ? dayjs(visStart).add(1, 'day').format('YYYY-MM-DD') : actualEnd;
          result.push({ ...d, startDate: new Date(visStart), endDate: new Date(visEnd) });
          cursor = visEnd;
        }

        // Pending / queued rows: distribute remaining plan time equally
        if (waiting.length > 0) {
          const slotStart    = cursor > today ? cursor : today;
          const remainDays   = dayjs(planEnd).diff(dayjs(slotStart), 'day');
          const slotDays     = Math.max(1, Math.floor(remainDays / waiting.length));
          let slotCursor     = slotStart;
          for (const d of waiting) {
            const visEnd = dayjs(slotCursor).add(slotDays, 'day').format('YYYY-MM-DD');
            result.push({ ...d, startDate: new Date(slotCursor), endDate: new Date(visEnd) });
            slotCursor = visEnd;
          }
        }
      }
    }
    return result;
  }, [filteredData]);

  const yCount      = new Set(chartData.map((d: any) => d.y)).size;
  const chartHeight = Math.max(300, yCount * 36 + 80);

  const config = {
    data: chartData,
    xField: 'y',
    yField: ['startDate', 'endDate'] as [string, string],
    colorField: 'type',
    scale: {
      y: { type: 'time' as const },
      color: {
        domain: Object.keys(TYPE_MAP),
        range:  Object.values(TYPE_MAP).map(v => v.color),
      },
    },
    axis: {
      x: {
        labelFormatter: (v: any) => {
          const s = String(v);
          if (s.endsWith(Y_PLAN)) return s.slice(0, -2) + ' 计划';
          if (s.endsWith(Y_EXEC)) return s.slice(0, -2) + ' 工序';
          return s;
        },
      },
      y: { labelFormatter: (v: Date) => dayjs(v).format('MM/DD') },
    },
    style: { inset: 2 },
    label: {
      text: (d: any) => (d.type === 'unstarted' ? '未开工' : ''),
      position: 'inside' as const,
      style: { fill: '#595959', fontSize: 11 },
    },
    legend: {
      color: {
        itemMarker: 'square',
        labelFormatter: (v: string) => TYPE_MAP[v]?.label ?? v,
      },
    },
    tooltip: {
      items: [
        (d: any) => ({ name: '工单',   value: String(d.y).replace(/\|[pe]$/, '') }),
        (d: any) => ({ name: '内容',   value: d.name }),
        (d: any) => ({ name: '开始',   value: d.start }),
        (d: any) => ({ name: '结束',   value: d.end }),
        (d: any) => (d.inv_name ? { name: '产品', value: d.inv_name } : null),
      ].filter(Boolean),
    },
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="工单甘特图"
        extra={
          <Space wrap>
            <RangePicker
              value={range}
              onChange={v => v?.[0] && v?.[1] && setRange([v[0], v[1]])}
              allowClear={false}
            />
            <Select
              mode="multiple"
              placeholder="工单筛选（默认全部）"
              value={selectedWos}
              onChange={setSelectedWos}
              options={woOptions}
              style={{ minWidth: 220 }}
              maxTagCount="responsive"
              allowClear
            />
            {lastUpdated && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {lastUpdated.format('HH:mm:ss')} 更新
              </Text>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => setRefreshKey(k => k + 1)}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        }
        loading={loading}
      >
        {chartData.length > 0 ? (
          <Bar {...config} height={chartHeight} />
        ) : (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>暂无数据</div>
        )}
      </Card>
    </div>
  );
};

export default GanttPage;
