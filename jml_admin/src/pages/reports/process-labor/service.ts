import { request } from '@umijs/max';

export type ProcessLaborDetail = {
  kind: string;
  record_id: number;
  start_time: string | null;
  complete_time: string | null;
  qty_done: number;
  qty_a: number;
  qty_a1: number;
  qty_a2: number;
  qty_c: number;
  assigned_workers: string;
  operator_name: string;
};

export type ProcessLaborRow = {
  mo_code: string;
  sort_seq: number;
  route_id: number;
  customer_name: string;
  inv_code: string;
  inv_name: string;
  inv_std: string;
  plan_qty: number | null;
  plan_start_date: string | null;
  plan_due_date: string | null;
  route_name: string;
  process_seq: number;
  process_name: string;
  station_name: string;
  process_status: string;
  normal_received_qty: number | null;
  normal_done_qty: number;
  qty_a: number;
  qty_a1: number;
  qty_a2: number;
  qty_c: number;
  normal_remaining_qty: number | null;
  first_start_time: string | null;
  last_report_time: string | null;
  process_end_time: string | null;
  elapsed_minutes: number | null;
  capacity_state: string | null;
  standard_task_minutes: number | null;
  time_ratio: number | null;
  worker_names: string;
  worker_count: number;
  rework_worker_names: string;
  rework_worker_count: number;
  standard_staffing: number | null;
  staffing_status: string;
  issues: string[];
  details: ProcessLaborDetail[];
};

export type ProcessLaborData = {
  rows: ProcessLaborRow[];
  range: { start: string | null; end: string };
  warnings: string[];
};

export async function getProcessLaborReport() {
  const result = await request<{
    code: number;
    data?: ProcessLaborData;
    msg?: string;
  }>('/api/mo/process-labor-report', { timeout: 60000 });
  if (result.code !== 0 || !result.data)
    throw new Error(result.msg || '读取失败');
  return result.data;
}
