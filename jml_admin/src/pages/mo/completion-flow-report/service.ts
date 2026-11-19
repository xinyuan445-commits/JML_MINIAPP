import { request } from '@umijs/max';

const BASE = '/api/mo/completion-flow-report';

export type CompletionFlowRow = {
  seq: number;
  process_name: string;
  station_name: string;
  process_status: string;
  previous_done_qty: number | null;
  previous_transferable_qty: number | null;
  received_qty: number | null;
  receive_difference: number | null;
  done_qty: number;
  transferable_qty: number;
  completion_difference: number | null;
  qty_a: number;
  qty_a1: number;
  qty_a2: number;
  qty_c: number;
  next_received_qty: number | null;
  downstream_difference: number | null;
  rework_remaining_qty: number;
  start_time?: string;
  end_time?: string;
};

export type CompletionFlowData = {
  header: {
    mo_code: string;
    sort_seq: number;
    route_name: string;
    customer_name: string;
    inv_code: string;
    inv_name: string;
    inv_std: string;
    plan_qty: number | null;
    final_end_time?: string;
  };
  rows: CompletionFlowRow[];
};

export type CompletionFlowLine = {
  sort_seq: number;
  inv_code: string;
  inv_name: string;
  inv_std: string;
  final_end_time?: string;
};

export async function getCompletionFlowOptions(keyword: string) {
  return request<{ code: number; msg?: string; data: string[] }>(
    `${BASE}/options`,
    { params: { keyword } },
  );
}

export async function getCompletionFlowLines(mo_code: string) {
  return request<{ code: number; msg?: string; data: CompletionFlowLine[] }>(
    `${BASE}/lines`,
    { params: { mo_code } },
  );
}

export async function getCompletionFlowReport(
  mo_code: string,
  sort_seq: number,
) {
  return request<{ code: number; msg?: string; data: CompletionFlowData[] }>(
    BASE,
    { params: { mo_code, sort_seq } },
  );
}

export async function authorizeCompletionFlowPrint(mo_code: string) {
  return request<{ code: number; msg?: string }>(`${BASE}/print-authorize`, {
    method: 'POST',
    data: { mo_code },
    skipErrorHandler: true,
  });
}
