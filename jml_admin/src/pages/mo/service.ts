import { request } from '@umijs/max';

const BASE = '/api/mo';
const APPROVAL_BASE = '/api/admin/config-approvals';

export type ConfigApprovalModule =
  | 'equipment'
  | 'equipment-capacity'
  | 'process'
  | 'workstation'
  | 'category'
  | 'route';
export type ConfigApprovalAction =
  | 'create'
  | 'edit'
  | 'status'
  | 'version'
  | 'restore';

export async function submitConfigApproval(
  module_type: ConfigApprovalModule,
  action_type: ConfigApprovalAction,
  payload: Record<string, any>,
) {
  try {
    return await request<{
      code: number;
      msg?: string;
      data?: { id: number; request_no: string };
    }>(`${APPROVAL_BASE}/submit`, {
      method: 'POST',
      data: { module_type, action_type, payload },
      skipErrorHandler: true,
    });
  } catch (error: any) {
    return error?.response?.data || { code: 1, msg: '提交失败' };
  }
}

export async function updateConfigApproval(
  id: number,
  revision: number,
  payload: Record<string, any>,
) {
  try {
    return await request<{ code: number; msg?: string; data?: { revision: number } }>(
      `${APPROVAL_BASE}/update`,
      { method: 'POST', data: { id, revision, payload }, skipErrorHandler: true },
    );
  } catch (error: any) {
    return error?.response?.data || { code: 1, msg: '修改失败' };
  }
}

// ── 工序 ──────────────────────────────────────────
export async function getProcessList(includePending = false) {
  return request<{ code: number; data: any[] }>(`${BASE}/process/list`, {
    params: includePending ? { include_pending: 1 } : undefined,
  });
}
export async function addProcess(data: any) {
  return submitConfigApproval('process', 'create', data);
}
export async function updateProcess(data: any) {
  return submitConfigApproval('process', 'edit', data);
}
export async function toggleProcess(data: { id: number; is_active: number }) {
  return submitConfigApproval('process', 'status', data);
}

// ── 工站 ──────────────────────────────────────────
export async function getWorkstationList(includePending = false) {
  return request<{ code: number; data: any[] }>(`${BASE}/workstation/list`, {
    params: includePending ? { include_pending: 1 } : undefined,
  });
}
export async function addWorkstation(data: any) {
  return submitConfigApproval('workstation', 'create', data);
}
export async function updateWorkstation(data: any) {
  return submitConfigApproval('workstation', 'edit', data);
}
export async function toggleWorkstation(data: {
  id: number;
  is_active: number;
}) {
  return submitConfigApproval('workstation', 'status', data);
}

// ── 工艺路线 ──────────────────────────────────────
export async function getDepartments() {
  return request<{ code: number; data: { code: string; name: string }[] }>(
    `${BASE}/departments`,
  );
}
export async function getRouteNextCode(dept_code: string) {
  return request<{ code: number; data: string }>(`${BASE}/route/next-code`, {
    params: { dept_code },
  });
}
export async function getRouteList(includePending = false, allVersions = false) {
  return request<{ code: number; data: any[] }>(`${BASE}/route/list`, {
    params: { include_pending: includePending ? 1 : undefined, all_versions: allVersions ? 1 : undefined },
  });
}
export async function getProductCategoryList() {
  return request<{ code: number; data: { code: string; name: string }[] }>(
    `${BASE}/product-category/list`,
  );
}
export async function getProductCategoryManageList() {
  return request<{ code: number; data: any[] }>(
    `${BASE}/product-category/manage-list`,
    { params: { include_pending: 1 } },
  );
}
export async function addProductCategory(data: { name: string }) {
  return submitConfigApproval('category', 'create', data);
}
export async function updateProductCategory(data: {
  code: string;
  name: string;
}) {
  return submitConfigApproval('category', 'edit', data);
}
export async function toggleProductCategory(data: {
  code: string;
  is_enabled: number;
}) {
  return submitConfigApproval('category', 'status', data);
}
export type WorkerDepartment = {
  dept_id: number;
  parent_dept_id: number | null;
  dept_name: string;
  dept_level: number;
  dept_path: string;
};
export async function getWorkerDepartmentScope() {
  return request<{
    code: number;
    msg?: string;
    data: {
      departments: WorkerDepartment[];
      selected_dept_ids: number[];
      configured: boolean;
    };
  }>(`${BASE}/worker-department-scope`);
}
export async function saveWorkerDepartmentScope(dept_ids: number[]) {
  return request<{ code: number; msg?: string }>(
    `${BASE}/worker-department-scope`,
    { method: 'POST', data: { dept_ids } },
  );
}
export async function getRouteDetail(id: number) {
  return request<{ code: number; msg?: string; data: any }>(`${BASE}/route/detail`, {
    params: { id },
  });
}
export async function addRoute(data: any) {
  return submitConfigApproval('route', 'create', data);
}
export async function updateRoute(data: any) {
  return submitConfigApproval('route', 'edit', data);
}
export async function setRouteProcesses(data: any) {
  return submitConfigApproval('route', 'edit', { ...data, mode: 'steps' });
}
export async function toggleRoute(data: { id: number; is_active: number }) {
  return submitConfigApproval('route', 'status', data);
}
export async function createRouteVersion(data: {
  source_route_id: number;
  set_default: boolean;
  steps: Array<{
    process_id: number;
    station_id: number | null;
  }>;
  version_note?: string;
}) {
  return submitConfigApproval('route', 'version', {
    id: data.source_route_id,
    set_default: data.set_default,
    steps: data.steps,
    version_note: data.version_note,
  });
}
export async function getRouteVersionHistory(id: number) {
  return request<{ code: number; msg?: string; data: any[] }>(
    `${BASE}/route/version/history`,
    { params: { id } },
  );
}
export async function restoreRouteVersion(data: { id: number }) {
  return submitConfigApproval('route', 'restore', data);
}

export async function getAuditList(
  params: Record<string, string | number | undefined>,
) {
  return request<{ code: number; data: any[]; total: number }>(
    `${BASE}/audit/list`,
    { params },
  );
}

// ── 工单 ──────────────────────────────────────────
export async function getWorkorderList() {
  return request<{ code: number; data: any[] }>(`${BASE}/workorder/list`);
}
export async function getProductionLabel(mo_code: string) {
  return request<{ code: number; msg?: string; data: any }>(
    `${BASE}/production-label`,
    {
      params: { mo_code },
      timeout: 15000,
    },
  );
}
export async function getProductionLabelOptions(keyword: string) {
  return request<{ code: number; msg?: string; data: string[] }>(
    `${BASE}/production-label/options`,
    {
      params: { keyword },
      timeout: 15000,
    },
  );
}

export async function logProductionLabelPrint(data: {
  mo_code: string;
  line_count: number;
}) {
  return request<{ code: number; msg?: string }>(
    `${BASE}/production-label/print-log`,
    { method: 'POST', data, skipErrorHandler: true },
  );
}
export async function getWoStartedKeys() {
  return request<{ code: number; data: string[] }>(`${BASE}/wo-state/started`);
}
export async function getWoRouteBindings() {
  return request<{ code: number; data: any[] }>(`${BASE}/wo-route/list`);
}
export async function setWoRoute(data: any) {
  return request(`${BASE}/wo-route/set`, { method: 'POST', data });
}
export async function setWoRouteBatch(data: any) {
  return request(`${BASE}/wo-route/set-batch`, { method: 'POST', data });
}
export async function deleteWoRoute(data: {
  mo_code: string;
  sort_seq: number;
}) {
  return request(`${BASE}/wo-route/remove`, { method: 'POST', data });
}

// ── Dashboard ──────────────────────────────────────────
export async function getDashboardProcessGantt() {
  return request<{ code: number; data: any[] }>(
    `${BASE}/dashboard/process-gantt`,
  );
}
export async function getDashboardGanttData(params: {
  start: string;
  end: string;
}) {
  return request<{
    code: number;
    data: any[];
    wo_options: { value: string; label: string }[];
    meta: any;
  }>(`${BASE}/dashboard/gantt-data`, { params });
}
export async function getDashboardSummary() {
  return request<{ code: number; data: any }>(`${BASE}/dashboard/summary`);
}
export async function getDashboardCapacity() {
  return request<{ code: number; data: any[] }>(`${BASE}/dashboard/capacity`);
}
export async function getDashboardWip() {
  return request<{ code: number; data: any[] }>(`${BASE}/dashboard/wip`);
}
export async function getDashboardAnomalies() {
  return request<{ code: number; data: any[] }>(`${BASE}/dashboard/anomalies`);
}

export async function getCompletedWorkorderList(
  params: Record<string, string | number | undefined>,
) {
  return request<{
    code: number;
    msg?: string;
    data: any[];
    total: number;
    current: number;
    pageSize: number;
    meta?: {
      start_date: string;
      end_date: string;
      product_data_available: boolean;
    };
  }>(`${BASE}/completed-workorder/list`, { params });
}

export async function getCompletedWorkorderDetail(params: {
  mo_code: string;
  sort_seq: number;
  include_active?: 1;
}) {
  return request<{
    code: number;
    msg?: string;
    data: any;
    meta?: { product_data_available: boolean };
  }>(`${BASE}/completed-workorder/detail`, { params });
}

export async function getCompletedQrCode(execution_id: number) {
  return request<{
    code: number;
    msg?: string;
    data?: { image_data_url: string };
  }>(`${BASE}/completed-workorder/qr-code`, {
    params: { execution_id },
  });
}

export async function getWorkorderTrace(mo_code: string) {
  return request<{
    code: number;
    msg?: string;
    data: any[];
  }>(`${BASE}/workorder-trace/search`, { params: { mo_code } });
}
