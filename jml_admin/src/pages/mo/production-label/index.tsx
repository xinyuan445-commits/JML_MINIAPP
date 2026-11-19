import { PageContainer } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import {
  App,
  AutoComplete,
  Button,
  Card,
  Empty,
  Form,
  QRCode,
  Segmented,
  Space,
  Spin,
  Tag,
} from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  getOutsourceDocument,
  getOutsourceDocumentOptions,
  logOutsourceDocumentPrint,
} from '../../outsource/document-print/service';
import {
  getProductionLabel,
  getProductionLabelOptions,
  logProductionLabelPrint,
} from '../service';

type LabelHeader = {
  mo_code: string;
  vendor_name?: string;
  dept_name?: string;
  product_category?: string;
  start_date?: string;
  due_date?: string;
  create_user?: string;
  audit_user?: string;
  audit_time?: string;
  approved?: boolean;
};

type LabelLine = {
  line_no: number;
  detail_id?: number;
  inv_code?: string;
  inv_name?: string;
  inv_std?: string;
  qty?: number;
  unit_name?: string;
  lot_code?: string;
  customer_name?: string;
  process_route?: string;
  remark?: string;
  qr_value?: string;
};

type MaterialLine = {
  material_id?: number;
  order_line_no: number;
  material_line_no: number;
  material_code?: string;
  material_name?: string;
  material_std?: string;
  unit_name?: string;
  warehouse_name?: string;
  lot_no?: string;
  qty_required?: number;
};

type LabelData = {
  header: LabelHeader;
  lines: LabelLine[];
  materials: MaterialLine[];
};

const fmtDate = (value?: string) => {
  if (!value) return '';
  return value.slice(0, 10);
};

const fmtDateTime = (value: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
};

const ROWS_PER_PAGE = 6;
const MATERIAL_ROWS_PER_PAGE = 12;
const OUTSOURCE_MATERIAL_ROWS_PER_PAGE = 9;
const FINISHED_GOODS_ROWS_PER_PAGE = 10;

const OUTSOURCE_ORDER_STYLES = `
  .outsource-col-line { width: 5%; }
  .outsource-col-code { width: 20%; }
  .outsource-col-name { width: 25%; }
  .outsource-col-std { width: 15%; }
  .outsource-col-qty { width: 8%; }
  .outsource-col-unit { width: 5%; }
  .outsource-col-remark { width: 22%; }
  .outsource-center-cell { text-align: center; }
`;

const OUTSOURCE_MATERIAL_STYLES = `
  .outsource-material-footer {
    flex-shrink: 0;
    padding-top: 2mm;
    break-inside: avoid;
  }
  .outsource-material-signatures {
    display: grid;
    grid-template-columns: 1fr 1.4fr 1fr 1.4fr;
    gap: 6mm;
    min-height: 7mm;
    margin-bottom: 2mm;
    text-align: left;
    font-size: 12px;
    line-height: 1.5;
  }
  .outsource-material-signatures > span {
    display: flex;
    align-items: baseline;
    gap: 2mm;
    white-space: nowrap;
  }
  .outsource-signature-line {
    flex: 1;
    height: 5mm;
    border-bottom: 1px solid #333;
  }
`;

const FINISHED_GOODS_STYLES = `
  .finished-goods-detail-table {
    width: 100%;
    margin-top: 3mm;
    border-collapse: collapse;
    table-layout: fixed;
    flex: none;
  }
  .finished-goods-detail-table th,
  .finished-goods-detail-table td {
    border: 1px solid #333;
    padding: 2px 3px;
    vertical-align: middle;
    word-break: break-all;
    line-height: 1.25;
  }
  .finished-goods-detail-table th {
    text-align: center;
    font-weight: 600;
  }
  .finished-goods-detail-table thead { display: table-header-group; }
  .finished-goods-detail-table tbody tr {
    height: 12mm;
    break-inside: avoid;
  }
  .finished-goods-detail-table .finished-goods-qty { text-align: right; }
  .finished-goods-col-code { width: 16%; }
  .finished-goods-col-name { width: 27%; }
  .finished-goods-col-std { width: 9%; }
  .finished-goods-col-qty { width: 7%; }
  .finished-goods-col-grade { width: 5%; }
  .finished-goods-col-nc { width: 7%; }
  .finished-goods-col-remark { width: 9%; }
`;

const buildQrValue = (moCode?: string, lineNo?: string | number) => {
  const numericLineNo = Number(lineNo);
  return JSON.stringify({
    mocode: String(moCode || '').trim(),
    sortseq: Number.isFinite(numericLineNo)
      ? numericLineNo
      : String(lineNo || '').trim(),
  });
};

const ProductionLabelPage: React.FC<{
  documentType?: 'production' | 'outsource';
}> = ({ documentType = 'production' }) => {
  const isOutsource = documentType === 'outsource';
  const pageTitle = isOutsource ? '委外单据打印' : '生产标签打印';
  const orderTitle = isOutsource ? '委外订单' : '生产订单';
  const getLabel = isOutsource ? getOutsourceDocument : getProductionLabel;
  const getLabelOptions = isOutsource
    ? getOutsourceDocumentOptions
    : getProductionLabelOptions;
  const { message } = App.useApp();
  const [form] = Form.useForm<{ mo_code: string }>();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LabelData>();
  const [printTime, setPrintTime] = useState('');
  const [previewMode, setPreviewMode] = useState<'list' | 'double'>('list');
  const [moOptions, setMoOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const searchRequestRef = useRef(0);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => clearTimeout(searchTimerRef.current);
  }, []);

  useEffect(() => {
    const preview = previewRef.current;
    const parent = preview?.parentElement;
    const container = preview?.closest('.ant-pro-page-container');
    if (!preview || !parent || !container) return;

    const updatePreviewSize = () => {
      const top = preview.getBoundingClientRect().top + window.scrollY;
      const bottomPadding =
        Number.parseFloat(getComputedStyle(parent).paddingBottom) || 0;
      preview.style.setProperty(
        '--label-preview-height',
        `${Math.max(0, window.innerHeight - top - bottomPadding)}px`,
      );
      const pageWidth = (287 * 96) / 25.4;
      preview.style.setProperty(
        '--label-preview-scale',
        String(Math.min(1, (preview.clientWidth - 16) / (2 * pageWidth))),
      );
    };
    let resizeFrame = 0;
    const scheduleResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(updatePreviewSize);
    };
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(container);
    window.addEventListener('resize', scheduleResize);
    updatePreviewSize();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleResize);
      cancelAnimationFrame(resizeFrame);
    };
  }, []);

  const handleCandidateSearch = (value: string) => {
    clearTimeout(searchTimerRef.current);
    const keyword = value.trim();
    if (!keyword) {
      setMoOptions([]);
      return;
    }
    const requestId = ++searchRequestRef.current;
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await getLabelOptions(keyword);
        if (requestId === searchRequestRef.current && res.code === 0) {
          setMoOptions(
            (res.data || []).map((moCode) => ({
              label: moCode,
              value: moCode,
            })),
          );
        }
      } catch {
        if (requestId === searchRequestRef.current) setMoOptions([]);
      }
    }, 300);
  };

  const handleSearch = async (values: { mo_code: string }) => {
    const keyword = values.mo_code?.trim();
    if (!keyword) return;
    setLoading(true);
    try {
      const optionRes = await getLabelOptions(keyword);
      if (optionRes.code !== 0) {
        setData(undefined);
        message.error(optionRes.msg || `${orderTitle}查询失败`);
        return;
      }
      const candidates = optionRes.data || [];
      setMoOptions(
        candidates.map((moCode) => ({ label: moCode, value: moCode })),
      );
      const exact = candidates.find(
        (moCode) => moCode.toLowerCase() === keyword.toLowerCase(),
      );
      const moCode = exact || (candidates.length === 1 ? candidates[0] : '');
      if (!moCode) {
        setData(undefined);
        if (candidates.length > 1) {
          message.info(`匹配到多个${orderTitle}，请从候选列表中选择`);
        } else {
          message.error(`未找到${orderTitle}`);
        }
        return;
      }
      form.setFieldValue('mo_code', moCode);
      const res = await getLabel(moCode);
      if (res.code === 0) {
        setData(res.data);
        setPrintTime(fmtDateTime(new Date()));
        previewRef.current?.scrollTo(0, 0);
        return;
      }
      setData(undefined);
      message.error(res.msg || '查询失败');
    } catch (error: any) {
      setData(undefined);
      const backendMessage = error?.response?.data?.msg;
      message.error(backendMessage || 'U8数据库连接超时，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const header = data?.header;
  const lines = data?.lines || [];
  const materials = data?.materials || [];
  const pages = useMemo(() => {
    const result: LabelLine[][] = [];
    for (let i = 0; i < lines.length; i += ROWS_PER_PAGE) {
      result.push(lines.slice(i, i + ROWS_PER_PAGE));
    }
    return result.length ? result : [[]];
  }, [lines]);
  const materialPages = useMemo(() => {
    const result: MaterialLine[][] = [];
    const rowsPerPage = isOutsource
      ? OUTSOURCE_MATERIAL_ROWS_PER_PAGE
      : MATERIAL_ROWS_PER_PAGE;
    for (let i = 0; i < materials.length; i += rowsPerPage) {
      result.push(materials.slice(i, i + rowsPerPage));
    }
    return result.length ? result : [[]];
  }, [isOutsource, materials]);
  const materialPrintPages = (
    isOutsource ? ['第一联', '第二联'] : ['']
  ).flatMap((copyName) =>
    materialPages.map((pageMaterials, pageIndex) => ({
      pageMaterials,
      pageIndex,
      copyName,
    })),
  );
  const finishedGoodsPages = useMemo(() => {
    if (isOutsource) return [];
    const result: LabelLine[][] = [];
    for (let i = 0; i < lines.length; i += FINISHED_GOODS_ROWS_PER_PAGE) {
      result.push(lines.slice(i, i + FINISHED_GOODS_ROWS_PER_PAGE));
    }
    return result.length ? result : [[]];
  }, [isOutsource, lines]);

  const renderLabelHeader = (title: string) => (
    <>
      <div className="print-meta">打印时间：{printTime}</div>
      <div
        className={header?.approved ? 'label-title approved' : 'label-title'}
      >
        {title} - {header?.mo_code}
      </div>

      <table className="label-info-table">
        <tbody>
          <tr>
            <th>{orderTitle}号：</th>
            <td>{header?.mo_code}</td>
            <th>{isOutsource ? '委外供应商：' : '生产部门：'}</th>
            <td>{isOutsource ? header?.vendor_name : header?.dept_name}</td>
            <th>{isOutsource ? '委外部门：' : '产品类别：'}</th>
            <td>
              {isOutsource ? header?.dept_name : header?.product_category}
            </td>
            <th>{isOutsource ? '计划开工：' : '开工日期：'}</th>
            <td>{fmtDate(header?.start_date)}</td>
          </tr>
          <tr>
            <th>审核状态：</th>
            <td>
              <Tag color={header?.approved ? 'success' : 'default'}>
                {header?.approved ? '已审核' : '未审核'}
              </Tag>
            </td>
            <th>制单人：</th>
            <td>{header?.create_user}</td>
            <th>审核人：</th>
            <td>{header?.audit_user}</td>
            <th>{isOutsource ? '计划到货：' : '完工日期：'}</th>
            <td>{fmtDate(header?.due_date)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );

  const canPrint = useAccess().can(isOutsource ? 'outsource.print' : 'production-label.print');
  const handlePrint = async () => {
    if (!canPrint) return;
    const printRoot = document.getElementById('production-label-print-root');
    if (!printRoot) return;
    const printNode = printRoot.cloneNode(true) as HTMLElement;
    const printQrs = Array.from(
      printNode.querySelectorAll('[data-production-qr]'),
    );
    if (!isOutsource && printQrs.length !== lines.length) {
      message.error('二维码生成尚未完成，请稍后再打印');
      return;
    }
    const win = window.open('', '_blank');
    if (!win) {
      message.error('浏览器拦截了打印窗口，请允许弹窗后重试');
      return;
    }
    const printLog = {
      mo_code: data?.header.mo_code || '',
      line_count: lines.length,
    };
    try {
      const authorization = await (
      isOutsource
        ? logOutsourceDocumentPrint({
            ...printLog,
            material_count: materials.length,
            page_count: pages.length + materialPrintPages.length,
          })
        : logProductionLabelPrint(printLog)
      );
      if (authorization.code !== 0) throw new Error('打印授权失败');
    } catch {
      win.close();
      message.error('打印未获授权或服务不可用，请刷新后重试');
      return;
    }
    win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${pageTitle}</title>
  <style>
    ${FINISHED_GOODS_STYLES}
    ${OUTSOURCE_ORDER_STYLES}
    ${OUTSOURCE_MATERIAL_STYLES}
    @page { size: A4 landscape; margin: 5mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, "Microsoft YaHei", sans-serif;
    }
    .production-label-page {
      width: 287mm;
      margin: 0;
      background: #fff;
    }
    .label-print-sheet {
      width: 287mm;
      height: 200mm;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      background: #fff;
      color: #000;
      font-size: 9px;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
    .label-print-sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .print-meta {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 2mm;
      font-size: 9px;
    }
    .label-title {
      border: 1px solid #333;
      border-bottom: 0;
      padding: 4px 0;
      text-align: center;
      font-size: 16px;
      font-weight: 700;
    }
    .label-title.approved { background: #d9d9d9; }
    .label-info-table,
    .label-detail-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .label-info-table th,
    .label-info-table td,
    .label-detail-table th,
    .label-detail-table td {
      border: 1px solid #333;
      padding: 2px 3px;
      vertical-align: middle;
      word-break: break-all;
      line-height: 1.25;
    }
    .label-info-table th {
      width: 22mm;
      text-align: center;
      font-weight: 600;
      background: #f5f5f5;
    }
    .label-detail-table {
      margin-top: 3mm;
      flex: none;
    }
    .material-detail-table {
      flex: none;
    }
    .material-detail-table tbody tr {
      height: 12mm;
    }
    .material-center-cell,
    .material-qty-cell {
      position: relative;
      padding-top: 0 !important;
      padding-bottom: 0 !important;
      vertical-align: middle !important;
    }
    .material-center-content,
    .material-qty-content {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .label-detail-table th {
      text-align: center;
      background: #d9d9d9;
      font-weight: 600;
    }
    .label-detail-table tbody tr { height: 12mm; }
    .col-code { width: 18%; }
    .col-name { width: 23%; }
    .col-std { width: 12%; }
    .col-qty { width: 10%; }
    .col-track { width: 29%; }
    .col-qr { width: 8%; }
    .material-col-code { width: 25%; }
    .material-col-name { width: 25%; }
    .material-col-std { width: 13%; }
    .material-col-unit { width: 4%; }
    .material-col-warehouse { width: 10.5%; }
    .material-col-lot { width: 10.5%; }
    .material-col-required { width: 6%; }
    .material-col-issued { width: 6%; }
    .material-name-content {
      display: -webkit-box;
      overflow: hidden;
      white-space: normal;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 4;
    }
    .qr-cell {
      text-align: center;
      white-space: nowrap;
      word-break: normal !important;
    }
    .qr-text {
      margin-top: 1px;
      font-size: 9px;
      line-height: 1;
      white-space: nowrap;
    }
    .qr-img {
      width: 15mm !important;
      height: 15mm !important;
      margin: 0 auto;
      display: block;
    }
    .label-page-no {
      margin-top: auto;
      text-align: center;
      font-size: 9px;
    }
    .print-close-tip {
      display: none;
    }
    @media screen {
      .print-close-tip {
        position: fixed;
        right: 16px;
        top: 16px;
        display: block;
        padding: 8px 12px;
        border: 1px solid #d9d9d9;
        border-radius: 4px;
        background: #fff;
        font-size: 14px;
      }
      .print-close-tip button {
        margin-left: 8px;
      }
    }
    @media print {
      .print-close-tip {
        display: none !important;
      }
    }
  </style>
</head>
<body>
<div class="print-close-tip">打印完成后会自动关闭 <button onclick="window.close()">关闭</button></div>
${printNode.outerHTML}
<script>
  var closeTimer = null;
  function closePrintWindow() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      window.close();
    }, 300);
  }
  window.onafterprint = closePrintWindow;
  window.addEventListener('focus', function () {
    closeTimer = setTimeout(closePrintWindow, 800);
  });
  window.onload = function () {
    window.focus();
    setTimeout(function () {
      window.print();
      closeTimer = setTimeout(closePrintWindow, 1500);
    }, 200);
  };
</script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <PageContainer title={pageTitle}>
      <Card className="no-print" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Form.Item
            name="mo_code"
            label={`${orderTitle}号`}
            rules={[{ required: true, message: `请输入${orderTitle}号` }]}
          >
            <AutoComplete
              options={moOptions}
              placeholder={`输入完整或部分${orderTitle}号`}
              allowClear
              filterOption={false}
              onSearch={handleCandidateSearch}
              onSelect={() => form.submit()}
              style={{ width: 300 }}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                查询
              </Button>
              <Button disabled={!data || !canPrint} hidden={!canPrint} onClick={handlePrint}>
                打印
              </Button>
            </Space>
          </Form.Item>
        </Form>
        <div className="production-label-view-options">
          <span>预览方式：</span>
          <Segmented<'list' | 'double'>
            aria-label="预览方式"
            value={previewMode}
            options={[
              { label: '列表', value: 'list' },
              { label: '双列', value: 'double' },
            ]}
            onChange={(value) => {
              setPreviewMode(value);
              previewRef.current?.scrollTo(0, 0);
            }}
          />
        </div>
      </Card>

      <div
        ref={previewRef}
        className="production-label-preview"
        data-preview-mode={previewMode}
      >
        <Spin spinning={loading}>
          {!data ? (
            <Card>
              <Empty description={`请输入${orderTitle}号查询打印内容`} />
            </Card>
          ) : (
            <div
              className="production-label-page"
              id="production-label-print-root"
            >
              {pages.map((pageLines, pageIndex) => (
                <div
                  className="label-print-sheet"
                  key={`production-${pageLines[0]?.line_no ?? 'empty'}`}
                >
                  {renderLabelHeader(orderTitle)}

                  <table className="label-detail-table">
                    {isOutsource ? (
                      <colgroup>
                        <col className="outsource-col-line" />
                        <col className="outsource-col-code" />
                        <col className="outsource-col-name" />
                        <col className="outsource-col-std" />
                        <col className="outsource-col-qty" />
                        <col className="outsource-col-unit" />
                        <col className="outsource-col-remark" />
                      </colgroup>
                    ) : (
                      <colgroup>
                        <col className="col-code" />
                        <col className="col-name" />
                        <col className="col-std" />
                        <col className="col-qty" />
                        <col className="col-track" />
                        <col className="col-qr" />
                      </colgroup>
                    )}
                    <thead>
                      <tr>
                        {isOutsource && <th>行号</th>}
                        <th>物料编码</th>
                        <th>物料名称</th>
                        <th>规格型号</th>
                        <th>{isOutsource ? '委外数量' : '生产数量'}</th>
                        <th>{isOutsource ? '单位' : '需求跟踪号'}</th>
                        <th>{isOutsource ? '备注' : '二维码'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageLines.map((item) => {
                        if (isOutsource) {
                          return (
                            <tr
                              key={
                                item.detail_id ??
                                `${item.line_no}-${item.inv_code}`
                              }
                            >
                              <td className="outsource-center-cell">
                                {item.line_no}
                              </td>
                              <td>{item.inv_code}</td>
                              <td>{item.inv_name}</td>
                              <td>{item.inv_std}</td>
                              <td className="outsource-center-cell">
                                {item.qty}
                              </td>
                              <td className="outsource-center-cell">
                                {item.unit_name}
                              </td>
                              <td>{item.remark}</td>
                            </tr>
                          );
                        }
                        const qrValue = buildQrValue(
                          header?.mo_code,
                          item.line_no,
                        );
                        return (
                          <tr key={`${item.line_no}-${item.inv_code}`}>
                            <td>{item.inv_code}</td>
                            <td>{item.inv_name}</td>
                            <td>{item.inv_std}</td>
                            <td>
                              <div>数量：{item.qty}</div>
                              <div>批号：{item.lot_code}</div>
                            </td>
                            <td>
                              <div>客户名称：{item.customer_name}</div>
                              <div>工艺路线：{item.process_route}</div>
                              <div>工单备注：{item.remark}</div>
                            </td>
                            <td className="qr-cell">
                              <QRCode
                                key={qrValue}
                                value={qrValue}
                                type="svg"
                                size={56}
                                bordered={false}
                                data-production-qr={qrValue}
                              />
                              <div className="qr-text">{item.line_no}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="label-page-no">
                    第 {pageIndex + 1} / {pages.length} 页
                  </div>
                </div>
              ))}
              {materialPrintPages.map(
                ({ pageMaterials, pageIndex, copyName }) => (
                  <div
                    className="label-print-sheet"
                    key={`material-${copyName}-${pageMaterials[0]?.order_line_no ?? 'empty'}-${pageMaterials[0]?.material_line_no ?? 'empty'}`}
                  >
                    {renderLabelHeader(
                      isOutsource ? '委外领料单' : '生产领料单',
                    )}

                    <table className="label-detail-table material-detail-table">
                      <colgroup>
                        <col className="material-col-code" />
                        <col className="material-col-name" />
                        <col className="material-col-std" />
                        <col className="material-col-unit" />
                        <col className="material-col-warehouse" />
                        <col className="material-col-lot" />
                        <col className="material-col-required" />
                        <col className="material-col-issued" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>原材料编码</th>
                          <th>原材料名称</th>
                          <th>规格型号</th>
                          <th>单位</th>
                          <th>应领仓库</th>
                          <th>应领批次</th>
                          <th>应领数量</th>
                          <th>已领数量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageMaterials.map((item) => (
                          <tr
                            key={
                              item.material_id ??
                              `${item.order_line_no}-${item.material_line_no}-${item.material_code}`
                            }
                          >
                            <td>
                              [{item.order_line_no}] {item.material_code}
                            </td>
                            <td>
                              <div className="material-name-content">
                                {item.material_name}
                              </div>
                            </td>
                            <td>{item.material_std}</td>
                            <td className="material-center-cell">
                              <div className="material-center-content">
                                {item.unit_name}
                              </div>
                            </td>
                            <td>{item.warehouse_name}</td>
                            <td>{item.lot_no}</td>
                            <td className="material-qty-cell">
                              <div className="material-qty-content">
                                {item.qty_required}
                              </div>
                            </td>
                            <td />
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div
                      className={
                        isOutsource
                          ? 'label-page-no outsource-material-footer'
                          : 'label-page-no'
                      }
                    >
                      {isOutsource && (
                        <div className="outsource-material-signatures">
                          <span>
                            发货人：
                            <span className="outsource-signature-line" />
                          </span>
                          <span>
                            日期时间：
                            <span className="outsource-signature-line" />
                          </span>
                          <span>
                            司机：
                            <span className="outsource-signature-line" />
                          </span>
                          <span>
                            日期时间：
                            <span className="outsource-signature-line" />
                          </span>
                        </div>
                      )}
                      {copyName && `${copyName} · `}第 {pageIndex + 1} /{' '}
                      {materialPages.length} 页
                    </div>
                  </div>
                ),
              )}
              {finishedGoodsPages.map((pageLines, pageIndex) => (
                <div
                  className="label-print-sheet finished-goods-sheet"
                  key={`finished-goods-${pageLines[0]?.line_no ?? 'empty'}`}
                >
                  {renderLabelHeader('产成品入库')}

                  <table className="finished-goods-detail-table">
                    <colgroup>
                      <col className="finished-goods-col-code" />
                      <col className="finished-goods-col-name" />
                      <col className="finished-goods-col-std" />
                      <col className="finished-goods-col-qty" />
                      <col className="finished-goods-col-grade" />
                      <col className="finished-goods-col-grade" />
                      <col className="finished-goods-col-grade" />
                      <col className="finished-goods-col-grade" />
                      <col className="finished-goods-col-grade" />
                      <col className="finished-goods-col-nc" />
                      <col className="finished-goods-col-remark" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th rowSpan={2}>物料编码</th>
                        <th rowSpan={2}>物料名称</th>
                        <th rowSpan={2}>规格型号</th>
                        <th rowSpan={2}>生产数量</th>
                        <th rowSpan={2}>A类</th>
                        <th colSpan={4}>B类</th>
                        <th rowSpan={2}>NC类</th>
                        <th rowSpan={2}>备注</th>
                      </tr>
                      <tr>
                        <th>物料</th>
                        <th>人为</th>
                        <th>设备</th>
                        <th>生产</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageLines.map((item) => (
                        <tr key={`${item.line_no}-${item.inv_code}`}>
                          <td>{item.inv_code}</td>
                          <td>{item.inv_name}</td>
                          <td>{item.inv_std}</td>
                          <td className="finished-goods-qty">{item.qty}</td>
                          <td />
                          <td />
                          <td />
                          <td />
                          <td />
                          <td />
                          <td />
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="label-page-no">
                    第 {pageIndex + 1} / {finishedGoodsPages.length} 页
                  </div>
                </div>
              ))}
            </div>
          )}
        </Spin>
      </div>

      <style>{`
        ${FINISHED_GOODS_STYLES}
        ${OUTSOURCE_ORDER_STYLES}
        ${OUTSOURCE_MATERIAL_STYLES}
        @media screen {
          .production-label-view-options {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 12px;
          }
          .production-label-preview {
            height: var(--label-preview-height, 0px);
            min-width: 0;
            max-width: 100%;
            overflow: auto;
            overscroll-behavior: contain;
            scrollbar-gutter: stable;
          }
          .production-label-preview[data-preview-mode='double'] .production-label-page {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            width: 100%;
            align-items: start;
            justify-items: center;
          }
          .production-label-preview[data-preview-mode='double'] .label-print-sheet {
            zoom: var(--label-preview-scale, 1);
            margin: 0;
          }
        }
        .production-label-page {
          margin: 0 auto;
          width: 297mm;
          background: #f0f2f5;
        }
        .label-print-sheet {
          width: 287mm;
          height: 200mm;
          margin: 0 auto 16px;
          padding: 5mm;
          background: #fff;
          color: #000;
          font-size: 12px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        .print-meta {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 4px;
          font-size: 12px;
        }
        .label-title {
          border: 1px solid #333;
          border-bottom: 0;
          padding: 8px 0;
          text-align: center;
          font-size: 22px;
          font-weight: 700;
        }
        .label-title.approved {
          background: #d9d9d9;
        }
        .label-info-table,
        .label-detail-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .label-info-table th,
        .label-info-table td,
        .label-detail-table th,
        .label-detail-table td {
          border: 1px solid #333;
          padding: 4px 6px;
          vertical-align: middle;
          word-break: break-all;
        }
        .label-info-table th {
          width: 95px;
          text-align: center;
          font-weight: 600;
          background: #f5f5f5;
        }
        .label-detail-table {
          margin-top: 8px;
          flex: none;
        }
        .material-detail-table {
          flex: none;
        }
        .material-detail-table tbody tr {
          height: 14mm;
        }
        .material-center-cell,
        .material-qty-cell {
          position: relative;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          vertical-align: middle !important;
        }
        .material-center-content,
        .material-qty-content {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .label-detail-table thead {
          display: table-header-group;
        }
        .label-detail-table th {
          text-align: center;
          background: #d9d9d9;
          font-weight: 600;
        }
        .label-detail-table tbody tr {
          height: 14mm;
          page-break-inside: avoid;
        }
        .col-code { width: 18%; }
        .col-name { width: 23%; }
        .col-std { width: 12%; }
        .col-qty { width: 10%; }
        .col-track { width: 29%; }
        .col-qr { width: 8%; }
        .material-col-code { width: 25%; }
        .material-col-name { width: 25%; }
        .material-col-std { width: 13%; }
        .material-col-unit { width: 4%; }
        .material-col-warehouse { width: 10.5%; }
        .material-col-lot { width: 10.5%; }
        .material-col-required { width: 6%; }
        .material-col-issued { width: 6%; }
        .material-name-content {
          display: -webkit-box;
          overflow: hidden;
          white-space: normal;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 4;
        }
        .qr-cell {
          text-align: center;
          white-space: nowrap;
          word-break: normal !important;
        }
        .qr-text {
          margin-top: 2px;
          font-size: 10px;
          line-height: 1;
          white-space: nowrap;
        }
        .label-page-no {
          margin-top: auto;
          text-align: center;
          font-size: 12px;
        }
        @page {
          size: A4 landscape;
          margin: 5mm;
        }
        @media print {
          html,
          body {
            margin: 0 !important;
            background: #fff !important;
          }
          body * {
            visibility: hidden !important;
          }
          #production-label-print-root,
          #production-label-print-root * {
            visibility: visible !important;
          }
          #production-label-print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 287mm;
            margin: 0 !important;
            background: #fff;
          }
          .label-print-sheet {
            width: 287mm;
            height: 200mm;
            margin: 0 !important;
            padding: 0;
            font-size: 9px;
            overflow: hidden;
            page-break-after: always;
            break-after: page;
          }
          .label-print-sheet:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .print-meta {
            margin-bottom: 2mm;
            font-size: 9px;
          }
          .label-title {
            padding: 4px 0;
            font-size: 16px;
          }
          .label-info-table th,
          .label-info-table td,
          .label-detail-table th,
          .label-detail-table td {
            padding: 2px 3px;
            line-height: 1.25;
          }
          .label-detail-table tbody tr {
            height: 12mm;
          }
          .material-detail-table tbody tr {
            height: 12mm;
          }
          .ant-qrcode {
            width: 15mm !important;
            height: 15mm !important;
            margin: 0 auto;
          }
          .ant-qrcode svg,
          .ant-qrcode canvas {
            width: 15mm !important;
            height: 15mm !important;
          }
          .label-page-no {
            margin-top: auto;
            font-size: 9px;
          }
        }
      `}</style>
    </PageContainer>
  );
};

export default ProductionLabelPage;
