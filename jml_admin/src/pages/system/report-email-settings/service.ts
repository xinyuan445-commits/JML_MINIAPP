import { request } from '@umijs/max';

export type ReportDeliverySettings = {
  report_key: string;
  report_name: string;
  is_enabled: boolean;
  send_mode: 'manual' | 'scheduled';
  schedule_frequency: 'daily' | 'weekly' | 'monthly';
  send_time: string;
  week_day: number;
  month_day: number;
  to_recipients: string;
  cc_recipients: string;
  bcc_recipients: string;
  email_subject: string;
  email_body: string;
  revision: number;
  updated_by?: string | null;
  update_time?: string | null;
  last_sent_time?: string | null;
  last_send_status?: string | null;
  last_error?: string | null;
  next_send_time?: string | null;
};

type SettingsResult = {
  code: number;
  data: { reports: ReportDeliverySettings[] };
  msg?: string;
};

type ItemResult<T> = { code: number; data: T; msg?: string };

async function post<T>(path: string, data: Record<string, unknown>) {
  try {
    const result = await request<ItemResult<T>>(path, {
      method: 'POST',
      data,
      skipErrorHandler: true,
    });
    if (result.code !== 0) throw new Error(result.msg || '保存失败');
    return result.data;
  } catch (error) {
    const responseError = error as { response?: { data?: { msg?: string } } };
    throw new Error(
      responseError.response?.data?.msg ||
        (error instanceof Error ? error.message : '操作失败'),
    );
  }
}

export async function getReportEmailSettings() {
  const result = await request<SettingsResult>(
    '/api/admin/report-email-settings',
  );
  if (result.code !== 0) throw new Error(result.msg || '加载失败');
  return result.data;
}

export const saveReportDeliverySettings = (data: ReportDeliverySettings) =>
  post<ReportDeliverySettings>(
    '/api/admin/report-email-settings/report/save',
    data,
  );

export const sendReportNow = (reportKey: string) =>
  post<{ report_key: string; sent_at: string }>(
    '/api/admin/report-email-settings/send',
    { report_key: reportKey },
  );
