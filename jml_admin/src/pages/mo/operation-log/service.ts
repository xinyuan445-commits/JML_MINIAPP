import { request } from '@umijs/max';

export type OperationLogItem = {
  id: number;
  event_type: string;
  event_name: string;
  occurred_at: string;
  operator_id?: string;
  operator_name: string;
  worker_names: string;
  worker_details?: { id?: string; name: string }[];
  mo_code: string;
  sort_seq: number;
  route_id?: number;
  seq?: number;
  process_name?: string;
  station_id?: number;
  station_name?: string;
  qty?: number;
  qty_a?: number;
  qty_a1?: number;
  qty_a2?: number;
  qty_c?: number;
  reason?: string;
  photo_urls?: string[];
  details?: Record<string, unknown>;
};

export async function getOperationLogs(params: Record<string, unknown>) {
  return request<{
    code: number;
    msg?: string;
    data: OperationLogItem[];
    total: number;
  }>('/api/mo/dashboard/operation-log', { params });
}
