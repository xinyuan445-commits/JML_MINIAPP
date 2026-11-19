import { buildProcessLaborWorkbook } from './exportExcel';
import type { ProcessLaborRow } from './service';

const row: ProcessLaborRow = {
  mo_code: 'SCDD-TEST',
  sort_seq: 1,
  route_id: 8,
  customer_name: '客户',
  inv_code: 'P-1',
  inv_name: '产品',
  inv_std: '规格',
  plan_qty: 20,
  plan_start_date: '2026-10-28',
  plan_due_date: '2026-10-29',
  route_name: '路线',
  process_seq: 1,
  process_name: '压贴',
  station_name: '压贴一站',
  process_status: '进行中',
  normal_received_qty: 20,
  normal_done_qty: 10,
  qty_a: 8,
  qty_a1: 1,
  qty_a2: 1,
  qty_c: 0,
  normal_remaining_qty: 10,
  first_start_time: '2026-10-28 08:00:00',
  last_report_time: '2026-10-28 09:00:00',
  process_end_time: null,
  elapsed_minutes: 240,
  capacity_state: 'finite',
  standard_task_minutes: 120,
  time_ratio: 2,
  worker_names: '甲',
  worker_count: 1,
  rework_worker_names: '',
  rework_worker_count: 0,
  standard_staffing: 2,
  staffing_status: '人数不足',
  issues: ['超过标准时间'],
  details: [{
    kind: '正常',
    record_id: 3,
    start_time: '2026-10-28 08:00:00',
    complete_time: '2026-10-28 09:00:00',
    qty_done: 10,
    qty_a: 8,
    qty_a1: 1,
    qty_a2: 1,
    qty_c: 0,
    assigned_workers: '甲',
    operator_name: '甲',
  }],
};

test('exports summary and batch worker detail sheets with the required header style', () => {
  const workbook = buildProcessLaborWorkbook([row]);
  const summary = workbook.getWorksheet('工序工时汇总');
  const detail = workbook.getWorksheet('报工人员明细');
  expect(summary?.rowCount).toBe(2);
  expect(detail?.rowCount).toBe(2);
  expect(summary?.getRow(1).getCell(1).fill).toMatchObject({
    fgColor: { argb: 'FFD9EAF7' },
  });
  expect(summary?.getRow(2).getCell(summary.getColumn('staffing_status').number).value).toBe('人数不足');
  expect(detail?.getRow(2).getCell(detail.getColumn('assigned_workers').number).value).toBe('甲');
});
