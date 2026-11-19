import { request } from '@umijs/max';

export type WorkorderProcessRow = {
  mo_code: string;
  sort_seq: number;
  customer_name: string | null;
  inv_code: string | null;
  inv_name: string | null;
  inv_std: string | null;
  route_name: string;
  process_seq: number;
  process_name: string;
  station_name: string | null;
  process_status: string;
  worker_names: string;
  start_time: string | null;
  end_time: string | null;
  duration_text: string | null;
  plan_qty: number | null;
  qty_done: number;
  qty_a: number;
  qty_a1: number;
  qty_a2: number;
  qty_c: number;
  label_printed: boolean;
  print_count: number;
  remaining_processes: string;
};

type WorkorderProcessResult = {
  code: number;
  data: WorkorderProcessRow[];
  total: number;
  msg?: string;
};

export async function getWorkorderProcessReport() {
  const result = await request<WorkorderProcessResult>(
    '/api/mo/workorder-process-report',
  );
  if (result.code !== 0) throw new Error(result.msg || '读取失败');
  return result;
}
