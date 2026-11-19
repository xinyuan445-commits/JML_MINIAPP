import { candidateOrderKey } from './candidateFilter';
import {
  availableNow,
  editDraft,
  type LocalDraft,
  previewDraft,
  taskIdentity,
} from './draft';
import type { Candidate, DailyData, Task } from './service';

export type DraftChange = {
  key: number;
  action: '新增' | '修改' | '取消';
  task: Task;
  before?: Task;
  notes: string[];
};

export function draftChanges(
  data: DailyData,
  draft: LocalDraft,
): DraftChange[] {
  const saved = new Map(data.items.map((task) => [task.id, task]));
  const result: DraftChange[] = [];
  for (const task of draft.items) {
    const before = saved.get(task.id);
    const carries = draft.carries.filter((carry) => carry.id === task.id);
    if (!before && task.status === 'cancelled') continue;
    const changed =
      !before ||
      carries.length ||
      before.status !== task.status ||
      before.quantity !== task.quantity ||
      before.station_id !== task.station_id ||
      before.remark !== task.remark ||
      before.sort_order !== task.sort_order ||
      before.transferred_qty !== task.transferred_qty;
    if (!changed) continue;
    const notes: string[] = [];
    if (before?.status === 'cancelled' && task.status === 'active')
      notes.push('恢复安排');
    if (before && before.remark !== task.remark)
      notes.push(`备注：${before.remark || '无'} → ${task.remark || '无'}`);
    else if (!before && task.remark) notes.push(`备注：${task.remark}`);
    if (before && before.sort_order !== task.sort_order)
      notes.push(`顺序：${before.sort_order} → ${task.sort_order}`);
    for (const carry of carries)
      notes.push(
        `结转 ${carry.quantity}${task.unit_name} → ${carry.target_date}`,
      );
    result.push({
      key: task.id,
      action: !before ? '新增' : task.status === 'cancelled' ? '取消' : '修改',
      task,
      before,
      notes,
    });
  }
  return result;
}

export function routeCandidates(data: DailyData, source: Candidate) {
  if (source.kind !== 'normal') return [];
  return data.candidates
    .filter(
      (row) =>
        candidateOrderKey(row) === candidateOrderKey(source) &&
        row.kind === 'normal' &&
        row.seq >= source.seq &&
        row.unassigned > 0,
    )
    .sort((a, b) => a.seq - b.seq);
}

// Build all changes in memory first; a failed step must not leave a partial route.
export function arrangeRoute(
  base: LocalDraft,
  data: DailyData,
  source: Candidate,
  stations: Record<string, number>,
) {
  const rows = routeCandidates(previewDraft(data, base), source);
  if (!rows.length) throw new Error('当前及后续已无可安排余量');
  let next = base;
  for (const row of rows) {
    const station = stations[taskIdentity(row)];
    if (
      !row.allowed_station_ids.includes(station) ||
      !data.stations.some((s) => s.id === station && s.is_active)
    )
      throw new Error(`${row.seq}. ${row.process_name}：请选择可用工站`);
    if (availableNow(row) == null)
      throw new Error(
        `${row.seq}. ${row.process_name}：数量待核对，请先单独处理`,
      );
    next = editDraft(next, data, {
      action: 'add',
      mo_code: row.mo_code,
      sort_seq: row.sort_seq,
      route_id: row.route_id,
      seq: row.seq,
      kind: row.kind,
      station_id: station,
      auto_quantity: true,
      include_waiting: availableNow(row) === 0,
    });
  }
  return { draft: next, count: rows.length };
}
