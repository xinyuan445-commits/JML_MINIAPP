import { request } from '@umijs/max';

export type SalesOrderLine = {
  line_id: number;
  so_code: string;
  line_no: number;
  order_date: string;
  due_date: string;
  customer_code: string;
  customer_name: string;
  inv_code: string;
  inv_name: string;
  inv_std: string;
  unit_name: string;
  category_name: string;
  order_qty: number;
  shipped_qty: number;
  open_qty: number;
  linked_mo_qty: number;
};

export type DemandSalesLine = SalesOrderLine & {
  stock_allocated: number;
  linked_mo_allocated: number;
  net_production_qty: number;
  suggested_order_no: string | null;
};

export type MaterialRequirement = {
  material_code: string;
  material_name: string;
  material_std: string;
  unit_name: string;
  level: number;
  need_date: string;
  gross_qty: number;
  safe_qty: number;
  purchase_supply: number;
  production_supply: number;
  supply_allocated: number;
  net_requirement: number;
  suggested_qty: number;
  suggested_release_date: string;
  suggestion: string;
  supply_method: string;
  suggested_order_no: string | null;
  suggested_order_type: 'planned_purchase' | 'planned_production' | null;
  excess_qty: number;
  has_active_bom: boolean;
  inventory_details: Array<{
    warehouse_code: string;
    warehouse_name: string;
    mrp_enabled: boolean;
    on_hand_qty: number;
    available_qty: number;
    allocated_qty: number;
    remaining_qty: number;
  }>;
  open_purchase_orders: Array<{
    order_no: string;
    line_no: number;
    order_date: string | null;
    supply_date: string | null;
    remaining_qty: number;
    allocated_qty: number;
    remaining_after: number;
    eligible: boolean;
  }>;
  sources: string[];
};

export type CapacityTask = {
  key: string;
  so_code: string;
  line_no: number;
  planned_order_no: string | null;
  inv_code: string;
  inv_name: string;
  route_name: string;
  seq: number;
  process_name: string;
  station_name: string;
  device_name: string;
  quantity: number;
  task_unit: string;
  capacity_state: string;
  capacity_quantity: number | null;
  capacity_unit: string;
  duration_minutes: number | null;
  staffing: number | null;
  due_date: string;
  schedule_start: string | null;
  schedule_end: string | null;
};

export type StationLoad = {
  key: string;
  station_name: string;
  date: string;
  used_minutes: number;
  available_minutes: number;
  load_percent: number;
};

export type CalculationException = {
  type: string;
  source: string;
  message: string;
};

export type SupplyDemandRelation = {
  key: string;
  item_code: string;
  item_name: string;
  unit_name: string;
  demand_type: 'sales' | 'production';
  demand_order_no: string;
  demand_line_no: number | null;
  demand_date: string;
  root_sales_order: string;
  supply_type:
    | 'inventory'
    | 'existing_purchase'
    | 'existing_production'
    | 'planned_purchase'
    | 'planned_production'
    | 'unresolved';
  supply_order_no: string;
  supply_line_no: number | null;
  supply_order_date: string | null;
  supply_date: string | null;
  supply_location: string | null;
  quantity: number;
  preview: boolean;
};

export type DemandCalculation = {
  calculated_at: string;
  persisted: false;
  sales: DemandSalesLine[];
  materials: MaterialRequirement[];
  relations: SupplyDemandRelation[];
  tasks: CapacityTask[];
  station_loads: StationLoad[];
  exceptions: CalculationException[];
  summary: {
    sales_lines: number;
    production_lines: number;
    material_shortages: number;
    planned_purchase_orders: number;
    planned_production_orders: number;
    scheduled_tasks: number;
    exceptions: number;
  };
};

async function get<T>(path: string, params?: Record<string, unknown>) {
  const result = await request<{ code: number; data: T; msg?: string }>(
    `/api/demand/${path}`,
    { params },
  );
  if (result.code !== 0) throw new Error(result.msg || '读取失败');
  return result.data;
}

export const getSalesOrders = (params: Record<string, unknown>) =>
  get<SalesOrderLine[]>('sales-orders', params);

export const calculateDemand = (lineIds: number[], asOf: string) =>
  get<DemandCalculation>('calculate', {
    line_ids: lineIds.join(','),
    as_of: asOf,
  });
