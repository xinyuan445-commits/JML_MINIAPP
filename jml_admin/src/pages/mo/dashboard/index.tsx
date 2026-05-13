import { ReloadOutlined } from '@ant-design/icons';
import { Column } from '@ant-design/plots';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Card, Col, Row, Space, Statistic, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import {
  getDashboardAnomalies,
  getDashboardCapacity,
  getDashboardSummary,
  getDashboardWip,
} from '../service';

const { Text } = Typography;
const AUTO_REFRESH_MS = 2 * 60 * 1000;

type SummaryData = {
  done_count: number;
  done_qty: number;
  wip_count: number;
  wip_qty: number;
};

type CapacityItem = { dt: string; process_name: string; qty: number };

type WipItem = {
  mo_code: string;
  sort_seq: number;
  route_name: string;
  step_progress: string;
  current_process: string;
  status: string;
  operator_name: string;
  qty_done: number;
  start_time: string | null;
  hours_elapsed: number | null;
};

type AnomalyItem = {
  mo_code: string;
  sort_seq: number;
  seq: number;
  process_name: string;
  operator_name: string;
  qty_done: number;
  complete_reason: string;
  end_time: string;
};

const statusLabel: Record<string, React.ReactNode> = {
  pending: <Tag color="default">待开工</Tag>,
  processing: <Tag color="warning">进行中</Tag>,
};

const wipColumns: ProColumns<WipItem>[] = [
  { title: '工单号', dataIndex: 'mo_code', width: 150 },
  { title: '行号', dataIndex: 'sort_seq', width: 60 },
  { title: '工艺路线', dataIndex: 'route_name', width: 160 },
  { title: '进度', dataIndex: 'step_progress', width: 90 },
  { title: '当前工序', dataIndex: 'current_process', width: 120 },
  {
    title: '状态', dataIndex: 'status', width: 90,
    render: (_, r) => statusLabel[r.status] ?? <Tag>{r.status}</Tag>,
  },
  { title: '操作人', dataIndex: 'operator_name', width: 100 },
  { title: '已完工数', dataIndex: 'qty_done', width: 90 },
  {
    title: '在制时长', dataIndex: 'hours_elapsed', width: 100,
    render: (_, r) => r.hours_elapsed != null ? `${r.hours_elapsed} h` : '—',
  },
  { title: '开工时间', dataIndex: 'start_time', width: 160, ellipsis: true },
];

const anomalyColumns: ProColumns<AnomalyItem>[] = [
  { title: '工单号', dataIndex: 'mo_code', width: 150 },
  { title: '行号', dataIndex: 'sort_seq', width: 60 },
  { title: '步骤', dataIndex: 'seq', width: 60 },
  { title: '工序', dataIndex: 'process_name', width: 120 },
  { title: '操作人', dataIndex: 'operator_name', width: 100 },
  { title: '完工数量', dataIndex: 'qty_done', width: 90 },
  { title: '原因说明', dataIndex: 'complete_reason', ellipsis: true },
  { title: '完工时间', dataIndex: 'end_time', width: 160 },
];

const DashboardPage: React.FC = () => {
  const [summary, setSummary]       = useState<SummaryData | null>(null);
  const [capacity, setCapacity]     = useState<CapacityItem[]>([]);
  const [wip, setWip]               = useState<WipItem[]>([]);
  const [anomalies, setAnomalies]   = useState<AnomalyItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<dayjs.Dayjs | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getDashboardSummary(),
      getDashboardCapacity(),
      getDashboardWip(),
      getDashboardAnomalies(),
    ]).then(([s, c, w, a]) => {
      if (s.code === 0) setSummary(s.data);
      if (c.code === 0) setCapacity(c.data);
      if (w.code === 0) setWip(w.data);
      if (a.code === 0) setAnomalies(a.data);
      setLastUpdated(dayjs());
    }).finally(() => setLoading(false));
  }, [refreshKey]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => setRefreshKey(k => k + 1), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const columnConfig = {
    data: capacity,
    xField: 'dt',
    yField: 'qty',
    colorField: 'process_name',
    group: true,
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Toolbar */}
      <Row justify="end" align="middle" style={{ marginBottom: 16 }}>
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
      </Row>

      {/* 汇总指标 */}
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="完工记录数量" value={summary?.done_count ?? 0} suffix="条" valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="完工数量" value={summary?.done_qty ?? 0} suffix="件" valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="在制工单记录数量" value={summary?.wip_count ?? 0} suffix="条" />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="在制数量" value={summary?.wip_qty ?? 0} suffix="件" valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
      </Row>

      {/* 工序产能柱状图 */}
      <Card title="近7日工序产能" style={{ marginTop: 16 }} loading={loading}>
        {capacity.length > 0
          ? <Column {...columnConfig} height={300} />
          : <div style={{ textAlign: 'center', color: '#999', padding: '60px 0' }}>暂无完工数据</div>
        }
      </Card>

      {/* 在制品列表 */}
      <ProTable<WipItem>
        headerTitle={`在制品列表（${wip.length} 张）`}
        rowKey={(r) => `${r.mo_code}__${r.sort_seq}`}
        dataSource={wip}
        loading={loading}
        search={false}
        pagination={{ pageSize: 10 }}
        columns={wipColumns}
        style={{ marginTop: 16 }}
        options={{ reload: false, density: false, setting: false }}
      />

      {/* 完工异常 */}
      {anomalies.length > 0 && (
        <ProTable<AnomalyItem>
          headerTitle={`近7日完工异常（${anomalies.length} 条）`}
          rowKey={(r) => `${r.mo_code}__${r.sort_seq}__${r.seq}`}
          dataSource={anomalies}
          loading={loading}
          search={false}
          pagination={{ pageSize: 10 }}
          columns={anomalyColumns}
          style={{ marginTop: 16 }}
          options={{ reload: false, density: false, setting: false }}
        />
      )}
    </div>
  );
};

export default DashboardPage;
