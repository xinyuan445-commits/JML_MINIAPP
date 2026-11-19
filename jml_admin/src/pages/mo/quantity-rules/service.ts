import { type RequestOptions, request } from '@umijs/max';

export type QuantityRuleSetting = {
  completion_not_exceed_received: boolean;
  receive_not_exceed_previous_completed: boolean;
  completion_not_exceed_previous_completed: boolean;
  revision: number;
};
export type QuantityRulesData = {
  setting: QuantityRuleSetting;
  scope: string;
};

async function call<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const result = await request<{ code: number; data: T; msg?: string }>(
    url,
    options,
  );
  if (result.code !== 0) throw new Error(result.msg || '操作失败');
  return result.data;
}

export const getQuantityRules = () =>
  call<QuantityRulesData>('/api/admin/quantity-rules');
export const saveQuantityRuleSetting = (data: QuantityRuleSetting) =>
  call<{ revision: number }>('/api/admin/quantity-rules/setting/save', {
    method: 'POST',
    data,
  });
