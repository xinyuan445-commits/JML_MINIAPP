import { request } from '@umijs/max';

export type ApprovalModule = 'process' | 'workstation' | 'category' | 'route' | 'equipment' | 'equipment-capacity';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type ApprovalApplicant = {
  applicant_account_id: number;
  applicant_name: string;
};

export type ApprovalItem = {
  id: number;
  request_no: string;
  module_type: ApprovalModule;
  action_type: 'create' | 'edit' | 'status' | 'version' | 'restore';
  target_key: string;
  before_data?: Record<string, any> | null;
  product_category_names?: Record<string, string>;
  after_data: Record<string, any>;
  status: ApprovalStatus;
  applicant_account_id: number;
  applicant_name: string;
  reviewer_name?: string;
  review_comment?: string;
  apply_time: string;
  review_time?: string;
  revision: number;
};

const BASE = '/api/admin/config-approvals';

export async function getConfigApprovals(params: {
  current?: number;
  pageSize?: number;
  scope: 'mine' | 'pending' | 'history';
  module_type?: string;
  applicant_account_id?: number;
}) {
  try {
    return await request<{
      code: number;
      msg?: string;
      data: ApprovalItem[];
      total: number;
      applicants?: ApprovalApplicant[];
    }>(BASE, { params, skipErrorHandler: true });
  } catch (error: any) {
    return error?.response?.data || { code: 1, msg: '加载失败', data: [], total: 0 };
  }
}

export async function reviewConfigApproval(data: {
  id: number;
  revision: number;
  decision: 'approve' | 'reject';
  comment?: string;
}) {
  try {
    return await request<{ code: number; msg?: string }>(`${BASE}/review`, {
      method: 'POST',
      data,
      skipErrorHandler: true,
    });
  } catch (error: any) {
    return error?.response?.data || { code: 1, msg: '审批失败' };
  }
}

export async function markApprovalResultsRead() {
  try {
    return await request<{ code: number; msg?: string }>(`${BASE}/notifications/read`, {
      method: 'POST',
      skipErrorHandler: true,
    });
  } catch (error: any) {
    return error?.response?.data || { code: 1, msg: '标记已读失败' };
  }
}
