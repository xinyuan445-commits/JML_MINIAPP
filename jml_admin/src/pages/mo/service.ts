import { request } from '@umijs/max';

const BASE = 'http://localhost:5001/api/mo';

// ── 工序 ──────────────────────────────────────────
export async function getProcessList() {
  return request<{ code: number; data: any[] }>(`${BASE}/process/list`);
}
export async function addProcess(data: any) {
  return request(`${BASE}/process/add`, { method: 'POST', data });
}
export async function updateProcess(data: any) {
  return request(`${BASE}/process/update`, { method: 'POST', data });
}
export async function toggleProcess(data: { id: number; is_active: number }) {
  return request(`${BASE}/process/toggle`, { method: 'POST', data });
}

// ── 工站 ──────────────────────────────────────────
export async function getWorkstationList() {
  return request<{ code: number; data: any[] }>(`${BASE}/workstation/list`);
}
export async function addWorkstation(data: any) {
  return request(`${BASE}/workstation/add`, { method: 'POST', data });
}
export async function updateWorkstation(data: any) {
  return request(`${BASE}/workstation/update`, { method: 'POST', data });
}
export async function toggleWorkstation(data: { id: number; is_active: number }) {
  return request(`${BASE}/workstation/toggle`, { method: 'POST', data });
}

// ── 工艺路线 ──────────────────────────────────────
export async function getDepartments() {
  return request<{ code: number; data: { code: string; name: string }[] }>(`${BASE}/departments`);
}
export async function getRouteNextCode(dept_code: string) {
  return request<{ code: number; data: string }>(`${BASE}/route/next-code`, { params: { dept_code } });
}
export async function getRouteList() {
  return request<{ code: number; data: any[] }>(`${BASE}/route/list`);
}
export async function getRouteDetail(id: number) {
  return request<{ code: number; data: any }>(`${BASE}/route/detail`, { params: { id } });
}
export async function addRoute(data: any) {
  return request(`${BASE}/route/add`, { method: 'POST', data });
}
export async function updateRoute(data: any) {
  return request(`${BASE}/route/update`, { method: 'POST', data });
}
export async function setRouteProcesses(data: any) {
  return request(`${BASE}/route/set-processes`, { method: 'POST', data });
}
export async function toggleRoute(data: { id: number; is_active: number }) {
  return request(`${BASE}/route/toggle`, { method: 'POST', data });
}
export async function deleteRoute(data: { id: number }) {
  return request(`${BASE}/route/delete`, { method: 'POST', data });
}

// ── 工单 ──────────────────────────────────────────
export async function getWorkorderList() {
  return request<{ code: number; data: any[] }>(`${BASE}/workorder/list`);
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
export async function deleteWoRoute(data: { mo_code: string; sort_seq: number }) {
  return request(`${BASE}/wo-route/remove`, { method: 'POST', data });
}

// ── Dashboard ──────────────────────────────────────────
export async function getDashboardProcessGantt() {
  return request<{ code: number; data: any[] }>(`${BASE}/dashboard/process-gantt`);
}
export async function getDashboardGanttData(params: { start: string; end: string }) {
  return request<{ code: number; data: any[]; wo_options: { value: string; label: string }[]; meta: any }>(
    `${BASE}/dashboard/gantt-data`, { params }
  );
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
