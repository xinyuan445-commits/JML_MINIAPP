import type { Candidate, DailyData, Task } from './service';
import type { NonorderEdit } from './nonorderDraft';
import type { NonorderCreation } from './nonorderService';

export type Carry = {
  local_key: string;
  id: number;
  target_date: string;
  quantity: number;
  target_revision: number;
};
export type LocalDraft = {
  version: 1;
  sheet_id?: number;
  sheet_kind?: 'main' | 'supplement';
  owner: string;
  date: string;
  dept: string;
  revision: number;
  allDepartments?: boolean;
  revisions?: Record<string, number>;
  legacyStamps?: Record<string, string>;
  stamp: string;
  items: Task[];
  carries: Carry[];
  nonorder?: NonorderEdit[];
  nonorderCreations?: NonorderCreation[];
  target_headers: DailyData['target_headers'];
};
export const taskIdentity = (t: Candidate) =>
  `${t.mo_code}/${t.sort_seq}/${t.route_id}/${t.seq}/${t.kind}`;
const fullIdentity = (t: Candidate & { station_id: number }) =>
  `${taskIdentity(t)}/${t.station_id}`;
const round = (n: number) => Math.round(n * 10000) / 10000;
export const availableNow = (source: Candidate): number | null =>
  source.ready == null
    ? null
    : Math.max(
        0,
        round(Math.min(source.unassigned, source.ready - source.reserved)),
      );
export function taskReadiness(task: Task) {
  const remaining = Math.max(0, task.remaining);
  if (remaining === 0) return { ready: 0, waiting: 0 };
  if (task.current?.ready == null) return { ready: null, waiting: null };
  const ready = round(Math.min(remaining, Math.max(0, task.current.ready)));
  return { ready, waiting: round(remaining - ready) };
}
export function waitingToArrange(source: Candidate) {
  const ready = availableNow(source);
  return ready == null ? null : Math.max(0, round(source.unassigned - ready));
}
const remaining = (t: Task) =>
  t.status === 'active'
    ? Math.max(0, round(t.quantity - (t.actual.done || 0) - t.transferred_qty))
    : 0;
export const draftKey = (owner: string, date: string, dept: string) =>
  `jml.daily-tasks.v1:${JSON.stringify([owner, date, dept])}`;

export function decodeDraft(
  text: string | null,
  owner: string,
  date: string,
  dept: string,
): LocalDraft | undefined {
  if (!text) return undefined;
  const value = JSON.parse(text) as LocalDraft;
  if (
    value.version !== 1 ||
    value.owner !== owner ||
    value.date !== date ||
    value.dept !== dept ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.carries) ||
    (value.nonorder !== undefined && !Array.isArray(value.nonorder)) ||
    (value.nonorderCreations !== undefined && !Array.isArray(value.nonorderCreations)) ||
    !Number.isInteger(value.revision) ||
    typeof value.stamp !== 'string'
  ) {
    throw new Error('本地草稿格式不兼容，请先核对或放弃草稿');
  }
  return value;
}

export function createDraft(
  data: DailyData,
  dept: string,
  owner: string,
): LocalDraft {
  return {
    version: 1,
    owner,
    date: data.date,
    dept,
    revision: data.headers.find((h) => h.dept_name === dept)?.revision || 0,
    stamp: '',
    items: data.items
      .filter((t) => t.dept_name === dept)
      .map((t) => ({ ...t })),
    carries: [],
    target_headers: data.target_headers || [],
  };
}

// Only arrangements are overlaid. Actuals always come from the last server read.
export function previewDraft(data: DailyData, draft?: LocalDraft): DailyData {
  if (!draft || draft.date !== data.date) return data;
  const updated = draft.items.map((item) => {
    const saved = data.items.find(
      (t) => fullIdentity(t) === fullIdentity(item),
    );
    const outside = data.unplanned.find(
      (t) => fullIdentity(t) === fullIdentity(item),
    );
    const actual = saved?.actual || outside || {};
    const row = {
      ...item,
      actual,
      current: data.candidates.find(
        (c) => taskIdentity(c) === taskIdentity(item),
      ),
      issue: saved?.issue,
    };
    return {
      ...row,
      remaining: remaining(row),
      difference: round((actual.done || 0) - row.quantity),
    };
  });
  const candidates = data.candidates.map((c) => {
    if (!draft.allDepartments && c.dept_name !== draft.dept) return c;
    const old = data.items.filter(
      (t) =>
        (draft.allDepartments || t.dept_name === draft.dept) &&
        taskIdentity(t) === taskIdentity(c),
    );
    const next = updated.filter((t) => taskIdentity(t) === taskIdentity(c));
    const pending = draft.carries
      .filter((carry) => next.some((t) => t.id === carry.id))
      .reduce((sum, x) => sum + x.quantity, 0);
    const reserved = Math.max(
      0,
      round(
        c.reserved -
          old.reduce((sum, t) => sum + t.remaining, 0) +
          next.reduce((sum, t) => sum + t.remaining, 0) +
          pending,
      ),
    );
    return {
      ...c,
      reserved,
      unassigned: Math.max(0, round(c.maximum - reserved)),
      reservations: [
        ...(c.reservations || []).filter(
          (r) => !old.some((t) => t.id === r.id),
        ),
        ...next
          .filter((t) => t.remaining > 0)
          .map((t) => ({ id: t.id, date: data.date, quantity: t.remaining })),
        ...draft.carries
          .filter((carry) => next.some((t) => t.id === carry.id))
          .map((carry) => ({
            id: carry.id,
            date: carry.target_date,
            quantity: carry.quantity,
          })),
      ],
    };
  });
  return {
    ...data,
    items: [
      ...data.items.filter(
        (t) => !draft.allDepartments && t.dept_name !== draft.dept,
      ),
      ...updated,
    ].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    candidates,
  };
}

export function editDraft(
  base: LocalDraft,
  data: DailyData,
  body: Record<string, unknown>,
): LocalDraft {
  const view = previewDraft(data, base);
  const draft: LocalDraft = {
    ...base,
    items: view.items
      .filter((t) => base.allDepartments || t.dept_name === base.dept)
      .map((t) => ({ ...t })),
    carries: base.carries.map((c) => ({ ...c })),
    stamp: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
  let item = draft.items.find((t) => t.id === body.id);
  const amount = () => {
    const value = Number(body.quantity);
    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      value > 999999999999 ||
      Math.abs(round(value) - value) > 1e-8
    )
      throw new Error('数量须大于0，最多4位小数');
    return value;
  };
  if (body.action === 'add') {
    const source = view.candidates.find(
      (c) =>
        c.mo_code === body.mo_code &&
        c.sort_seq === body.sort_seq &&
        c.route_id === body.route_id &&
        c.seq === body.seq &&
        c.kind === body.kind,
    );
    const station = Number(body.station_id);
    if (!source?.allowed_station_ids.includes(station))
      throw new Error('工序或工站不可用，请刷新核对');
    item = draft.items.find(
      (t) =>
        fullIdentity(t) === fullIdentity({ ...source, station_id: station }),
    );
    const append = item?.status === 'active';
    if (append && !body.auto_quantity)
      throw new Error('已有此任务，请双击修改');
    const actual =
      item?.actual ||
      view.unplanned.find(
        (t) =>
          fullIdentity(t) === fullIdentity({ ...source, station_id: station }),
      ) ||
      {};
    const transferred = item?.transferred_qty || 0;
    const available = availableNow(source);
    const prearrange = body.auto_quantity && body.include_waiting === true;
    if (prearrange && (available !== 0 || source.unassigned <= 0))
      throw new Error('待安排数量已变化，请重新选择');
    const increment = prearrange ? source.unassigned : available;
    if (body.auto_quantity && (increment == null || increment <= 0))
      throw new Error(
        available == null
          ? '当前可做数量待核对，请刷新核对'
          : '当前没有可安排余量，请等待前道完成或领料',
      );
    // Existing work keeps its original allocation; append only the current free balance.
    const baseQuantity =
      append && item
        ? Math.max(item.quantity, (actual.done || 0) + transferred)
        : (actual.done || 0) + transferred;
    const quantity = body.auto_quantity
      ? round(baseQuantity + (increment || 0))
      : amount();
    if (!item) {
      item = {
        ...source,
        id: Math.min(0, ...draft.items.map((t) => t.id)) - 1,
        task_id: 0,
        station_id: station,
        quantity,
        actual,
        transferred_qty: 0,
        status: 'active',
        header_status: 'draft',
        remaining: 0,
        difference: 0,
        remark: '',
        sort_order: Math.max(0, ...draft.items.map((t) => t.sort_order)) + 1,
      };
      draft.items.push(item);
    }
    item.status = 'active';
    item.quantity = quantity;
    if (body.remark !== undefined) item.remark = String(body.remark);
  } else if (body.action === 'reorder') {
    const ids = body.ids as number[];
    if (!Array.isArray(ids)) throw new Error('排序无效');
    for (const [rank, id] of ids.entries()) {
      const row = draft.items.find((t) => t.id === id);
      if (row) row.sort_order = rank + 1;
    }
  } else if (!item) {
    throw new Error('任务不存在，请刷新核对');
  } else if (body.action === 'edit') {
    item.quantity = amount();
    item.remark = String(body.remark || '');
  } else if (body.action === 'cancel') {
    const cancelledId = item.id;
    const pending = draft.carries
      .filter((c) => c.id === cancelledId)
      .reduce((sum, c) => sum + c.quantity, 0);
    item.transferred_qty = round(item.transferred_qty - pending);
    draft.carries = draft.carries.filter((c) => c.id !== cancelledId);
    if (item.id < 0)
      draft.items = draft.items.filter((t) => t.id !== cancelledId);
    else item.status = 'cancelled';
  } else if (body.action === 'carry') {
    const quantity = amount();
    const target = String(body.target_date || '');
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(target) ||
      target <= base.date ||
      quantity > remaining(item)
    )
      throw new Error('结转日期或数量无效');
    draft.carries.push({
      local_key: draft.stamp,
      id: item.id,
      target_date: target,
      quantity,
      target_revision:
        base.target_headers.find(
          (h) => h.work_date === target && h.dept_name === item?.dept_name,
        )?.revision || 0,
    });
    item.transferred_qty = round(item.transferred_qty + quantity);
  } else if (body.action === 'uncarry') {
    const index = Number(body.index);
    const carry = draft.carries[index];
    if (!carry || carry.id !== item.id) throw new Error('结转草稿不存在');
    item.transferred_qty = round(item.transferred_qty - carry.quantity);
    draft.carries.splice(index, 1);
  } else {
    throw new Error('本地操作无效');
  }
  for (const t of draft.items) {
    if (
      t.status === 'active' &&
      t.quantity < (t.actual.done || 0) + t.transferred_qty &&
      (body.action === 'add' || body.action === 'edit') &&
      t.id === item?.id
    )
      throw new Error('安排量不能小于已完成与转出之和');
    t.remaining = remaining(t);
    t.difference = round((t.actual.done || 0) - t.quantity);
  }
  return draft;
}

export function batchPayload(draft: LocalDraft, publish = false) {
  return {
    action: 'batch',
    date: draft.date,
    dept_name: draft.dept,
    revision: draft.revision,
    publish,
    carries: draft.carries,
    items: draft.items.map((t) => ({
      id: t.id,
      mo_code: t.mo_code,
      sort_seq: t.sort_seq,
      route_id: t.route_id,
      seq: t.seq,
      kind: t.kind,
      station_id: t.station_id,
      quantity: t.quantity,
      remark: t.remark,
      status: t.status,
      sort_order: t.sort_order,
    })),
  };
}
