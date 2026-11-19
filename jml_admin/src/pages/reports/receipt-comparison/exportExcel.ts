import dayjs from 'dayjs';
import { Workbook } from 'exceljs';
import type { ReceiptComparisonRow } from './service';

const workorderStatus = (status: string) => {
  if (status === 'done') return '已完成';
  if (status === 'processing') return '生产中';
  if (status === 'pending') return '待处理';
  return status || '—';
};

export function buildReceiptComparisonWorkbook(rows: ReceiptComparisonRow[]) {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('末工序入库对账', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = [
    { header: '工单号', key: 'mo_code', width: 20 },
    { header: '行号', key: 'sort_seq', width: 10 },
    { header: '产品编码', key: 'inv_code', width: 28 },
    { header: '产品名称', key: 'inv_name', width: 34 },
    { header: '规格型号', key: 'inv_std', width: 24 },
    { header: '计划数量', key: 'plan_qty', width: 14 },
    { header: '工单状态', key: 'workorder_status', width: 12 },
    { header: '工单关闭原因', key: 'workorder_close_reason', width: 36 },
    { header: '最后工序', key: 'last_process_name', width: 20 },
    { header: '末工序完工时间', key: 'final_process_end_time', width: 22 },
    { header: '末工序完工数量', key: 'final_process_qty', width: 18 },
    { header: 'ERP已审核入库', key: 'erp_in_qty', width: 18 },
    { header: '差额', key: 'difference', width: 14 },
    { header: '对账结果', key: 'compare_result', width: 14 },
  ];

  const header = sheet.getRow(1);
  header.height = 28;
  header.eachCell((cell) => {
    cell.font = {
      name: '微软雅黑',
      size: 11,
      bold: true,
      color: { argb: 'FF17365D' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9EAF7' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  for (const item of rows) {
    const row = sheet.addRow({
      ...item,
      workorder_status: workorderStatus(item.workorder_status),
    });
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: '微软雅黑', size: 11, color: { argb: 'FF18283B' } };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFD7E0E9' } },
        right: { style: 'thin', color: { argb: 'FFD7E0E9' } },
      };
    });
    for (const key of ['plan_qty', 'final_process_qty', 'erp_in_qty', 'difference'])
      row.getCell(key).numFmt = '#,##0.####';
    row.getCell('workorder_close_reason').alignment = { vertical: 'middle', wrapText: true };
    if (!item.is_consistent) {
      row.getCell('compare_result').font = {
        name: '微软雅黑',
        size: 11,
        bold: true,
        color: { argb: 'FFC22F3F' },
      };
    }
  }
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: sheet.columns.length },
  };
  return workbook;
}

export async function exportReceiptComparisonExcel(
  rows: ReceiptComparisonRow[],
) {
  const buffer = await buildReceiptComparisonWorkbook(rows).xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(buffer)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `末工序入库对账_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
