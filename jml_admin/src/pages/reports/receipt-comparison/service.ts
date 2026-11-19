import { request } from '@umijs/max';

export type ReceiptComparisonRow = {
  mo_code: string;
  sort_seq: number;
  workorder_status: string;
  workorder_close_reason: string;
  inv_code: string;
  inv_name: string;
  inv_std: string;
  plan_qty: number | null;
  last_process_name: string;
  final_process_end_time: string | null;
  has_final_execution: boolean;
  final_process_qty: number;
  erp_in_qty: number;
  difference: number;
  is_consistent: boolean;
  compare_result: '一致' | '不一致';
};

export type ReceiptComparisonResult = {
  code: number;
  data: ReceiptComparisonRow[];
  summary: {
    total: number;
    consistent: number;
    inconsistent: number;
  };
  msg?: string;
};

export async function getReceiptComparison() {
  const result = await request<ReceiptComparisonResult>(
    '/api/mo/receipt-comparison',
  );
  if (result.code !== 0) {
    throw new Error(result.msg || '读取失败');
  }
  return result;
}
