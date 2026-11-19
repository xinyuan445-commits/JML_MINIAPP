import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { PageContainer, type ProColumns, ProTable } from '@ant-design/pro-components';
import { App, Button, Input, Select, Space, Tag } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useViewportScrollHeight } from '@/hooks/useViewportScrollHeight';
import { exportWorkorderProcessExcel } from './exportExcel';
import {
  getWorkorderProcessReport,
  type WorkorderProcessRow,
} from './service';

type PrintFilter = 'all' | 'printed' | 'not-printed';

const quantityText = (value: number | null) =>
  value == null
    ? '—'
    : value.toLocaleString('zh-CN', { maximumFractionDigits: 4 });

const statusColor = (status: string) => {
  if (status === '已完成') return 'green';
  if (status === '进行中') return 'blue';
  if (status === '已中断') return 'red';
  return 'default';
};

const WorkorderProcessReportPage: React.FC = () => {
  const { message } = App.useApp();
  const { scrollRef, scrollHeight } = useViewportScrollHeight();
  const [rows, setRows] = useState<WorkorderProcessRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [printFilter, setPrintFilter] = useState<PrintFilter>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getWorkorderProcessReport();
      setRows(result.data);
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
      if (
        search &&
        ![
          row.mo_code,
          row.customer_name,
          row.inv_code,
          row.inv_name,
          row.inv_std,
          row.route_name,
          row.process_name,
          row.station_name,
          row.worker_names,
        ].some((value) => String(value || '').toLowerCase().includes(search))
      ) {
        return false;
      }
      if (status !== 'all' && row.process_status !== status) return false;
      if (printFilter === 'printed' && !row.label_printed) return false;
      if (printFilter === 'not-printed' && row.label_printed) return false;
      return true;
    });
  }, [keyword, printFilter, rows, status]);

  const handleExport = async () => {
    if (!filteredRows.length) {
      message.warning('没有可导出的数据');
      return;
    }
    setExporting(true);
    try {
      await exportWorkorderProcessExcel(filteredRows);
      message.success(`已导出 ${filteredRows.length} 条`);
    } catch {
      message.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  const columns: ProColumns<WorkorderProcessRow>[] = [
    { title: '生产订单号', dataIndex: 'mo_code', width: 170, fixed: 'left' },
    { title: '生产订单行号', dataIndex: 'sort_seq', width: 120, fixed: 'left' },
    { title: '客户名称', dataIndex: 'customer_name', width: 220, ellipsis: true },
    { title: '产品编码', dataIndex: 'inv_code', width: 220, ellipsis: true },
    { title: '产品名称', dataIndex: 'inv_name', width: 240, ellipsis: true },
    { title: '规格型号', dataIndex: 'inv_std', width: 200, ellipsis: true },
    { title: '工艺路线', dataIndex: 'route_name', width: 220, ellipsis: true },
    { title: '工序序号', dataIndex: 'process_seq', width: 100 },
    { title: '工序名称', dataIndex: 'process_name', width: 150 },
    { title: '工站', dataIndex: 'station_name', width: 150, renderText: (value) => value || '—' },
    {
      title: '工序状态',
      dataIndex: 'process_status',
      width: 110,
      render: (_, row) => (
        <Tag color={statusColor(row.process_status)}>{row.process_status}</Tag>
      ),
    },
    { title: '开工人员', dataIndex: 'worker_names', width: 180, renderText: (value) => value || '—' },
    { title: '开工时间', dataIndex: 'start_time', width: 170, renderText: (value) => value || '—' },
    { title: '完工时间', dataIndex: 'end_time', width: 170, renderText: (value) => value || '—' },
    { title: '工序用时', dataIndex: 'duration_text', width: 140, renderText: (value) => value || '—' },
    { title: '计划生产数量', dataIndex: 'plan_qty', width: 140, align: 'right', render: (_, row) => quantityText(row.plan_qty) },
    { title: '累计完工数量', dataIndex: 'qty_done', width: 140, align: 'right', render: (_, row) => quantityText(row.qty_done) },
    { title: 'A级数量', dataIndex: 'qty_a', width: 110, align: 'right', render: (_, row) => quantityText(row.qty_a) },
    { title: 'A1级数量', dataIndex: 'qty_a1', width: 110, align: 'right', render: (_, row) => quantityText(row.qty_a1) },
    { title: 'A2级数量', dataIndex: 'qty_a2', width: 110, align: 'right', render: (_, row) => quantityText(row.qty_a2) },
    { title: 'C级数量', dataIndex: 'qty_c', width: 110, align: 'right', render: (_, row) => quantityText(row.qty_c) },
    {
      title: '是否打印流转标签',
      dataIndex: 'label_printed',
      width: 160,
      render: (_, row) => (
        <Tag color={row.label_printed ? 'green' : 'default'}>
          {row.label_printed ? '是' : '否'}
        </Tag>
      ),
    },
    { title: '标签打印次数', dataIndex: 'print_count', width: 130, align: 'right' },
    { title: '剩余未完成工序', dataIndex: 'remaining_processes', width: 300, ellipsis: true, fixed: 'right' },
  ];

  return (
    <PageContainer>
      <div ref={scrollRef}>
        <ProTable<WorkorderProcessRow>
        headerTitle={`工单工序报告（${filteredRows.length}）`}
        rowKey={(row) => `${row.mo_code}-${row.sort_seq}-${row.process_seq}`}
        loading={loading}
        columns={columns}
        dataSource={filteredRows}
        search={false}
        options={false}
        pagination={false}
        virtual
        scroll={{ x: 3950, y: scrollHeight }}
        toolBarRender={() => [
          <Input
            key="keyword"
            allowClear
            placeholder="搜索工单、客户、产品、工序或工站"
            value={keyword}
            style={{ width: 300 }}
            onChange={(event) => setKeyword(event.target.value)}
          />,
          <Select
            key="status"
            aria-label="筛选工序状态"
            value={status}
            style={{ width: 130 }}
            options={[
              { label: '全部状态', value: 'all' },
              { label: '未开始', value: '未开始' },
              { label: '进行中', value: '进行中' },
              { label: '已完成', value: '已完成' },
              { label: '已中断', value: '已中断' },
            ]}
            onChange={setStatus}
          />,
          <Select<PrintFilter>
            key="print"
            aria-label="筛选标签打印状态"
            value={printFilter}
            style={{ width: 140 }}
            options={[
              { label: '全部标签状态', value: 'all' },
              { label: '已打印', value: 'printed' },
              { label: '未打印', value: 'not-printed' },
            ]}
            onChange={setPrintFilter}
          />,
          <Space key="actions">
            <Button
              onClick={() => {
                setKeyword('');
                setStatus('all');
                setPrintFilter('all');
              }}
            >
              重置
            </Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={handleExport}
            >
              导出 Excel
            </Button>
          </Space>,
        ]}
        />
      </div>
    </PageContainer>
  );
};

export default WorkorderProcessReportPage;
