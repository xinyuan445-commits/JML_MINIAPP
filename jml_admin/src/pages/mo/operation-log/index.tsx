import { EyeOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  Button,
  Descriptions,
  Drawer,
  Empty,
  Image,
  Space,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { useViewportScrollHeight } from '@/hooks/useViewportScrollHeight';
import { getOperationLogs, type OperationLogItem } from './service';

const eventOptions = {
  receive_first: { text: '首工序领料接收', status: 'Processing' },
  receive: { text: '工序接收', status: 'Processing' },
  receive_more: { text: '追加接收', status: 'Processing' },
  receive_work_start: { text: '追加接收开工', status: 'Processing' },
  start: { text: '开工', status: 'Default' },
  complete: { text: '正常完工', status: 'Success' },
  rework_start: { text: '发起返工', status: 'Warning' },
  rework_complete: { text: '返工完工', status: 'Error' },
} as const;

const eventColors: Record<string, string> = {
  receive_first: 'cyan',
  receive: 'cyan',
  receive_more: 'blue',
  receive_work_start: 'blue',
  start: 'geekblue',
  complete: 'green',
  rework_start: 'orange',
  rework_complete: 'volcano',
};

const numberText = (value?: number) =>
  value == null
    ? '—'
    : Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 4 });

const gradeText = (record: OperationLogItem) =>
  [
    ['A', record.qty_a],
    ['A1', record.qty_a1],
    ['A2', record.qty_a2],
    ['C', record.qty_c],
  ]
    .filter(([, value]) => value != null)
    .map(([name, value]) => `${name} ${numberText(value as number)}`)
    .join(' · ');

const QuantityBreakdown = ({ record }: { record: OperationLogItem }) => {
  const items = [
    ['合计', record.qty],
    ['A', record.qty_a],
    ['A1', record.qty_a1],
    ['A2', record.qty_a2],
    ['C', record.qty_c],
  ] as const;

  return (
    <div>
      <Typography.Title level={5}>等级数量</Typography.Title>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          overflow: 'hidden',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
        }}
      >
        {items.map(([label, value], index) => (
          <div
            key={label}
            style={{
              padding: '12px 8px',
              textAlign: 'center',
              borderLeft: index ? '1px solid #e5e7eb' : undefined,
            }}
          >
            <div style={{ color: '#667085', fontSize: 13 }}>{label}</div>
            <div style={{ color: '#101828', fontSize: 20, fontWeight: 600 }}>
              {numberText(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const DetailDrawer = ({
  record,
  onClose,
}: {
  record?: OperationLogItem;
  onClose: () => void;
}) => (
  <Drawer
    title="工序操作详情"
    width="min(720px, 94vw)"
    open={Boolean(record)}
    onClose={onClose}
    destroyOnHidden
  >
    {record ? (
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Descriptions
          bordered
          size="small"
          column={2}
          items={[
            { key: 'time', label: '操作时间', children: record.occurred_at },
            {
              key: 'action',
              label: '操作内容',
              children: (
                <Tag color={eventColors[record.event_type]}>
                  {record.event_name}
                </Tag>
              ),
            },
            {
              key: 'operator',
              label: '操作人',
              children: record.operator_name || '未记录',
            },
            {
              key: 'workers',
              label: '作业人员',
              children: record.worker_names || '未记录',
            },
            {
              key: 'order',
              label: '工单',
              children: `${record.mo_code} / 第 ${record.sort_seq} 行`,
            },
            {
              key: 'process',
              label: '工序',
              children: record.seq
                ? `${record.seq}. ${record.process_name || '未记录'}`
                : record.process_name || '未记录',
            },
            {
              key: 'station',
              label: '工站',
              children: record.station_name || '未记录',
            },
            {
              key: 'reason',
              label: '说明',
              span: 2,
              children: record.reason || '—',
            },
          ]}
        />
        <QuantityBreakdown record={record} />
        <div>
          <Typography.Title level={5}>现场照片</Typography.Title>
          {record.photo_urls?.length ? (
            <Image.PreviewGroup>
              <Space wrap>
                {record.photo_urls.map((url) => (
                  <Image key={url} src={url} width={120} height={90} />
                ))}
              </Space>
            </Image.PreviewGroup>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无照片" />
          )}
        </div>
      </Space>
    ) : null}
  </Drawer>
);

const OperationLogPage: React.FC = () => {
  const [selected, setSelected] = useState<OperationLogItem>();
  const { scrollRef, scrollHeight } = useViewportScrollHeight();

  const columns = useMemo<ProColumns<OperationLogItem>[]>(
    () => [
      {
        title: '操作时间',
        dataIndex: 'occurred_at',
        valueType: 'dateTime',
        width: 170,
        search: false,
        sorter: false,
      },
      {
        title: '操作日期',
        dataIndex: 'date_range',
        valueType: 'dateRange',
        hideInTable: true,
        initialValue: [dayjs().subtract(6, 'day'), dayjs()],
        search: {
          transform: (value: unknown[]) => ({
            start_date: value?.[0]
              ? dayjs(value[0] as string).format('YYYY-MM-DD')
              : undefined,
            end_date: value?.[1]
              ? dayjs(value[1] as string).format('YYYY-MM-DD')
              : undefined,
          }),
        },
      },
      {
        title: '操作内容',
        dataIndex: 'event_type',
        valueType: 'select',
        valueEnum: eventOptions,
        width: 150,
        render: (_, record) => (
          <Tag color={eventColors[record.event_type]}>{record.event_name}</Tag>
        ),
      },
      {
        title: '操作人',
        dataIndex: 'operator',
        width: 110,
        render: (_, record) => record.operator_name || '未记录',
      },
      {
        title: '作业人员',
        dataIndex: 'worker',
        width: 160,
        ellipsis: true,
        render: (_, record) => record.worker_names || '—',
      },
      {
        title: '工单号',
        dataIndex: 'mo_code',
        width: 160,
        render: (_, record) => (
          <span>
            {record.mo_code} / {record.sort_seq}
          </span>
        ),
      },
      {
        title: '工序',
        dataIndex: 'process_name',
        width: 150,
        ellipsis: true,
        render: (_, record) =>
          record.seq
            ? `${record.seq}. ${record.process_name || '未记录'}`
            : record.process_name || '未记录',
      },
      {
        title: '工站',
        dataIndex: 'station_name',
        width: 130,
        ellipsis: true,
        render: (_, record) => record.station_name || '—',
      },
      {
        title: '本次数量',
        dataIndex: 'qty',
        width: 110,
        search: false,
        render: (_, record) => (
          <div>
            <strong>{numberText(record.qty)}</strong>
            {gradeText(record) ? (
              <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                {gradeText(record)}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        title: '说明',
        dataIndex: 'reason',
        search: false,
        ellipsis: true,
        render: (_, record) => record.reason || '—',
      },
      {
        title: '操作',
        valueType: 'option',
        width: 80,
        render: (_, record) => (
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => setSelected(record)}
          >
            详情
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <div ref={scrollRef}>
        <ProTable<OperationLogItem>
          headerTitle="工序操作明细"
          rowKey="id"
          columns={columns}
          request={async (params) => {
            const response = await getOperationLogs(params);
            return {
              data: response.code === 0 ? response.data : [],
              total: response.total || 0,
              success: response.code === 0,
            };
          }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          scroll={{ x: 1500, y: scrollHeight }}
        />
      </div>
      <DetailDrawer record={selected} onClose={() => setSelected(undefined)} />
    </>
  );
};

export default OperationLogPage;
