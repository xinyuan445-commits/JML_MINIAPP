import { request } from '@umijs/max';

const BASE = '/api/outsource/document-print';

export async function getOutsourceDocument(mo_code: string) {
  return request<{ code: number; msg?: string; data: any }>(BASE, {
    params: { mo_code },
    timeout: 15000,
  });
}

export async function getOutsourceDocumentOptions(keyword: string) {
  return request<{ code: number; msg?: string; data: string[] }>(
    `${BASE}/options`,
    {
      params: { keyword },
      timeout: 15000,
    },
  );
}

export async function logOutsourceDocumentPrint(data: {
  mo_code: string;
  line_count: number;
  material_count: number;
  page_count: number;
}) {
  return request<{ code: number; msg?: string }>(`${BASE}/print-log`, {
    method: 'POST',
    data,
    skipErrorHandler: true,
  });
}
