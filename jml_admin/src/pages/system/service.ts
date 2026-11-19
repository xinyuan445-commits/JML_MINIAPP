import { request } from '@umijs/max';

export type AdminRole = {
  id: number;
  code: string;
  name: string;
  permissions: string[];
  is_active: number;
  is_system: number;
};
export type AdminAccount = {
  id: number;
  auth_source: 'session' | 'oidc';
  username: string;
  display_name: string;
  role_ids: number[];
  is_active: number;
  last_login_time?: string;
};
export type PermissionGroup = {
  key: string;
  name: string;
  group: string;
  permissions: { key: string; name: string }[];
};
export type PageSetting = {
  key: string;
  name: string;
  group: string;
  path: string;
  locked?: boolean;
  is_enabled: number;
  revision: number;
  updated_by?: string;
  update_time?: string;
};
type Result<T> = { code: number; data: T; msg?: string };
export const getAccounts = () =>
  request<Result<AdminAccount[]>>('/api/admin/accounts');
export const getStaffBinding = (id: number) =>
  request<Result<{ staff_id: string | null; revision: number; people: { id: string; name: string; active: boolean }[] }>>(
    '/api/admin/accounts/staff-binding', { params: { id }, skipErrorHandler: true },
  );
export const getRoles = () => request<Result<AdminRole[]>>('/api/admin/roles');
export const getPermissions = () =>
  request<Result<PermissionGroup[]>>('/api/admin/permissions');
export const getPageSettings = () =>
  request<Result<PageSetting[]>>('/api/admin/page-settings');
export const savePageSetting = (data: {
  page_key: string;
  is_enabled: boolean;
  revision: number;
}) => saveSecurity('page-settings/save', data);
export async function saveSecurity(
  path: string,
  data: Record<string, unknown>,
) {
  try {
    const result = await request<Result<{ id: number }>>(`/api/admin/${path}`, {
      method: 'POST',
      data,
      skipErrorHandler: true,
    });
    if (result.code !== 0) throw new Error(result.msg || '保存失败');
    return result;
  } catch (error) {
    const responseError = error as { response?: { data?: { msg?: string } } };
    throw new Error(
      responseError.response?.data?.msg ||
        (error instanceof Error ? error.message : '保存失败'),
    );
  }
}
