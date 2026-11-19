import { request } from '@umijs/max';

export type WorkInterval = [string, string];
export type CalendarWeek = {
  weekday: number;
  intervals: WorkInterval[];
};
export type CalendarPeriod = {
  id?: number;
  period_name: string;
  start_month_day: string;
  end_month_day: string;
  sort_order?: number;
  weeks: CalendarWeek[];
};
export type CalendarException = {
  id?: number;
  work_date: string;
  exception_type: 'work' | 'rest';
  intervals: WorkInterval[];
  reason: string;
  source: string;
  revision?: number;
};
export type WorkCalendar = {
  id: number;
  calendar_code: string;
  calendar_name: string;
  timezone: string;
  is_default: boolean;
  is_active: boolean;
  revision: number;
  periods: CalendarPeriod[];
  exceptions: CalendarException[];
};
export type ScheduleRule = {
  id?: number;
  priority: number;
  rule_code: string;
  is_enabled: boolean;
};
export type SchedulePolicy = {
  id: number;
  policy_code: string;
  policy_name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  revision: number;
  rules: ScheduleRule[];
};
export type SchedulingConfiguration = {
  calendars: WorkCalendar[];
  policies: SchedulePolicy[];
  rule_catalog: { code: string; name: string }[];
  handovers: ScheduleHandover[];
  processes: { id: number; process_name: string }[];
  routes: { id: number; route_code: string; route_name: string }[];
};

export type ScheduleHandover = {
  id: number;
  revision: number;
  route_id: number;
  from_process_id: number;
  to_process_id: number;
  minutes: number;
  is_active: boolean;
};

async function call<T>(url: string, options: Record<string, unknown> = {}) {
  const result = await request<{ code: number; data?: T; msg?: string }>(url, options);
  if (result.code !== 0 || !result.data) throw new Error(result.msg || '操作失败');
  return result.data;
}

export const getSchedulingConfiguration = () =>
  call<SchedulingConfiguration>('/api/admin/production-scheduling');

export const saveCalendar = (calendar: WorkCalendar) =>
  call<{ revision: number }>('/api/admin/production-scheduling/calendar/save', {
    method: 'POST',
    data: calendar,
  });

export const importHolidays = (calendarId: number, year: number) =>
  call<{ imported: number; skipped: number }>(
    '/api/admin/production-scheduling/calendar/import-holidays',
    { method: 'POST', data: { calendar_id: calendarId, year } },
  );

export const savePolicy = (policy: SchedulePolicy) =>
  call<{ revision: number }>('/api/admin/production-scheduling/policy/save', {
    method: 'POST',
    data: policy,
  });

export const saveHandover = (handover: Partial<ScheduleHandover>) =>
  call<{ id: number; revision: number }>('/api/admin/production-scheduling/handover/save', {
    method: 'POST',
    data: handover,
  });
