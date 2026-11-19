import { request } from '@umijs/max';
import type { NonorderCandidate, NonorderHistory, NonorderPlan } from './nonorderService';

export type TaskSheet = {
  id: number;
  work_date: string;
  sheet_kind?: 'main' | 'supplement';
  parent_id?: number;
  plan_cutoff?: string;
  result_cutoff?: string;
  arrangement_locked?: boolean;
  result_locked?: boolean;
  plan_frozen_at?: string;
  result_frozen_at?: string;
  legacy_import?: number;
  server_time?: string;
  dept_name?: string;
  status: 'draft' | 'published' | 'partial';
  revision?: number;
  created_by: string;
  creator_display_name?: string;
  created_at: string;
  published_at?: string | null;
  task_count?: number;
  nonorder_count?: number;
  station_count?: number;
};

export async function getTaskSheets() {
  const response = await request<{
    code: number;
    msg?: string;
    data: TaskSheet[];
  }>('/api/mo/daily-tasks', { params: { view: 'sheets' } });
  if (response.code !== 0) throw new Error(response.msg || '安排单读取失败');
  return response.data;
}

export async function createTaskSheet(date: string, parentId?: number) {
  const response = await request<{
    code: number;
    msg?: string;
    data: { sheet: TaskSheet; created: boolean };
  }>('/api/mo/daily-tasks/save', {
    method: 'POST',
    data: { action: 'create', date, parent_id: parentId },
  });
  if (response.code !== 0) throw new Error(response.msg || '创建失败');
  return response.data;
}

export type Candidate = {
  mo_code: string;
  sort_seq: number;
  route_id: number;
  seq: number;
  kind: 'normal' | 'rework';
  process_name: string;
  dept_name: string;
  plan_start_date?: string | null;
  has_active_execution?: boolean;
  is_last_step?: boolean;
  waiting_reason?: 'material' | 'upstream' | 'unknown' | null;
  waiting_process_name?: string | null;
  inv_code?: string;
  inv_name?: string;
  inv_std?: string;
  unit_name: string;
  allowed_station_ids: number[];
  received_remaining: number | null;
  receivable: number | null;
  ready: number | null;
  maximum: number;
  waiting: number | null;
  reserved: number;
  unassigned: number;
  reservations: { id: number; date: string; quantity: number }[];
  standard_unit_minutes?: number | null;
  capacity_station_id?: number;
  capacity_state?: string;
};
export type Actual = {
  received?: number;
  done?: number;
  qty_a?: number;
  qty_a1?: number;
  qty_a2?: number;
  qty_c?: number;
};
export type Task = Candidate & {
  id: number;
  task_id: number;
  station_id: number;
  quantity: number;
  remaining: number;
  transferred_qty: number;
  difference: number;
  sort_order: number;
  remark: string;
  status: 'active' | 'cancelled';
  header_status: 'draft' | 'published';
  actual: Actual;
  current?: Candidate;
  issue?: string;
};
export type DailyData = {
  supports_day_export?: boolean;
  supports_day_print?: boolean;
  sheet?: TaskSheet;
  nonorder?: { candidates: NonorderCandidate[]; items: NonorderPlan[]; history: NonorderHistory[]; supports_sheet_creation?: boolean };
  target_headers: { work_date: string; dept_name: string; revision: number }[];
  date: string;
  generated_at: string;
  headers: {
    id: number;
    dept_name: string;
    status: 'draft' | 'published';
    revision: number;
  }[];
  stations: {
    id: number;
    station_name: string;
    is_active: number;
    leader_name?: string | null;
  }[];
  candidates: Candidate[];
  items: Task[];
  unplanned: (Candidate &
    Actual & { station_id: number; station_name?: string })[];
  changes: {
    id: number;
    task_id: number;
    item_id: number;
    related_item_id?: number;
    action: string;
    actor: string;
    created_at: string;
    before_data: unknown;
    after_data: unknown;
  }[];
  warnings: string[];
};

export type PrintTaskTable = {
  title: string;
  headers: string[];
  rows: {
    values: [string, string, number | null, string, string, string];
    station_span: number;
    unit: string;
    status_color: string;
  }[];
};

export async function getTasks(date: string, silent = false, sheetId?: number) {
  const response = await request<{
    code: number;
    msg?: string;
    data: DailyData;
  }>('/api/mo/daily-tasks', {
    params: { date, sheet_id: sheetId },
    timeout: 90000,
    skipErrorHandler: silent,
  });
  if (response.code !== 0) throw new Error(response.msg || '任务读取失败');
  return response.data;
}

export async function saveTask(body: Record<string, unknown>) {
  try {
    const response = await request<{
      code: number;
      msg?: string;
      data: DailyData;
    }>('/api/mo/daily-tasks/save', {
      method: 'POST',
      data: body,
      timeout: 90000,
      skipErrorHandler: true,
    });
    if (response.code !== 0)
      throw new Error(response.msg || '保存失败，本地草稿已保留');
    return response.data;
  } catch (error) {
    const details = error as { response?: { data?: { msg?: unknown } } };
    const message = details?.response?.data?.msg;
    throw new Error(
      typeof message === 'string'
        ? message
        : error instanceof Error
          ? error.message
          : '保存失败，本地草稿已保留',
    );
  }
}

export async function exportTasks(date: string) {
  const blob = await request<Blob>('/api/mo/daily-tasks/export', {
    params: { date, scope: 'day' },
    responseType: 'blob',
    timeout: 90000,
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `工站每日任务_${date}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function getPrintTasks(date: string) {
  try {
    const result = await request<{ code: number; msg?: string; data: PrintTaskTable }>(
      '/api/mo/daily-tasks/export',
      { params: { date, scope: 'day', format: 'print' }, timeout: 90000, skipErrorHandler: true },
    );
    if (result.code !== 0) throw new Error(result.msg || '任务读取失败');
    return result.data;
  } catch (error) {
    const message = (error as { response?: { data?: { msg?: string } } }).response?.data?.msg;
    throw new Error(message || (error instanceof Error ? error.message : '打印任务读取失败'));
  }
}
