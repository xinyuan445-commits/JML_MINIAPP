import { request } from '@umijs/max';
import { saveSecurity } from '../service';

export type StationStaff = {
  id: string;
  name: string;
  position?: string;
  status: string;
};

export type StationConfiguration = {
  id: number;
  station_code: string;
  station_name: string;
  is_active: number;
  leader_staff_id: string | null;
  scanner_staff_ids: string[];
  leader: StationStaff | null;
  scanners: StationStaff[];
  revision: number;
  configured: boolean;
  updated_by?: string;
  update_time?: string;
};

type Result<T> = { code: number; data: T; msg?: string };
export type ReportAccessMode = 'exempt' | 'station' | 'all';

export const getStationConfigurations = () =>
  request<
    Result<{
      enforcement_enabled?: boolean;
      report_access_mode?: ReportAccessMode;
      setting_revision?: number;
      stations: StationConfiguration[];
    }>
  >('/api/admin/station-permissions');

export const getStationStaff = () =>
  request<Result<StationStaff[]>>('/api/admin/station-permissions/staff');

export type StationExemptions = {
  staff_ids: string[];
  staff: StationStaff[];
  revision: number;
  updated_by?: string;
  update_time?: string;
  enforcement_enabled: boolean;
};

export const getStationExemptions = () =>
  request<Result<StationExemptions>>(
    '/api/admin/station-permissions/exemptions',
  );

export const saveStationSetting = (data: {
  enabled: boolean;
  report_access_mode: ReportAccessMode;
  revision: number;
}) => saveSecurity('station-permissions/settings/save', data);

export const saveStationExemptions = (data: {
  staff_ids: string[];
  revision: number;
}) => saveSecurity('station-permissions/exemptions/save', data);

export const saveStationConfiguration = (data: {
  station_id: number;
  leader_staff_id: string | null;
  scanner_staff_ids: string[];
  revision: number;
}) => saveSecurity('station-permissions/save', data);

export type StationProxy = {
  id: number;
  staff_id: string;
  starts_at: string;
  ends_at: string;
  person: StationStaff;
};

export type StationProxyConfiguration = {
  station_id: number;
  version: string;
  proxies: StationProxy[];
};

export const getStationProxies = () =>
  request<Result<StationProxyConfiguration[]>>(
    '/api/admin/station-permissions/proxies',
  );

export const saveStationProxies = (data: {
  station_id: number;
  version: string;
  proxies: { staff_id: string; starts_at: string; ends_at: string }[];
}) => saveSecurity('station-permissions/proxies/save', data);
