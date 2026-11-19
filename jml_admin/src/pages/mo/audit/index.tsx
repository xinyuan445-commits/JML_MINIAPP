import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Tag, Typography } from 'antd';
import React from 'react';
import { getAuditList } from '../service';

type AuditItem = {
  id: number;
  username: string;
  action_name: string;
  request_method: string;
  request_path: string;
  target_id?: string;
  request_data?: string;
  result_code: number;
  result_message?: string;
  ip_address?: string;
  create_time: string;
  date_range?: string[];
};

const columns: ProColumns<AuditItem>[] = [
  {
    title: '操作时间',
    dataIndex: 'create_time',
    valueType: 'dateTime',
    width: 170,
    search: false,
  },
  {
    title: '操作日期',
    dataIndex: 'date_range',
    valueType: 'dateRange',
    hideInTable: true,
    search: {
      transform: (value: string[]) => ({
        start_date: value?.[0],
        end_date: value?.[1],
      }),
    },
  },
  { title: '操作人', dataIndex: 'username', width: 110 },
  { title: '操作内容', dataIndex: 'action_name', width: 170 },
  { title: '目标', dataIndex: 'target_id', width: 110, search: false, render: (_, row) => row.target_id || '-' },
  {
    title: '结果',
    dataIndex: 'result_code',
    width: 90,
    search: false,
    render: (_, row) => row.result_code === 0
      ? <Tag color="success">成功</Tag>
      : <Tag color="error">失败</Tag>,
  },
  { title: '结果说明', dataIndex: 'result_message', ellipsis: true, search: false },
  { title: 'IP地址', dataIndex: 'ip_address', width: 130, search: false },
  { title: '接口', dataIndex: 'request_path', width: 230, ellipsis: true, search: false },
];

const AuditPage: React.FC = () => (
  <ProTable<AuditItem>
    headerTitle="操作日志"
    rowKey="id"
    columns={columns}
    request={async (params) => {
      const response = await getAuditList(params);
      return {
        data: response.code === 0 ? response.data : [],
        total: response.total || 0,
        success: response.code === 0,
      };
    }}
    pagination={{ defaultPageSize: 20, showSizeChanger: true }}
    expandable={{
      expandedRowRender: (row) => (
        <Typography.Paragraph style={{ margin: 0 }}>
          <Typography.Text type="secondary">请求内容：</Typography.Text>
          <Typography.Text code>{row.request_data || '{}'}</Typography.Text>
        </Typography.Paragraph>
      ),
    }}
  />
);

export default AuditPage;
