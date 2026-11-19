import { request } from '@umijs/max';

export type EquipmentRow = Record<string, any> & {
  id: number;
  device_id: string;
  station_id: number;
};
export type Options = {
  devices: {
    id: string;
    name: string;
    enable: string;
    profile?: Record<string, any>;
    [key: string]: any;
  }[];
  stations: {
    id: number;
    station_code: string;
    station_name: string;
    is_active: number;
  }[];
  bindings: { id: number; device_id: string; station_id: number }[];
  processes: { id: number; process_name: string; station_id: number }[];
  categories: { code: string; name: string; unit?: string }[];
  types: string[];
  workshops: string[];
  units: string[];
};
export type Conversion = {
  state: 'finite' | 'unlimited' | 'unconfigured' | 'inactive' | 'incomplete';
  hourly: string | null;
  unit_minutes: string | null;
  target_minutes: string | null;
};
export type EquipmentDetail = EquipmentRow & {
  standards: Record<string, any>[];
  history: Record<string, any>[];
};
async function get<T>(path: string, params?: Record<string, unknown>) {
  const result = await request<{ code: number; data: T; msg?: string }>(
    `/api/mo/equipment/${path}`,
    { params },
  );
  if (result.code !== 0) throw new Error(result.msg || '加载失败');
  return result.data;
}
export const getOptions = () => get<Options>('options');
export const getEquipment = () => get<EquipmentRow[]>('list');
export const getDetail = (id: number) => get<EquipmentDetail>('detail', { id });
export const getApproval = (id: number) =>
  get<Record<string, any>>('approval', { id });
export const previewCapacity = (params: Record<string, unknown>) =>
  get<Conversion>('preview', params);
export const calculateCapacity = (params: Record<string, unknown>) =>
  get<Conversion & { standard_id: number | null }>('calculate', params);
