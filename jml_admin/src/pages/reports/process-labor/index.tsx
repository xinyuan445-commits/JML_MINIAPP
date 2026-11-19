import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { PageContainer, type ProColumns, ProTable } from '@ant-design/pro-components';
import { App, Button, DatePicker, Input, Select, Space, Table, Tag } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useViewportScrollHeight } from '@/hooks/useViewportScrollHeight';
import { exportProcessLaborExcel } from './exportExcel';
import {
  getProcessLaborReport,
  type ProcessLaborDetail,
  type ProcessLaborRow,
} from './service';

const quantity = (value: number | null) => value == null ? '—' :
  value.toLocaleString('zh-CN', { maximumFractionDigits: 4 });

const duration = (minutes: number | null) => {
  if (minutes == null) return '—';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = Math.floor(minutes % 60);
  return [days ? `${days}天` : '', hours ? `${hours}小时` : '', `${rest}分钟`].join('');
};

const statusColor = (status: string) => ({
  已完成: 'green',
  进行中: 'blue',
  返工中: 'red',
  待开工: 'cyan',
}[status] || 'default');

const staffingColor = (status: string) => ({
  配置正常: 'green',
  人数不足: 'red',
  人数超配: 'orange',
  未分配: 'red',
}[status] || 'default');

const detailColumns = [
  { title: '类型', dataIndex: 'kind', width: 80 },
  { title: '开始时间', dataIndex: 'start_time', width: 170, render: (value: string) => value || '—' },
  { title: '完工时间', dataIndex: 'complete_time', width: 170, render: (value: string) => value || '—' },
  { title: '完工', dataIndex: 'qty_done', width: 90, align: 'right' as const },
  { title: 'A', dataIndex: 'qty_a', width: 75, align: 'right' as const },
  { title: 'A1', dataIndex: 'qty_a1', width: 75, align: 'right' as const },
  { title: 'A2', dataIndex: 'qty_a2', width: 75, align: 'right' as const },
  { title: 'C', dataIndex: 'qty_c', width: 75, align: 'right' as const },
  { title: '分配人员', dataIndex: 'assigned_workers', width: 220, render: (value: string) => value || '—' },
  { title: '报工人', dataIndex: 'operator_name', width: 140, render: (value: string) => value || '—' },
];

const ProcessLaborReportPage: React.FC = () => {
  const { message } = App.useApp();
  const { scrollRef, scrollHeight } = useViewportScrollHeight();
  const [rows, setRows] = useState<ProcessLaborRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [staffing, setStaffing] = useState('all');
  const [dates, setDates] = useState<[string, string] | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getProcessLaborReport();
      setRows(result.rows);
      if (result.range.start)
        setDates((current) => current || [result.range.start as string, result.range.end]);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '读取失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRows = useMemo(() => {
    const search = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      if (search && ![
        row.mo_code,
        row.customer_name,
        row.inv_code,
        row.inv_name,
        row.process_name,
        row.station_name,
        row.worker_names,
        row.rework_worker_names,
      ].some((value) => value.toLowerCase().includes(search))) return false;
      if (status !== 'all' && row.process_status !== status) return false;
      if (staffing !== 'all' && row.staffing_status !== staffing) return false;
      if (dates) {
        const basis = row.first_start_time || row.plan_start_date;
        if (basis && (basis.slice(0, 10) < dates[0] || basis.slice(0, 10) > dates[1]))
          return false;
      }
      return true;
    });
  }, [dates, keyword, rows, staffing, status]);

  const handleExport = async () => {
    if (!filteredRows.length) {
      message.warning('没有可导出的数据');
      return;
    }
    setExporting(true);
    try {
      await exportProcessLaborExcel(filteredRows);
      message.success(`已导出 ${filteredRows.length} 条`);
    } catch {
      message.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  const columns: ProColumns<ProcessLaborRow>[] = [
    { title: '生产订单号', dataIndex: 'mo_code', width: 165, fixed: 'left' },
    { title: '行号', dataIndex: 'sort_seq', width: 70, fixed: 'left' },
    { title: '客户', dataIndex: 'customer_name', width: 190, ellipsis: true },
    { title: '产品编码', dataIndex: 'inv_code', width: 210, ellipsis: true },
    { title: '产品名称', dataIndex: 'inv_name', width: 220, ellipsis: true },
    { title: '规格', dataIndex: 'inv_std', width: 170, ellipsis: true },
    { title: '计划数量', dataIndex: 'plan_qty', width: 110, align: 'right', render: (_, row) => quantity(row.plan_qty) },
    { title: '工艺路线', dataIndex: 'route_name', width: 190, ellipsis: true },
    { title: '序号', dataIndex: 'process_seq', width: 70 },
    { title: '工序名称', dataIndex: 'process_name', width: 130 },
    { title: '工站', dataIndex: 'station_name', width: 140, renderText: (value) => value || '—' },
    { title: '状态', dataIndex: 'process_status', width: 100, render: (_, row) => <Tag color={statusColor(row.process_status)}>{row.process_status}</Tag> },
    { title: '累计接收', dataIndex: 'normal_received_qty', width: 110, align: 'right', render: (_, row) => quantity(row.normal_received_qty) },
    { title: '累计完工', dataIndex: 'normal_done_qty', width: 110, align: 'right', render: (_, row) => quantity(row.normal_done_qty) },
    { title: 'A', dataIndex: 'qty_a', width: 75, align: 'right' },
    { title: 'A1', dataIndex: 'qty_a1', width: 75, align: 'right' },
    { title: 'A2', dataIndex: 'qty_a2', width: 75, align: 'right' },
    { title: 'C', dataIndex: 'qty_c', width: 75, align: 'right' },
    { title: '待完', dataIndex: 'normal_remaining_qty', width: 90, align: 'right', render: (_, row) => quantity(row.normal_remaining_qty) },
    { title: '首次开工', dataIndex: 'first_start_time', width: 165, renderText: (value) => value || '—' },
    { title: '最后报工', dataIndex: 'last_report_time', width: 165, renderText: (value) => value || '—' },
    { title: '工序完工', dataIndex: 'process_end_time', width: 165, renderText: (value) => value || '—' },
    { title: '工序历时', dataIndex: 'elapsed_minutes', width: 125, render: (_, row) => duration(row.elapsed_minutes) },
    { title: '标准任务时间', dataIndex: 'standard_task_minutes', width: 135, render: (_, row) => duration(row.standard_task_minutes) },
    { title: '时间达成率', dataIndex: 'time_ratio', width: 120, render: (_, row) => row.time_ratio == null ? '—' : <Tag color={row.time_ratio > 1 ? 'red' : 'green'}>{(row.time_ratio * 100).toFixed(2)}%</Tag> },
    { title: '开工人员', dataIndex: 'worker_names', width: 190, renderText: (value) => value || '—' },
    { title: '人数', dataIndex: 'worker_count', width: 75 },
    { title: '返工人员', dataIndex: 'rework_worker_names', width: 170, renderText: (value) => value || '—' },
    { title: '标准人数', dataIndex: 'standard_staffing', width: 100, renderText: (value) => value ?? '—' },
    { title: '人员配置', dataIndex: 'staffing_status', width: 115, render: (_, row) => <Tag color={staffingColor(row.staffing_status)}>{row.staffing_status}</Tag> },
    { title: '异常', dataIndex: 'issues', width: 220, fixed: 'right', render: (_, row) => row.issues.length ? <Tag color="red">{row.issues.join('、')}</Tag> : '—' },
  ];

  const rangeValue = dates?.map((value) => dayjs(value)) as [Dayjs, Dayjs] | undefined;
  return (
    <PageContainer title="工单工序工时与人员分配">
      <div ref={scrollRef}>
        <ProTable<ProcessLaborRow>
          headerTitle={`工序记录（${filteredRows.length}）`}
          rowKey={(row) => `${row.mo_code}-${row.sort_seq}-${row.route_id}-${row.process_seq}`}
          loading={loading}
          columns={columns}
          dataSource={filteredRows}
          search={false}
          options={false}
          pagination={false}
          virtual
          scroll={{ x: 4100, y: scrollHeight }}
          expandable={{
            rowExpandable: (row) => row.details.length > 0,
            expandedRowRender: (row) => (
              <Table<ProcessLaborDetail>
                size="small"
                rowKey={(item) => `${item.kind}-${item.record_id}-${item.complete_time || 'open'}`}
                columns={detailColumns}
                dataSource={row.details}
                pagination={false}
                scroll={{ x: 1200 }}
              />
            ),
          }}
          toolBarRender={() => [
            <DatePicker.RangePicker
              key="dates"
              allowClear={false}
              value={rangeValue}
              maxDate={dayjs()}
              onChange={(value) => value && setDates([
                value[0]?.format('YYYY-MM-DD') || '',
                value[1]?.format('YYYY-MM-DD') || '',
              ])}
            />,
            <Input key="keyword" allowClear placeholder="工单、产品、工序、工站或人员" value={keyword} style={{ width: 260 }} onChange={(event) => setKeyword(event.target.value)} />,
            <Select key="status" value={status} style={{ width: 125 }} options={['all', '未开始', '待开工', '进行中', '已完成', '返工中'].map((value) => ({ value, label: value === 'all' ? '全部状态' : value }))} onChange={setStatus} />,
            <Select key="staffing" value={staffing} style={{ width: 135 }} options={['all', '未分配', '未设标准', '人数不足', '配置正常', '人数超配'].map((value) => ({ value, label: value === 'all' ? '全部人员状态' : value }))} onChange={setStaffing} />,
            <Space key="actions">
              <Button onClick={() => { setKeyword(''); setStatus('all'); setStaffing('all'); }}>重置</Button>
              <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>刷新</Button>
              <Button type="primary" icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>导出 Excel</Button>
            </Space>,
          ]}
        />
      </div>
    </PageContainer>
  );
};

export default ProcessLaborReportPage;
