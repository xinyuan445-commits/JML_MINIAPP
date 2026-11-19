import { PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import {
  App,
  AutoComplete,
  Button,
  Card,
  Empty,
  Form,
  Select,
  Space,
  Spin,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  authorizeCompletionFlowPrint,
  type CompletionFlowData,
  type CompletionFlowRow,
  getCompletionFlowLines,
  getCompletionFlowOptions,
  getCompletionFlowReport,
} from './service';

const REPORT_STYLES = `
  .completion-flow-sheet { min-width: 1180px; color: #111; background: #fff; }
  .completion-flow-title { margin-bottom: 10px; text-align: center; font-size: 22px; font-weight: 700; }
  .completion-flow-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid #333; border-left: 1px solid #333; }
  .completion-flow-meta > div { display: flex; min-height: 34px; border-right: 1px solid #333; border-bottom: 1px solid #333; }
  .completion-flow-meta strong { display: flex; width: 88px; flex: none; align-items: center; justify-content: center; background: #f2f2f2; }
  .completion-flow-meta span { display: flex; min-width: 0; align-items: center; padding: 4px 7px; word-break: break-all; }
  .completion-flow-print-time { margin: 6px 0; text-align: right; font-size: 12px; }
  .completion-flow-summary { display: flex; align-items: center; gap: 14px; margin: 6px 0; padding: 7px 10px; border: 1px solid #ffccc7; background: #fff2f0; }
  .completion-flow-summary strong { flex: none; color: #cf1322; font-size: 15px; }
  .completion-flow-summary span { color: #820014; font-weight: 600; }
  .completion-flow-summary-ok { border-color: #b7eb8f; background: #f6ffed; }
  .completion-flow-summary-ok strong, .completion-flow-summary-ok span { color: #237804; }
  .completion-flow-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
  .completion-flow-table th, .completion-flow-table td { border: 1px solid #333; padding: 5px 4px; text-align: center; vertical-align: middle; }
  .completion-flow-table thead { display: table-header-group; }
  .completion-flow-table th { background: #e8edf3; font-weight: 700; }
  .completion-flow-table tbody tr { break-inside: avoid; }
  .completion-flow-process { text-align: left !important; }
  .completion-flow-process strong, .completion-flow-process span { display: block; }
  .completion-flow-process span { margin-top: 2px; color: #666; }
  .completion-flow-ok { color: #389e0d; font-weight: 700; }
  .completion-flow-warn { color: #d46b08; font-weight: 700; }
  .completion-flow-error { color: #cf1322; font-weight: 700; }
  .completion-flow-review { text-align: left !important; }
  .completion-flow-review span { display: block; line-height: 1.5; }
  .completion-flow-row-review { background: #fffbe6; }
  .completion-flow-note { margin-top: 8px; font-size: 12px; color: #555; }
  .completion-flow-sheet + .completion-flow-sheet { margin-top: 16px; }
  @page { size: A4 landscape; margin: 6mm; }
  @media print {
    html, body { margin: 0; padding: 0; background: #fff; }
    .completion-flow-sheet { min-width: 0; width: 100%; margin-bottom: 5mm; break-inside: avoid-page; page-break-inside: avoid; }
    .completion-flow-sheet:last-child { margin-bottom: 0; }
    .completion-flow-title { font-size: 16px; margin-bottom: 4px; }
    .completion-flow-meta > div { min-height: 25px; }
    .completion-flow-meta strong { width: 19mm; }
    .completion-flow-meta, .completion-flow-table { font-size: 8px; }
    .completion-flow-table th, .completion-flow-table td { padding: 2px 1px; line-height: 1.2; }
    .completion-flow-summary { gap: 3mm; margin: 2mm 0; padding: 1.5mm 2mm; }
    .completion-flow-summary strong { font-size: 9px; }
    .completion-flow-summary span, .completion-flow-note, .completion-flow-print-time { font-size: 8px; }
  }
`;

const numberText = (value?: number | null) =>
  value == null
    ? '—'
    : Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 4 });

const differenceCell = (
  value: number | null,
  positiveText: string,
  negativeText: string,
) => {
  if (value == null) return <span>—</span>;
  if (Math.abs(value) <= 0.0001) {
    return <span className="completion-flow-ok">一致</span>;
  }
  if (value > 0) {
    return (
      <span className="completion-flow-warn">
        {positiveText} {numberText(value)}
      </span>
    );
  }
  return (
    <span className="completion-flow-error">
      {negativeText} {numberText(Math.abs(value))}
    </span>
  );
};

type ReviewItem = {
  type: 'receive' | 'completion' | 'downstream' | 'grade' | 'missing';
  text: string;
  className: string;
};

const hasDifference = (value: number | null) =>
  value != null && Math.abs(value) > 0.0001;

const rowReviewItems = (row: CompletionFlowRow): ReviewItem[] => {
  const items: ReviewItem[] = [];
  if (row.previous_done_qty != null && row.received_qty == null) {
    items.push({
      type: 'missing',
      text: '接收记录缺失',
      className: 'completion-flow-error',
    });
  }
  if (hasDifference(row.receive_difference)) {
    const value = row.receive_difference as number;
    items.push({
      type: 'receive',
      text:
        value > 0
          ? `接收少 ${numberText(value)}`
          : `接收超 ${numberText(Math.abs(value))}`,
      className: 'completion-flow-error',
    });
  }
  if (hasDifference(row.completion_difference)) {
    const value = row.completion_difference as number;
    items.push({
      type: 'completion',
      text:
        value > 0
          ? `未完工 ${numberText(value)}`
          : `完工超接收 ${numberText(Math.abs(value))}`,
      className: 'completion-flow-warn',
    });
  }
  if (hasDifference(row.downstream_difference)) {
    const value = row.downstream_difference as number;
    items.push({
      type: 'downstream',
      text:
        value > 0
          ? `下步少接收 ${numberText(value)}`
          : `下步超接收 ${numberText(Math.abs(value))}`,
      className: 'completion-flow-error',
    });
  }
  const gradeQty = row.qty_a1 + row.qty_a2 + row.qty_c;
  if (gradeQty > 0.0001) {
    items.push({
      type: 'grade',
      text: `等级品 ${numberText(gradeQty)}（A1 ${numberText(row.qty_a1)} / A2 ${numberText(row.qty_a2)} / C ${numberText(row.qty_c)}）`,
      className:
        row.qty_c > 0 ? 'completion-flow-error' : 'completion-flow-warn',
    });
  }
  return items;
};

const reportReviewSummary = (report: CompletionFlowData) => {
  const items = report.rows.flatMap(rowReviewItems);
  const parts = [
    ['receive', '接收差异'],
    ['completion', '完工差异'],
    ['downstream', '下步差异'],
    ['missing', '资料缺失'],
  ]
    .map(([type, label]) => {
      const count = items.filter((item) => item.type === type).length;
      return count ? `${label} ${count} 处` : '';
    })
    .filter(Boolean);
  const gradeCount = items.filter((item) => item.type === 'grade').length;
  if (gradeCount) parts.push(`等级品记录 ${gradeCount} 处`);
  return { items, description: parts.join(' · ') };
};

const fmtNow = () =>
  new Date().toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

type QueryForm = {
  mo_code: string;
  sort_seq: number;
};

const CompletionFlowReportPage: React.FC = () => {
  const { message } = App.useApp();
  const access = useAccess();
  const [form] = Form.useForm<QueryForm>();
  const selectedMoCode = Form.useWatch('mo_code', form);
  const [orderOptions, setOrderOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [lineOptions, setLineOptions] = useState<
    { label: string; value: number }[]
  >([]);
  const [lineLoading, setLineLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CompletionFlowData[]>([]);
  const [searched, setSearched] = useState(false);
  const [printTime, setPrintTime] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const searchOrders = (value: string) => {
    clearTimeout(searchTimer.current);
    const keyword = value.trim();
    if (!keyword) {
      setOrderOptions([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const result = await getCompletionFlowOptions(keyword);
        setOrderOptions(
          result.code === 0
            ? (result.data || []).map((item) => ({ label: item, value: item }))
            : [],
        );
      } catch {
        setOrderOptions([]);
      }
    }, 300);
  };

  const loadLines = async (moCode: string) => {
    const value = moCode.trim();
    form.setFieldValue('sort_seq', undefined);
    setLineOptions([]);
    if (!value) return;
    setLineLoading(true);
    try {
      const result = await getCompletionFlowLines(value);
      if (result.code !== 0) {
        message.error(result.msg || '生产订单行加载失败');
        return;
      }
      const options = (result.data || []).map((item) => ({
        value: item.sort_seq,
        label: `行号 ${item.sort_seq} · ${item.inv_code || item.inv_name || '产品待补'}`,
      }));
      setLineOptions(options);
      if (options.length === 1) {
        form.setFieldValue('sort_seq', options[0].value);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.msg || '生产订单行加载失败');
    } finally {
      setLineLoading(false);
    }
  };

  const handleSearch = async (values: QueryForm) => {
    setLoading(true);
    try {
      const result = await getCompletionFlowReport(
        values.mo_code.trim(),
        values.sort_seq,
      );
      if (result.code !== 0) {
        setData([]);
        setSearched(false);
        message.error(result.msg || '查询失败');
        return;
      }
      setData(result.data || []);
      setSearched(true);
      setPrintTime(fmtNow());
    } catch (error: any) {
      setData([]);
      setSearched(false);
      message.error(error?.response?.data?.msg || '工序完工报表读取失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!data.length || !access.can('completion-flow-report.print')) return;
    const reportRoot = document.getElementById('completion-flow-print-root');
    if (!reportRoot) return;
    const win = window.open('', '_blank');
    if (!win) {
      message.error('浏览器拦截了打印窗口，请允许弹窗后重试');
      return;
    }
    try {
      const result = await authorizeCompletionFlowPrint(data[0].header.mo_code);
      if (result.code !== 0) throw new Error(result.msg || '打印未获授权');
    } catch (error: any) {
      win.close();
      message.error(
        error?.response?.data?.msg || error?.message || '打印未获授权',
      );
      return;
    }
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"/><title>工序完工报表打印</title><style>${REPORT_STYLES}</style></head><body>${reportRoot.outerHTML}</body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  };

  const rowView = (row: CompletionFlowRow) => {
    const reviewItems = rowReviewItems(row);
    return (
      <tr
        key={row.seq}
        className={reviewItems.length ? 'completion-flow-row-review' : ''}
      >
        <td>{row.seq}</td>
        <td className="completion-flow-process">
          <strong>{row.process_name}</strong>
          <span>
            {row.station_name || '未标工站'} · {row.process_status}
          </span>
        </td>
        <td className="completion-flow-review">
          {reviewItems.length ? (
            reviewItems.map((item) => (
              <span key={item.type} className={item.className}>
                {item.text}
              </span>
            ))
          ) : (
            <span className="completion-flow-ok">数量一致</span>
          )}
        </td>
        <td>{numberText(row.previous_done_qty)}</td>
        <td>{numberText(row.received_qty)}</td>
        <td>{differenceCell(row.receive_difference, '少接收', '超收')}</td>
        <td>{numberText(row.done_qty)}</td>
        <td>{numberText(row.qty_a)}</td>
        <td className={row.qty_a1 > 0 ? 'completion-flow-warn' : ''}>
          {numberText(row.qty_a1)}
        </td>
        <td className={row.qty_a2 > 0 ? 'completion-flow-warn' : ''}>
          {numberText(row.qty_a2)}
        </td>
        <td className={row.qty_c > 0 ? 'completion-flow-error' : ''}>
          {numberText(row.qty_c)}
        </td>
        <td>{differenceCell(row.completion_difference, '未完工', '超完工')}</td>
        <td>{numberText(row.next_received_qty)}</td>
        <td>
          {differenceCell(row.downstream_difference, '下步少接收', '下步超收')}
        </td>
      </tr>
    );
  };

  return (
    <PageContainer title="工序完工报表打印">
      <Card>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Form.Item
            label="生产订单号"
            name="mo_code"
            rules={[{ required: true, message: '请选择生产订单号' }]}
          >
            <AutoComplete
              allowClear
              options={orderOptions}
              placeholder="输入生产订单号"
              style={{ width: 260 }}
              onSearch={searchOrders}
              onChange={() => {
                form.setFieldValue('sort_seq', undefined);
                setLineOptions([]);
              }}
              onSelect={(value) => void loadLines(value)}
              onBlur={() => {
                const value = form.getFieldValue('mo_code')?.trim();
                if (value && !lineOptions.length) void loadLines(value);
              }}
            />
          </Form.Item>
          <Form.Item
            label="生产订单行号"
            name="sort_seq"
            rules={[{ required: true, message: '请选择生产订单行号' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              loading={lineLoading}
              disabled={!selectedMoCode}
              options={lineOptions}
              placeholder="选择行号"
              style={{ width: 300 }}
              notFoundContent={lineLoading ? '加载中' : '请先选择生产订单号'}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SearchOutlined />}
                loading={loading}
              >
                查询
              </Button>
              <Button
                onClick={() => {
                  form.resetFields();
                  setOrderOptions([]);
                  setLineOptions([]);
                  setData([]);
                  setSearched(false);
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Spin spinning={loading}>
        {data.length ? (
          <Card
            style={{ marginTop: 16 }}
            extra={
              access.can('completion-flow-report.print') ? (
                <Button
                  type="primary"
                  icon={<PrinterOutlined />}
                  onClick={handlePrint}
                >
                  打印
                </Button>
              ) : null
            }
          >
            <div style={{ overflowX: 'auto' }}>
              <div id="completion-flow-print-root">
                {data.map((report) => {
                  const reviewSummary = reportReviewSummary(report);
                  return (
                    <div
                      key={`${report.header.mo_code}-${report.header.sort_seq}`}
                      className="completion-flow-sheet"
                    >
                      <div className="completion-flow-title">
                        生产工序完工流转报表
                      </div>
                      <div className="completion-flow-meta">
                        <div>
                          <strong>生产订单号</strong>
                          <span>{report.header.mo_code}</span>
                        </div>
                        <div>
                          <strong>行号</strong>
                          <span>{report.header.sort_seq}</span>
                        </div>
                        <div>
                          <strong>客户</strong>
                          <span>{report.header.customer_name || '—'}</span>
                        </div>
                        <div>
                          <strong>计划数量</strong>
                          <span>{numberText(report.header.plan_qty)}</span>
                        </div>
                        <div>
                          <strong>产品编码</strong>
                          <span>{report.header.inv_code || '—'}</span>
                        </div>
                        <div>
                          <strong>产品名称</strong>
                          <span>{report.header.inv_name || '—'}</span>
                        </div>
                        <div>
                          <strong>规格型号</strong>
                          <span>{report.header.inv_std || '—'}</span>
                        </div>
                        <div>
                          <strong>工艺路线</strong>
                          <span>{report.header.route_name || '—'}</span>
                        </div>
                      </div>
                      <div className="completion-flow-print-time">
                        打印时间：{printTime}
                      </div>
                      <div
                        className={`completion-flow-summary${
                          reviewSummary.items.length
                            ? ''
                            : ' completion-flow-summary-ok'
                        }`}
                      >
                        <strong>
                          {reviewSummary.items.length
                            ? `待核对 ${reviewSummary.items.length} 项`
                            : '数量一致'}
                        </strong>
                        <span>
                          {reviewSummary.description || '各工序流转数量一致'}
                        </span>
                      </div>
                      <table className="completion-flow-table">
                        <thead>
                          <tr>
                            <th rowSpan={2} style={{ width: 42 }}>
                              序号
                            </th>
                            <th rowSpan={2} style={{ width: 150 }}>
                              工序 / 工站
                            </th>
                            <th rowSpan={2} style={{ width: 158 }}>
                              待核对内容
                            </th>
                            <th rowSpan={2}>上一步完工</th>
                            <th colSpan={2}>接收</th>
                            <th colSpan={6}>本工序完工</th>
                            <th colSpan={2}>下一步</th>
                          </tr>
                          <tr>
                            <th>累计接收</th>
                            <th>接收差异</th>
                            <th>累计完工</th>
                            <th>A</th>
                            <th>A1</th>
                            <th>A2</th>
                            <th>C</th>
                            <th>完工差异</th>
                            <th>累计接收</th>
                            <th>下步差异</th>
                          </tr>
                        </thead>
                        <tbody>{report.rows.map(rowView)}</tbody>
                      </table>
                      <div className="completion-flow-note">
                        优先核对红色、橙色内容；差异为0时显示“数量一致”。A、A1、A2、C分别显示本工序累计等级数量，缺少历史交接资料时显示“—”。
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        ) : (
          <Card style={{ marginTop: 16 }}>
            <Empty
              description={
                searched
                  ? '该生产订单暂无末工序已完成的工单行'
                  : '请选择生产订单号和行号查询'
              }
            />
          </Card>
        )}
      </Spin>
      <style>{REPORT_STYLES}</style>
    </PageContainer>
  );
};

export default CompletionFlowReportPage;
