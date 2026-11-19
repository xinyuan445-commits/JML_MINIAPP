import dayjs from 'dayjs';
import { Workbook } from 'exceljs';
import type { WorkorderProcessRow } from './service';

export function buildWorkorderProcessWorkbook(rows: WorkorderProcessRow[]) {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('工单工序报告', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }],
  });
  sheet.columns = [
    { header: '生产订单号', key: 'mo_code', width: 20 },
    { header: '生产订单行号', key: 'sort_seq', width: 14 },
    { header: '客户名称', key: 'customer_name', width: 28 },
    { header: '产品编码', key: 'inv_code', width: 26 },
    { header: '产品名称', key: 'inv_name', width: 30 },
    { header: '规格型号', key: 'inv_std', width: 24 },
    { header: '工艺路线', key: 'route_name', width: 24 },
    { header: '工序序号', key: 'process_seq', width: 12 },
    { header: '工序名称', key: 'process_name', width: 18 },
    { header: '工站', key: 'station_name', width: 18 },
    { header: '工序状态', key: 'process_status', width: 12 },
    { header: '开工人员', key: 'worker_names', width: 22 },
    { header: '开工时间', key: 'start_time', width: 20 },
    { header: '完工时间', key: 'end_time', width: 20 },
    { header: '工序用时', key: 'duration_text', width: 16 },
    { header: '计划生产数量', key: 'plan_qty', width: 16 },
    { header: '累计完工数量', key: 'qty_done', width: 16 },
    { header: 'A级数量', key: 'qty_a', width: 12 },
    { header: 'A1级数量', key: 'qty_a1', width: 12 },
    { header: 'A2级数量', key: 'qty_a2', width: 12 },
    { header: 'C级数量', key: 'qty_c', width: 12 },
    { header: '是否打印流转标签', key: 'label_printed_text', width: 18 },
    { header: '标签打印次数', key: 'print_count', width: 16 },
    { header: '剩余未完成工序', key: 'remaining_processes', width: 36 },
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
      label_printed_text: item.label_printed ? '是' : '否',
    });
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: '微软雅黑', size: 11, color: { argb: 'FF18283B' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFD7E0E9' } },
        right: { style: 'thin', color: { argb: 'FFD7E0E9' } },
      };
    });
    for (const column of [16, 17, 18, 19, 20, 21]) {
      row.getCell(column).numFmt = '#,##0.####';
    }
  }
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: 24 },
  };
  return workbook;
}

export async function exportWorkorderProcessExcel(rows: WorkorderProcessRow[]) {
  const buffer = await buildWorkorderProcessWorkbook(rows).xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(buffer)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `工单工序报告_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
