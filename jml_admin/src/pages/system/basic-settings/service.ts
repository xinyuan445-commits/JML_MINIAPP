import { request } from '@umijs/max';

export type EmailServiceSettings = {
  smtp_server: string;
  smtp_port: number;
  smtp_user: string;
  smtp_use_ssl: boolean;
  password_configured: boolean;
  revision: number;
  updated_by?: string | null;
  update_time?: string | null;
};

export type ApprovalEmailSendStatus = {
  status?: string | null;
  sent_time?: string | null;
  last_error?: string | null;
  subject?: string | null;
};

export type ApprovalEmailSettings = {
  instant_enabled: boolean;
  weekly_enabled: boolean;
  weekly_day: number;
  weekly_time: string;
  to_recipients: string;
  cc_recipients: string;
  bcc_recipients: string;
  revision: number;
  updated_by?: string | null;
  update_time?: string | null;
  last_approval_send?: ApprovalEmailSendStatus | null;
  last_weekly_send?: ApprovalEmailSendStatus | null;
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

export async function getEmailServiceSettings() {
  const result = await request<ItemResult<EmailServiceSettings>>(
    '/api/admin/basic-settings/email-service',
  );
  if (result.code !== 0) throw new Error(result.msg || '加载失败');
  return result.data;
}

export const saveEmailServiceSettings = (
  data: Omit<EmailServiceSettings, 'password_configured'> & {
    smtp_password?: string;
  },
) =>
  post<EmailServiceSettings>(
    '/api/admin/basic-settings/email-service/save',
    data,
  );

export const testEmailServiceSettings = () =>
  post<{ connected: boolean }>(
    '/api/admin/basic-settings/email-service/test',
    {},
  );

export async function getApprovalEmailSettings() {
  const result = await request<ItemResult<ApprovalEmailSettings>>(
    '/api/admin/basic-settings/approval-email',
  );
  if (result.code !== 0) throw new Error(result.msg || '加载失败');
  return result.data;
}

export const saveApprovalEmailSettings = (data: ApprovalEmailSettings) =>
  post<ApprovalEmailSettings>(
    '/api/admin/basic-settings/approval-email/save',
    data,
  );

export const sendLatestApprovalEmail = () =>
  post<{ request_no: string; sent_at: string }>(
    '/api/admin/basic-settings/approval-email/send-latest',
    {},
  );

export const sendWeeklyApprovalEmail = () =>
  post<{ total: number; highlighted: number; sent_at: string }>(
    '/api/admin/basic-settings/approval-email/send-weekly',
    {},
  );
