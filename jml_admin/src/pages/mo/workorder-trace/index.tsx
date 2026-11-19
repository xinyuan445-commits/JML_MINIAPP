import { EyeOutlined, SearchOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Space,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import React, { useMemo, useState } from 'react';
import { getCompletedWorkorderDetail, getWorkorderTrace } from '../service';
import styles from './index.less';

const { Text } = Typography;

type TraceStatus =
  | 'done'
  | 'processing'
  | 'pending'
  | 'not_started'
  | 'unassigned';

type TraceStep = {
  seq: number;
  process_name: string;
  station_name?: string;
  state: 'done' | 'current' | 'pending';
};

type TraceRow = {
  mo_code: string;
  sort_seq: number;
  inv_code: string;
  inv_name: string;
  product_category?: string;
  production_department?: string;
  plan_qty: number;
  plan_start_date?: string;
  plan_due_date?: string;
  route_id?: number;
  route_name?: string;
  route_source?: 'actual' | 'manual' | 'category';
  status: TraceStatus;
  current_process?: string;
  next_process?: string;
  done_process_count: number;
  process_count: number;
  steps: TraceStep[];
};

type Worker = { user_name?: string };
type WorkRecord = {
  id: string | number;
  status: string;
  qty_input?: number;
  start_time?: string;
  end_time?: string;
  operator_name?: string;
  workers?: Worker[];
};
type ProcessRecord = {
  id: number;
  seq: number;
  status: string;
  station_name?: string;
  operator_name?: string;
  complete_operator_name?: string;
  start_time?: string;
  end_time?: string;
  qty_done?: number;
  qty_a?: number;
  qty_a1?: number;
  qty_a2?: number;
  qty_c?: number;
  workers?: Worker[];
  receive_records?: WorkRecord[];
  rework_records?: WorkRecord[];
};

const statusMeta: Record<TraceStatus, { text: string; color?: string }> = {
  done: { text: '已完成', color: 'success' },
  processing: { text: '进行中', color: 'processing' },
  pending: { text: '待处理', color: 'gold' },
  not_started: { text: '未开始' },
  unassigned: { text: '未匹配路线', color: 'error' },
};

const routeSourceText = {
  actual: '实际执行',
  manual: '手工指定',
  category: '类别默认',
};

const numberText = (value?: number) =>
  Number(value || 0).toLocaleString('zh-CN');

const workerText = (record: ProcessRecord) => {
  const names = (record.workers || [])
    .map((worker) => worker.user_name)
    .filter(Boolean);
  return (
    names.join('、') ||
    record.complete_operator_name ||
    record.operator_name ||
    '—'
  );
};

const ProcessDetail: React.FC<{
  step: TraceStep;
  records: ProcessRecord[];
}> = ({ step, records }) => {
  if (!records.length) {
    return (
      <div className={styles.stepBody}>
        <Text type="secondary">{step.station_name || '暂无报工'}</Text>
      </div>
    );
  }
  return (
    <div className={styles.recordList}>
      {records.map((record, index) => (
        <Card
          key={record.id}
          size="small"
          title={records.length > 1 ? `第 ${index + 1} 次报工` : undefined}
          className={styles.recordCard}
        >
          <div className={styles.recordGrid}>
            <span>工站：{record.station_name || step.station_name || '—'}</span>
            <span>开工人员：{workerText(record)}</span>
            <span>开始：{record.start_time || '—'}</span>
            <span>结束：{record.end_time || '—'}</span>
          </div>
          <Space wrap size={[4, 6]}>
            <Tag>完工 {numberText(record.qty_done)}</Tag>
            <Tag color="success">A {numberText(record.qty_a)}</Tag>
            <Tag color="blue">A1 {numberText(record.qty_a1)}</Tag>
            <Tag color="cyan">A2 {numberText(record.qty_a2)}</Tag>
            <Tag color={Number(record.qty_c) > 0 ? 'error' : undefined}>
              C {numberText(record.qty_c)}
            </Tag>
            {!!record.receive_records?.length && (
              <Tag color="geekblue">
                接收 {record.receive_records.length} 次
              </Tag>
            )}
            {!!record.rework_records?.length && (
              <Tag color="orange">返工 {record.rework_records.length} 次</Tag>
            )}
          </Space>
        </Card>
      ))}
    </div>
  );
};

const WorkorderTracePage: React.FC = () => {
  const { message } = App.useApp();
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState<TraceRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TraceRow>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [processes, setProcesses] = useState<ProcessRecord[]>([]);

  const search = async () => {
    const moCode = keyword.trim();
    if (!moCode) {
      message.warning('请输入生产订单号');
      return;
    }
    setLoading(true);
    try {
      const result = await getWorkorderTrace(moCode);
      setSearched(true);
      if (result.code !== 0) {
        setRows([]);
        message.error(result.msg || '查询失败');
        return;
      }
      setRows(result.data as TraceRow[]);
    } catch {
      setSearched(true);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (row: TraceRow) => {
    setSelected(row);
    setProcesses([]);
    if (row.status === 'not_started' || row.status === 'unassigned') return;
    setDetailLoading(true);
    try {
      const result = await getCompletedWorkorderDetail({
        mo_code: row.mo_code,
        sort_seq: row.sort_seq,
        include_active: 1,
      });
      if (result.code === 0) {
        setProcesses((result.data?.processes || []) as ProcessRecord[]);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const recordsBySeq = useMemo(() => {
    const map = new Map<number, ProcessRecord[]>();
    for (const record of processes) {
      const group = map.get(record.seq) || [];
      group.push(record);
      map.set(record.seq, group);
    }
    return map;
  }, [processes]);

  const columns: ProColumns<TraceRow>[] = [
    { title: '行号', dataIndex: 'sort_seq', width: 70, search: false },
    {
      title: '产品',
      dataIndex: 'inv_name',
      search: false,
      render: (_, row) => (
        <div>
          <div>{row.inv_name || '—'}</div>
          <Text type="secondary">{row.inv_code || '—'}</Text>
        </div>
      ),
    },
    {
      title: '生产部门',
      dataIndex: 'production_department',
      width: 130,
      search: false,
      renderText: (value) => value || '—',
    },
    {
      title: '工艺路线',
      dataIndex: 'route_name',
      width: 260,
      search: false,
      render: (_, row) =>
        row.route_name ? (
          <Space wrap size={4}>
            <span>{row.route_name}</span>
            {row.route_source && <Tag>{routeSourceText[row.route_source]}</Tag>}
          </Space>
        ) : (
          '—'
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      search: false,
      render: (_, row) => {
        const meta = statusMeta[row.status];
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: '进度',
      width: 100,
      search: false,
      render: (_, row) => `${row.done_process_count} / ${row.process_count}`,
    },
    {
      title: '当前工序',
      dataIndex: 'current_process',
      width: 130,
      search: false,
      renderText: (value, row) =>
        row.status === 'done' ? '全部完成' : value || '—',
    },
    {
      title: '下一工序',
      dataIndex: 'next_process',
      width: 130,
      search: false,
      renderText: (value) => value || '—',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 90,
      render: (_, row) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => openDetail(row)}
        >
          查看
        </Button>
      ),
    },
  ];

  const selectedStatus = selected ? statusMeta[selected.status] : undefined;
  return (
    <PageContainer title="工单路线追踪">
      <Card className={styles.searchCard}>
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onPressEnter={search}
          placeholder="输入生产订单号"
          allowClear
          suffix={<SearchOutlined />}
          className={styles.searchInput}
        />
        <Button type="primary" loading={loading} onClick={search}>
          查询
        </Button>
      </Card>

      {!searched ? (
        <Card>
          <Empty description="输入生产订单号查询" />
        </Card>
      ) : (
        <ProTable<TraceRow>
          rowKey={(row) => `${row.mo_code}-${row.sort_seq}`}
          columns={columns}
          dataSource={rows}
          loading={loading}
          search={false}
          options={false}
          pagination={false}
          scroll={{ x: 1250 }}
          headerTitle={`${keyword.trim().toUpperCase()} · ${rows.length} 行`}
          locale={{ emptyText: <Empty description="未找到工单" /> }}
        />
      )}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(undefined)}
        size={920}
        title={
          selected ? `${selected.mo_code} · 行号 ${selected.sort_seq}` : ''
        }
        loading={detailLoading}
      >
        {selected && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="产品">
                {selected.inv_name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="物料编码">
                {selected.inv_code || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="工艺路线">
                {selected.route_name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={selectedStatus?.color}>{selectedStatus?.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="计划数量">
                {numberText(selected.plan_qty)}
              </Descriptions.Item>
              <Descriptions.Item label="生产部门">
                {selected.production_department || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="计划开工">
                {selected.plan_start_date || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="计划完工">
                {selected.plan_due_date || '—'}
              </Descriptions.Item>
            </Descriptions>

            {selected.steps.length ? (
              <Timeline
                className={styles.timeline}
                items={selected.steps.map((step) => ({
                  color:
                    step.state === 'done'
                      ? 'green'
                      : step.state === 'current'
                        ? 'blue'
                        : 'gray',
                  children: (
                    <div className={styles.stepItem}>
                      <div className={styles.stepTitle}>
                        <Text strong>
                          {step.seq}. {step.process_name}
                        </Text>
                        <Tag
                          color={
                            step.state === 'done'
                              ? 'success'
                              : step.state === 'current'
                                ? 'processing'
                                : undefined
                          }
                        >
                          {step.state === 'done'
                            ? '已完成'
                            : step.state === 'current'
                              ? selected.status === 'not_started'
                                ? '未开始'
                                : '当前工序'
                              : '未开始'}
                        </Tag>
                      </div>
                      <ProcessDetail
                        step={step}
                        records={recordsBySeq.get(step.seq) || []}
                      />
                    </div>
                  ),
                }))}
              />
            ) : (
              <Empty
                className={styles.routeEmpty}
                description="该工单行未匹配工艺路线"
              />
            )}
          </>
        )}
      </Drawer>
    </PageContainer>
  );
};

export default WorkorderTracePage;
