export type DashboardStep = {
  seq: number;
  is_first_step?: boolean;
  first_issued_qty?: number | null;
  first_issue_calculation?: {
    mode: 'bom_ratio' | 'panel_area';
    required_area?: number | null;
    issued_area?: number | null;
    materials?: { sub_code: string; qty_plan: number; qty_issued: number }[];
    material_count?: number | null;
    bottleneck_inv_code?: string | null;
    bottleneck_required_qty?: number | null;
    bottleneck_issued_qty?: number | null;
    bottleneck_ratio?: number | null;
  } | null;
  process_name: string;
  station_id?: number | null;
  station_name?: string | null;
  status: string;
  normal_received_qty: number | null;
  normal_done_qty: number;
  qty_a: number;
  qty_a1: number;
  qty_a2: number;
  qty_c: number;
  transferable_qty?: number | null;
  normal_remaining_qty: number | null;
  receive_available_qty: number | null;
  receiving_qty: number;
  rework_remaining_qty: number;
  workers: string[];
  rework_workers: string[];
  first_start_time?: string | null;
  last_end_time?: string | null;
  last_activity?: string | null;
  capacity_state?:
    | 'finite'
    | 'unlimited'
    | 'unconfigured'
    | 'inactive'
    | 'incomplete';
  capacity_unit?: string | null;
  capacity_standard_id?: number | null;
  standard_staffing?: number | null;
  standard_unit_minutes?: number | null;
  standard_task_minutes?: number | null;
};

export type DashboardOrder = {
  mo_code: string;
  sort_seq: number;
  route_id: number;
  route_name: string;
  inv_code?: string | null;
  inv_name?: string | null;
  inv_std?: string | null;
  so_code_008?: string | null;
  source_account?: string | null;
  source_so_code?: string | null;
  customer_code?: string | null;
  customer_name?: string | null;
  erp_deleted?: boolean;
  is_closed?: boolean;
  unit_name?: string | null;
  dept_name?: string | null;
  plan_qty: number | null;
  plan_start_date?: string | null;
  plan_due_date?: string | null;
  original_start_date?: string | null;
  original_due_date?: string | null;
  plan_shortfall_qty: number | null;
  last_activity?: string | null;
  is_active: boolean;
  has_work: boolean;
  has_receivable: boolean;
  has_rework: boolean;
  has_reporting?: boolean;
  is_overdue: boolean;
  steps: DashboardStep[];
};

export type DashboardDaily = {
  date: string;
  kind: 'normal' | 'rework';
  process_name: string;
  station_name?: string | null;
  unit_name: string;
  qty: number;
  qty_a: number;
  qty_a1: number;
  qty_a2: number;
  qty_c: number;
  batch_count: number;
  is_final: boolean;
};

export type DashboardOperations = {
  generated_at: string;
  today: string;
  orders: DashboardOrder[];
  daily: DashboardDaily[];
  warnings: string[];
};

export async function getDashboardOperations() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch('/api/mo/dashboard/operations', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`看板接口返回 ${response.status}`);
    return (await response.json()) as {
      code: number;
      msg?: string;
      data?: DashboardOperations;
    };
  } finally {
    window.clearTimeout(timeout);
  }
}
