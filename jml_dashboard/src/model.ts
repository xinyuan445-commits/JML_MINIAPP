import type {
  DashboardOperations,
  DashboardOrder,
  DashboardStep,
} from './service';

const EPSILON = 0.0001;
export const positive = (value: number | null) =>
  value != null && value > EPSILON;
export const knownUnit = (unit?: string | null) =>
  Boolean(unit?.trim()) && !/未标|待核|未知/.test(unit || '');
export const orderKey = (order: DashboardOrder) =>
  `${order.mo_code}:${order.sort_seq}:${order.route_id}`;

export type FlowState =
  | 'work'
  | 'received'
  | 'rework'
  | 'ready'
  | 'done'
  | 'pending'
  | 'unknown';
export function stepState(step: DashboardStep): FlowState {
  if (positive(step.rework_remaining_qty)) return 'rework';
  if (positive(step.normal_remaining_qty))
    return step.status === 'received' ? 'received' : 'work';
  if (positive(step.receive_available_qty)) return 'ready';
  if (step.normal_remaining_qty == null) return 'unknown';
  if (positive(step.normal_received_qty) && positive(step.normal_done_qty))
    return 'done';
  return 'pending';
}

export function stepLabel(step: DashboardStep): string {
  const current = stepState(step);
  if (current === 'pending' && step.is_first_step) {
    return step.first_issued_qty == null ? '待核对' : '未领料';
  }
  return {
    done: '已完成',
    work: '生产中',
    received: '待开工',
    ready: '待接收',
    rework: '返工待完',
    pending: '未开始',
    unknown: '待核对',
  }[current];
}
export function stepAnomalies(
  order: DashboardOrder,
  orderedSteps: DashboardStep[],
  index: number,
): string[] {
  const step = orderedSteps[index];
  if (!step) return [];
  const anomalies: string[] = [];
  if (
    stepState(step) === 'done' &&
    positive(order.plan_qty) &&
    step.normal_done_qty + EPSILON < (order.plan_qty as number)
  ) {
    anomalies.push(
      `完工数量不足：累计${step.normal_done_qty}，计划${order.plan_qty}`,
    );
  }

  const previous = orderedSteps[index - 1];
  const downstreamAccounted =
    step.normal_received_qty != null && step.receive_available_qty != null
      ? step.normal_received_qty + step.receive_available_qty
      : null;
  if (
    previous &&
    previous.transferable_qty != null &&
    downstreamAccounted != null &&
    (stepState(previous) === 'done' || positive(downstreamAccounted)) &&
    Math.abs(previous.transferable_qty - downstreamAccounted) > EPSILON
  ) {
    anomalies.push(
      `上下游数量不一致：上道可流转${previous.transferable_qty}，本工序已接收及可接收${downstreamAccounted}`,
    );
  }
  return anomalies;
}
export function completionPercent(step: DashboardStep): number | null {
  if (!positive(step.normal_received_qty) || step.normal_remaining_qty == null)
    return null;
  return Math.min(
    100,
    Math.max(
      0,
      (step.normal_done_qty / (step.normal_received_qty as number)) * 100,
    ),
  );
}
export type FlowSegment = {
  key: string;
  order: DashboardOrder;
  steps: DashboardStep[];
  start: number;
  total: number;
};
export type FlowFrame = { segments: FlowSegment[] };
export type Coordination = {
  key: string;
  kind: 'rework' | 'received' | 'handoff';
  order: DashboardOrder;
  step: DashboardStep;
  qty: number;
};
export type TodayStation = {
  key: string;
  name: string;
  process: string;
  unit: string;
  normal: number;
  rework: number;
};
export function chunks<T>(rows: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, i) =>
    rows.slice(i * size, (i + 1) * size),
  );
}
export function buildFlowFrames(
  orders: DashboardOrder[],
  stepCount: number,
  rowCount: number,
): FlowFrame[] {
  const segments: FlowSegment[] = [];
  for (const order of orders) {
    const steps = [...order.steps].sort((a, b) => a.seq - b.seq);
    chunks(steps, stepCount).forEach((part, index) => {
      segments.push({
        key: `${orderKey(order)}:${index}`,
        order,
        steps: part,
        start: index * stepCount,
        total: steps.length,
      });
    });
  }
  return chunks(segments, rowCount).map((rows) => ({ segments: rows }));
}

export const visibleFlowRows = (height: number, rowHeight = 200) =>
  Math.max(1, Math.floor((height + 12) / (rowHeight + 12)));
export function buildDashboardView(data: DashboardOperations) {
  // Keep quantified work and confirmed quantity anomalies on the live board.
  const orders = data.orders
    .filter((order) => {
      const orderedSteps = [...order.steps].sort((a, b) => a.seq - b.seq);
      return (
        order.has_reporting === false ||
        orderedSteps.some(
          (step) =>
            positive(step.normal_remaining_qty) ||
            positive(step.rework_remaining_qty) ||
            positive(step.receive_available_qty),
        ) ||
        orderedSteps.some(
          (_, index) => stepAnomalies(order, orderedSteps, index).length > 0,
        )
      );
    })
    .sort(
      (a, b) =>
        Number(
          b.is_overdue ||
            b.steps.some((step) => positive(step.rework_remaining_qty)),
        ) -
          Number(
            a.is_overdue ||
              a.steps.some((step) => positive(step.rework_remaining_qty)),
          ) ||
        Number(b.is_overdue) - Number(a.is_overdue) ||
        Number(b.steps.some((step) => positive(step.rework_remaining_qty))) -
          Number(a.steps.some((step) => positive(step.rework_remaining_qty))) ||
        (a.plan_due_date || '9999-12-31').localeCompare(
          b.plan_due_date || '9999-12-31',
        ) ||
        (b.last_activity || '').localeCompare(a.last_activity || '') ||
        orderKey(a).localeCompare(orderKey(b)),
    );
  const actions: Coordination[] = [];
  for (const order of orders) {
    const first = Math.min(...order.steps.map((step) => step.seq));
    for (const step of order.steps) {
      const key = `${orderKey(order)}:${step.seq}`;
      if (positive(step.rework_remaining_qty))
        actions.push({
          key: `${key}:rework`,
          kind: 'rework',
          order,
          step,
          qty: step.rework_remaining_qty,
        });
      if (step.status === 'received' && positive(step.normal_remaining_qty))
        actions.push({
          key: `${key}:received`,
          kind: 'received',
          order,
          step,
          qty: step.normal_remaining_qty as number,
        });
      // First-station availability is issued material, not an inter-process handoff.
      if (step.seq !== first && positive(step.receive_available_qty))
        actions.push({
          key: `${key}:handoff`,
          kind: 'handoff',
          order,
          step,
          qty: step.receive_available_qty as number,
        });
    }
  }
  const priority = { rework: 0, received: 1, handoff: 2 };
  actions.sort(
    (a, b) =>
      priority[a.kind] - priority[b.kind] ||
      (b.step.last_activity || '').localeCompare(a.step.last_activity || '') ||
      a.key.localeCompare(b.key),
  );
  const today = new Map<string, TodayStation>();
  let omittedBatches = 0;
  for (const row of data.daily) {
    if (row.date !== data.today) continue;
    if (!knownUnit(row.unit_name)) {
      omittedBatches += row.batch_count;
      continue;
    }
    if (!positive(row.qty)) continue;
    const unit = row.unit_name.trim();
    const name = row.station_name?.trim() || row.process_name;
    const key = JSON.stringify([name, row.process_name, unit]);
    const item = today.get(key) || {
      key,
      name,
      process: row.process_name,
      unit,
      normal: 0,
      rework: 0,
    };
    item[row.kind] += row.qty;
    today.set(key, item);
  }
  return {
    orders,
    actions,
    today: [...today.values()].sort(
      (a, b) =>
        a.unit.localeCompare(b.unit, 'zh-CN') ||
        Math.max(b.normal, b.rework) - Math.max(a.normal, a.rework) ||
        a.key.localeCompare(b.key),
    ),
    omittedBatches,
    reworkCount: orders.filter((order) =>
      order.steps.some((step) => positive(step.rework_remaining_qty)),
    ).length,
    reviewCount: data.orders.filter(
      (order) =>
        !orders.includes(order) &&
        (order.is_active ||
          order.steps.some((step) => step.normal_remaining_qty == null)),
    ).length,
  };
}
