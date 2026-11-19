import dayjs from 'dayjs';
import { type CellValue, Workbook } from 'exceljs';
import { isOverdue, knownUnit, salesOrderCode, salesOrderLine, stepAnomalies, stepLabel, stepState } from './model';
import type { DashboardOrder } from './service';

const states = {
  done: { label: '已完成', fill: 'CFEADE' },
  work: { label: '生产中', fill: 'F7E2A7' },
  received: { label: '待开工', fill: 'CFE3F6' },
  ready: { label: '待接收', fill: 'CFE3F6' },
  rework: { label: '返工待完', fill: 'F5CFD4' },
  pending: { label: '未开始', fill: 'DFE6ED' },
  unknown: { label: '待核对', fill: 'DFE6ED' },
};
const legend = [
  states.done,
  states.work,
  states.received,
  states.ready,
  states.rework,
  { label: '未领料', fill: 'DFE6ED' },
  states.pending,
  states.unknown,
  { label: '数量异常', fill: 'F6CBD0' },
];
const quantity = (value: number | null) => value == null ? '—' : String(value);
const timestamp = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—';
// Excel stores dates as UTC-based serials, so preserve the API's calendar day.
const calendarDate = (value?: string | null) =>
  value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;

function planDateCell(
  value?: string | null,
  original?: string | null,
  overdue = false,
): CellValue {
  const currentDay = value?.slice(0, 10);
  const originalDay = original?.slice(0, 10);
  if (!originalDay || originalDay === currentDay) return calendarDate(value);

  return {
    richText: [
      {
        text: `${currentDay || '未排期'}\n`,
        font: {
          name: '微软雅黑', size: 11, bold: overdue,
          color: { argb: overdue ? 'FFC22F3F' : 'FF18283B' },
        },
      },
      {
        text: `原 ${originalDay}`,
        font: { name: '微软雅黑', size: 9, color: { argb: 'FF64748B' } },
      },
    ],
  };
}

// Export the same filtered and sorted orders as the board, before pagination.
export function buildDashboardWorkbook(orders: DashboardOrder[], bySalesOrder = false) {
  const workbook = new Workbook();
  const salesColumns = bySalesOrder ? [
    { header: '销售订单号', width: 22 },
    { header: '销售行号', width: 12 },
  ] : [];
  const offset = salesColumns.length;
  const sheet = workbook.addWorksheet(bySalesOrder ? '销售订单看板' : '生产现场看板', {
    views: [{ state: 'frozen', xSplit: 2 + offset, ySplit: 2 }],
  });
  const processCount = Math.max(0, ...orders.map((order) => order.steps.length));
  sheet.columns = [
    ...salesColumns,
    { header: '工单号', width: 20 },
    { header: '行号', width: 8 },
    { header: '客户', width: 30 },
    { header: '产品', width: 40 },
    { header: '料号', width: 28 },
    { header: '规格', width: 24 },
    { header: '计划生产数量', width: 16 },
    { header: '单位', width: 8 },
    { header: '计划开工', width: 15 },
    { header: '计划完工', width: 15 },
    { header: '工单状态', width: 16 },
    ...Array.from({ length: processCount }, (_, index) => ({
      header: `工序${index + 1}`, width: 38,
    })),
  ];
  sheet.insertRow(1, []);
  const legendRow = sheet.getRow(1);
  legendRow.getCell(1).value = '图例';
  legendRow.getCell(1).font = {
    name: '微软雅黑', size: 11, bold: true, color: { argb: 'FF17365D' },
  };
  legend.forEach((item, index) => {
    const cell = legendRow.getCell(index + 2);
    cell.value = item.label;
    cell.fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${item.fill}` },
    };
    cell.font = { name: '微软雅黑', size: 11, color: { argb: 'FF18283B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  const overdueLegend = legendRow.getCell(11);
  overdueLegend.value = '逾期';
  overdueLegend.font = {
    name: '微软雅黑', size: 11, bold: true, color: { argb: 'FFC22F3F' },
  };
  overdueLegend.alignment = { vertical: 'middle', horizontal: 'center' };
  legendRow.height = 24;

  const header = sheet.getRow(2);
  header.height = 28;
  header.eachCell((cell) => {
    cell.font = { name: '微软雅黑', size: 11, bold: true, color: { argb: 'FF17365D' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAF7' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  for (const order of orders) {
    const steps = [...order.steps].sort((a, b) => a.seq - b.seq);
    const overdue = isOverdue(order);
    const row = sheet.addRow([
      ...(bySalesOrder ? [salesOrderCode(order) || '未关联销售单', salesOrderLine(order)] : []),
      order.mo_code, order.sort_seq,
      order.customer_name?.trim() || '未关联客户',
      order.inv_name || order.inv_code || (order.erp_deleted ? '工单资料已删除' : '产品待补'),
      order.inv_code || '', order.inv_std || '', order.plan_qty,
      knownUnit(order.unit_name) ? order.unit_name : '',
      planDateCell(order.plan_start_date, order.original_start_date),
      planDateCell(order.plan_due_date, order.original_due_date, overdue),
      order.is_closed ? '已关闭' : [
        order.erp_deleted ? '系统已删除' : '',
        order.has_reporting === false ? '未报工' : '',
        overdue ? '逾期' : '',
      ].filter(Boolean).join('、'),
    ]);
    let lineCount = 7;
    for (let index = 0; index < processCount; index += 1) {
      const step = steps[index];
      const cell = row.getCell(12 + offset + index);
      if (!step) {
        cell.value = '—';
        continue;
      }
      const state = stepState(step);
      const anomalies = stepAnomalies(order, steps, index);
      const active = ['work', 'received', 'rework'].includes(state);
      const lines = [
        step.process_name,
        stepLabel(step),
        `累计接收 ${quantity(step.normal_received_qty)}  累计完工 ${quantity(step.normal_done_qty)}`,
        `正常待完 ${quantity(step.normal_remaining_qty)}  可接收 ${quantity(step.receive_available_qty)}`,
        `返工待完 ${quantity(step.rework_remaining_qty)}`,
        `始 ${timestamp(step.first_start_time)}`,
        `终 ${active && step.first_start_time ? '进行中' : timestamp(step.last_end_time)}`,
        ...anomalies.map((reason) => `异常：${reason}`),
      ];
      cell.value = lines.join('\n');
      cell.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: `FF${anomalies.length ? 'F6CBD0' : states[state].fill}` },
      };
      lineCount = Math.max(lineCount, lines.reduce((sum, line) =>
        sum + Math.max(1, Math.ceil(line.length / 19)), 0));
    }
    row.height = lineCount * 16 + 10;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: '微软雅黑', size: 11, color: { argb: 'FF18283B' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFD7E0E9' } },
        right: { style: 'thin', color: { argb: 'FFD7E0E9' } },
      };
    });
    row.getCell(7 + offset).numFmt = '#,##0.####';
    for (const column of [9 + offset, 10 + offset]) {
      const cell = row.getCell(column);
      if (cell.value instanceof Date) cell.numFmt = 'yyyy-mm-dd';
    }
    if (overdue) {
      row.getCell(10 + offset).font = { name: '微软雅黑', size: 11, bold: true, color: { argb: 'FFC22F3F' } };
      row.getCell(11 + offset).font = { name: '微软雅黑', size: 11, bold: true, color: { argb: 'FFC22F3F' } };
    } else if (!order.is_closed && order.erp_deleted) {
      row.getCell(11 + offset).font = { name: '微软雅黑', size: 11, bold: true, color: { argb: 'FFC22F3F' } };
    }
  }
  sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: sheet.rowCount, column: 11 + offset } };
  return workbook;
}

export async function exportDashboardExcel(orders: DashboardOrder[], bySalesOrder = false) {
  const buffer = await buildDashboardWorkbook(orders, bySalesOrder).xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const link = document.createElement('a');
  link.href = url;
  const beijing = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'medium', hourCycle: 'h23',
  }).format(new Date()).replace(/[-:]/g, '').replace(' ', '_');
  link.download = `${bySalesOrder ? '销售订单看板' : '生产现场看板'}_${beijing}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
