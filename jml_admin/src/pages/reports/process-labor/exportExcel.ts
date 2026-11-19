import dayjs from 'dayjs';
import { Workbook, type Worksheet } from 'exceljs';
import type { ProcessLaborRow } from './service';

const headerStyle = (sheet: Worksheet) => {
  const row = sheet.getRow(1);
  row.height = 28;
  row.eachCell((cell) => {
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
};

const bodyStyle = (sheet: Worksheet, highlight = false) => {
  const staffingColumn = highlight ? sheet.getColumn('staffing_status').number : 0;
  const ratioColumn = highlight ? sheet.getColumn('time_ratio').number : 0;
  for (let index = 2; index <= sheet.rowCount; index += 1) {
    const row = sheet.getRow(index);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: '微软雅黑', size: 10, color: { argb: 'FF18283B' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFD7E0E9' } },
        right: { style: 'thin', color: { argb: 'FFD7E0E9' } },
      };
    });
    if (highlight && (
      String(row.getCell(staffingColumn).value || '').includes('不足') ||
      String(row.getCell(staffingColumn).value || '').includes('未分配') ||
      Number(row.getCell(ratioColumn).value || 0) > 1
    )) {
      row.font = { name: '微软雅黑', size: 10, bold: true, color: { argb: 'FFC00000' } };
    }
  }
};

export function buildProcessLaborWorkbook(rows: ProcessLaborRow[]) {
  const workbook = new Workbook();
  const summary = workbook.addWorksheet('工序工时汇总', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }],
  });
  summary.columns = [
    { header: '生产订单号', key: 'mo_code', width: 20 },
    { header: '行号', key: 'sort_seq', width: 9 },
    { header: '客户', key: 'customer_name', width: 26 },
    { header: '产品编码', key: 'inv_code', width: 25 },
    { header: '产品名称', key: 'inv_name', width: 28 },
    { header: '规格', key: 'inv_std', width: 20 },
    { header: '计划数量', key: 'plan_qty', width: 14 },
    { header: '工艺路线', key: 'route_name', width: 22 },
    { header: '工序序号', key: 'process_seq', width: 11 },
    { header: '工序名称', key: 'process_name', width: 16 },
    { header: '工站', key: 'station_name', width: 16 },
    { header: '状态', key: 'process_status', width: 11 },
    { header: '累计接收', key: 'normal_received_qty', width: 13 },
    { header: '累计完工', key: 'normal_done_qty', width: 13 },
    { header: 'A', key: 'qty_a', width: 10 },
    { header: 'A1', key: 'qty_a1', width: 10 },
    { header: 'A2', key: 'qty_a2', width: 10 },
    { header: 'C', key: 'qty_c', width: 10 },
    { header: '待完数量', key: 'normal_remaining_qty', width: 13 },
    { header: '首次开工', key: 'first_start_time', width: 20 },
    { header: '最后报工', key: 'last_report_time', width: 20 },
    { header: '工序完工', key: 'process_end_time', width: 20 },
    { header: '工序历时(分钟)', key: 'elapsed_minutes', width: 17 },
    { header: '标准任务时间(分钟)', key: 'standard_task_minutes', width: 20 },
    { header: '时间达成率', key: 'time_ratio_text', width: 14 },
    { header: '时间达成率数值', key: 'time_ratio', width: 4, hidden: true },
    { header: '开工人员', key: 'worker_names', width: 24 },
    { header: '人数', key: 'worker_count', width: 9 },
    { header: '返工人员', key: 'rework_worker_names', width: 22 },
    { header: '标准人数', key: 'standard_staffing', width: 11 },
    { header: '人员配置状态', key: 'staffing_status', width: 14 },
    { header: '异常', key: 'issues_text', width: 28 },
  ];
  rows.forEach((item) => summary.addRow({
    ...item,
    time_ratio_text: item.time_ratio == null ? '' : `${(item.time_ratio * 100).toFixed(2)}%`,
    issues_text: item.issues.join('、'),
  }));
  headerStyle(summary);
  bodyStyle(summary, true);
  summary.autoFilter = `A1:AF${Math.max(1, summary.rowCount)}`;

  const detail = workbook.addWorksheet('报工人员明细', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }],
  });
  detail.columns = [
    { header: '生产订单号', key: 'mo_code', width: 20 },
    { header: '行号', key: 'sort_seq', width: 9 },
    { header: '工序序号', key: 'process_seq', width: 11 },
    { header: '工序名称', key: 'process_name', width: 16 },
    { header: '类型', key: 'kind', width: 10 },
    { header: '开始时间', key: 'start_time', width: 20 },
    { header: '完工时间', key: 'complete_time', width: 20 },
    { header: '完工数量', key: 'qty_done', width: 13 },
    { header: 'A', key: 'qty_a', width: 10 },
    { header: 'A1', key: 'qty_a1', width: 10 },
    { header: 'A2', key: 'qty_a2', width: 10 },
    { header: 'C', key: 'qty_c', width: 10 },
    { header: '分配人员', key: 'assigned_workers', width: 24 },
    { header: '报工人', key: 'operator_name', width: 16 },
  ];
  rows.forEach((row) => row.details.forEach((item) => detail.addRow({
    mo_code: row.mo_code,
    sort_seq: row.sort_seq,
    process_seq: row.process_seq,
    process_name: row.process_name,
    ...item,
  })));
  headerStyle(detail);
  bodyStyle(detail);
  detail.autoFilter = `A1:N${Math.max(1, detail.rowCount)}`;
  return workbook;
}

export async function exportProcessLaborExcel(rows: ProcessLaborRow[]) {
  const buffer = await buildProcessLaborWorkbook(rows).xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `工序工时与人员分配_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
