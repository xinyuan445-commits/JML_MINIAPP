import { ReloadOutlined } from '@ant-design/icons';
import { Bar } from '@ant-design/plots';
import { Button, Card, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { getDashboardProcessGantt } from '../service';

const { Text } = Typography;
const AUTO_REFRESH_MS = 2 * 60 * 1000;

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  done:       { label: '已完工', color: '#52c41a' },
  processing: { label: '进行中', color: '#fa8c16' },
};

const ProcessGanttPage: React.FC = () => {
  const [data, setData]             = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<dayjs.Dayjs | null>(null);

  useEffect(() => {
    setLoading(true);
    getDashboardProcessGantt()
      .then(r => {
        if (r.code === 0) {
          setData(r.data ?? []);
          setLastUpdated(dayjs());
        }
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  useEffect(() => {
    const timer = setInterval(() => setRefreshKey(k => k + 1), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  // X-axis window: 30 days ending today
  const windowStart = dayjs().subtract(29, 'day').format('YYYY-MM-DD');
  const windowEnd   = dayjs().format('YYYY-MM-DD');

  const chartData = useMemo(() => {
    // Group by process name, apply cursor to avoid visual overlap
    const groups: Record<string, any[]> = {};
    for (const d of data) (groups[String(d.y)] ??= []).push(d);

    const result: any[] = [];
    for (const [, items] of Object.entries(groups)) {
      // Sort by start date then seq
      const sorted = [...items].sort((a, b) =>
        a.start < b.start ? -1 : a.start > b.start ? 1 : (a.seq ?? 0) - (b.seq ?? 0)
      );

      let cursor = '';
      for (const d of sorted) {
        // Clamp start to window
        const rawStart = d.start < windowStart ? windowStart : d.start;
        const rawEnd   = d.end   < rawStart    ? dayjs(rawStart).add(1, 'day').format('YYYY-MM-DD') : d.end;

        const visStart = cursor && rawStart < cursor ? cursor : rawStart;
        const visEnd   = rawEnd <= visStart ? dayjs(visStart).add(1, 'day').format('YYYY-MM-DD') : rawEnd;

        result.push({
          ...d,
          startDate: new Date(visStart),
          endDate:   new Date(visEnd),
        });
        cursor = visEnd;
      }
    }
    return result;
  }, [data, windowStart]);

  const yCount      = new Set(chartData.map((d: any) => d.y)).size;
  const chartHeight = Math.max(300, yCount * 40 + 80);

  const config = {
    data: chartData,
    xField: 'y',
    yField: ['startDate', 'endDate'] as [string, string],
    colorField: 'type',
    scale: {
      y: { type: 'time' as const, domain: [new Date(windowStart), new Date(windowEnd)] },
      color: {
        domain: Object.keys(TYPE_MAP),
        range:  Object.values(TYPE_MAP).map(v => v.color),
      },
    },
    axis: {
      x: { label: { style: { fontSize: 12 } } },
      y: { labelFormatter: (v: Date) => dayjs(v).format('MM/DD') },
    },
    style: { inset: 3 },
    label: {
      text: (d: any) => d.qty > 0 ? String(Math.round(d.qty)) : '',
      position: 'inside' as const,
      style: { fill: '#000', fontSize: 11, fontWeight: 600 },
    },
    legend: {
      color: {
        itemMarker: 'square',
        labelFormatter: (v: string) => TYPE_MAP[v]?.label ?? v,
      },
    },
    tooltip: {
      items: [
        (d: any) => ({ name: '工序', value: d.y }),
        (d: any) => ({ name: '工单', value: `${d.mo_code}-${d.sort_seq}` }),
        (d: any) => ({ name: '状态', value: TYPE_MAP[d.type]?.label ?? d.type }),
        (d: any) => ({ name: '开始', value: d.start }),
        (d: any) => ({ name: '结束', value: d.type === 'processing' ? '进行中' : d.end }),
        (d: any) => ({ name: '数量', value: String(Math.round(d.qty)) }),
      ],
    },
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="工序甘特图（近30天）"
        extra={
          <Space>
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

export default ProcessGanttPage;
