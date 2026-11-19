import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { PageContainer, type ProColumns, ProTable } from '@ant-design/pro-components';
import { App, Button, Input, InputNumber, Select, Space, Tag } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { exportReceiptComparisonExcel } from './exportExcel';
import {
  getReceiptComparison,
  type ReceiptComparisonRow,
} from './service';

type ResultFilter = 'all' | 'consistent' | 'inconsistent';

const quantityText = (value: number | null | undefined) =>
  value == null
    ? '—'
    : value.toLocaleString('zh-CN', { maximumFractionDigits: 4 });

const statusText = (status: string) => {
  if (status === 'done') return '已完成';
  if (status === 'processing') return '生产中';
  if (status === 'pending') return '待处理';
  return status || '—';
};

const ReceiptComparisonPage: React.FC = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState<ReceiptComparisonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [moCode, setMoCode] = useState('');
  const [sortSeq, setSortSeq] = useState<number | null>(null);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getReceiptComparison();
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
    const keyword = moCode.trim().toLowerCase();
    return rows.filter((row) => {
      if (keyword && !row.mo_code.toLowerCase().includes(keyword)) return false;
      if (sortSeq !== null && row.sort_seq !== sortSeq) return false;
      if (resultFilter === 'consistent' && !row.is_consistent) return false;
      if (resultFilter === 'inconsistent' && row.is_consistent) return false;
      return true;
    });
  }, [moCode, resultFilter, rows, sortSeq]);

  const handleExport = async () => {
    if (!filteredRows.length) {
      message.warning('没有可导出的数据');
      return;
    }
    setExporting(true);
    try {
      await exportReceiptComparisonExcel(filteredRows);
      message.success(`已导出 ${filteredRows.length} 条`);
    } catch {
      message.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  const columns: ProColumns<ReceiptComparisonRow>[] = [
    { title: '工单号', dataIndex: 'mo_code', width: 180, fixed: 'left' },
    { title: '行号', dataIndex: 'sort_seq', width: 80 },
    { title: '产品编码', dataIndex: 'inv_code', width: 220, ellipsis: true },
    { title: '产品名称', dataIndex: 'inv_name', width: 240, ellipsis: true },
    { title: '规格型号', dataIndex: 'inv_std', width: 180, ellipsis: true },
    {
      title: '计划数量',
      dataIndex: 'plan_qty',
      width: 120,
      align: 'right',
      render: (_, row) => quantityText(row.plan_qty),
    },
    {
      title: '工单状态',
      dataIndex: 'workorder_status',
      width: 110,
      render: (_, row) => statusText(row.workorder_status),
    },
    {
      title: '工单关闭原因',
      dataIndex: 'workorder_close_reason',
      width: 220,
      ellipsis: true,
      renderText: (value) => value || '—',
    },
    { title: '最后工序', dataIndex: 'last_process_name', width: 160 },
    {
      title: '末工序完工时间',
      dataIndex: 'final_process_end_time',
      width: 180,
      renderText: (value) => value || '—',
    },
    {
      title: '末工序完工数量',
      dataIndex: 'final_process_qty',
      width: 130,
      align: 'right',
      render: (_, row) => quantityText(row.final_process_qty),
    },
    {
      title: 'ERP已审核入库',
      dataIndex: 'erp_in_qty',
      width: 150,
      align: 'right',
      render: (_, row) => quantityText(row.erp_in_qty),
    },
    {
      title: '差额',
      dataIndex: 'difference',
      width: 120,
      align: 'right',
      render: (_, row) => quantityText(row.difference),
    },
    {
      title: '对账结果',
      dataIndex: 'compare_result',
      width: 110,
      fixed: 'right',
      render: (_, row) => (
        <Tag color={row.is_consistent ? 'green' : 'red'}>
          {row.compare_result}
        </Tag>
      ),
    },
  ];

  return (
    <PageContainer>
      <ProTable<ReceiptComparisonRow>
        headerTitle={`末工序入库对账（${filteredRows.length}）`}
        rowKey={(row) => `${row.mo_code}-${row.sort_seq}`}
        loading={loading}
        columns={columns}
        dataSource={filteredRows}
        search={false}
        options={false}
        pagination={false}
        scroll={{ x: 2220 }}
        toolBarRender={() => [
          <Input
            key="mo-code"
            allowClear
            placeholder="筛选工单号"
            value={moCode}
            style={{ width: 210 }}
            onChange={(event) => setMoCode(event.target.value)}
          />,
          <InputNumber
            key="sort-seq"
            aria-label="筛选行号"
            controls={false}
            min={1}
            precision={0}
            placeholder="行号"
            value={sortSeq}
            style={{ width: 100 }}
            onChange={setSortSeq}
          />,
          <Select<ResultFilter>
            key="result"
            aria-label="筛选对账结果"
            value={resultFilter}
            style={{ width: 130 }}
            options={[
              { label: '全部结果', value: 'all' },
              { label: '一致', value: 'consistent' },
              { label: '不一致', value: 'inconsistent' },
            ]}
            onChange={setResultFilter}
          />,
          <Space key="actions">
            <Button
              onClick={() => {
                setMoCode('');
                setSortSeq(null);
                setResultFilter('all');
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
    </PageContainer>
  );
};

export default ReceiptComparisonPage;
