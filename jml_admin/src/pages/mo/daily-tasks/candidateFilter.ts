import dayjs from 'dayjs';
import type { Candidate } from './service';

export type StartDateRange = '1' | '3' | '7' | 'all';

export const candidateOrderKey = (row: Candidate) =>
  `${row.mo_code}/${row.sort_seq}/${row.route_id}`;

export function followupHint(row: Candidate, allRows: Candidate[]) {
  if (row.is_last_step === true) return '无后续工序';
  if (row.kind !== 'normal') return '';
  const pending = allRows.some(
    (next) =>
      candidateOrderKey(next) === candidateOrderKey(row) &&
      next.kind === 'normal' &&
      next.seq > row.seq &&
      (next.unassigned > 0 ||
        (next.has_active_execution && next.ready == null)),
  );
  if (pending) return '后续工序请查看本工单其他任务';
  return row.is_last_step === false
    ? '后续暂无待安排余量'
    : '后续工序信息待更新';
}

// Determine the current step before search/date filters and reservation hiding.
// Fully assigned work is still unfinished and must not promote its successor.
export function groupCandidateStages(rows: Candidate[], allRows: Candidate[]) {
  const first = new Map<string, number>();
  for (const row of allRows) {
    if (row.kind !== 'normal') continue;
    if (row.maximum <= 0 && !row.has_active_execution) continue;
    const key = candidateOrderKey(row);
    first.set(key, Math.min(first.get(key) ?? row.seq, row.seq));
  }
  const groups = new Map<
    string,
    { key: string; source: Candidate; current: Candidate[]; later: Candidate[] }
  >();
  for (const row of rows) {
    const key = candidateOrderKey(row);
    const group = groups.get(key) || {
      key,
      source: row,
      current: [],
      later: [],
    };
    const waitingOnly =
      row.kind === 'normal' &&
      row.seq > (first.get(key) ?? row.seq) &&
      row.ready === 0 &&
      row.receivable === 0 &&
      row.received_remaining === 0 &&
      !row.has_active_execution;
    (waitingOnly ? group.later : group.current).push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    current: group.current.sort((a, b) => a.seq - b.seq),
    later: group.later.sort((a, b) => a.seq - b.seq),
  }));
}

export function businessToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join('-');
}

export function candidateDateWindow(today: string, range: StartDateRange) {
  return range === 'all'
    ? null
    : {
        end: dayjs(today).add(Number(range), 'day').format('YYYY-MM-DD'),
      };
}

export function groupCandidates(
  rows: Candidate[],
  today: string,
  range: StartDateRange,
) {
  const window = candidateDateWindow(today, range);
  const onsite: Candidate[] = [];
  const recent: Candidate[] = [];
  for (const row of rows) {
    const unknownActive =
      row.kind === 'normal' &&
      row.has_active_execution &&
      row.received_remaining == null;
    // Keep unquantified active work for checking, but hide fully reserved work.
    if (row.unassigned <= 0 && !(unknownActive && row.reserved <= 0)) continue;
    // Rework candidates expose outstanding rework as received_remaining.
    // Past completions by themselves do not make this step an onsite task.
    if (
      (row.receivable || 0) > 0 ||
      (row.received_remaining || 0) > 0 ||
      unknownActive
    ) {
      onsite.push(row);
      continue;
    }
    const start = row.plan_start_date?.slice(0, 10);
    if (!window || (start && start <= window.end)) recent.push(row);
  }
  return [
    { key: 'onsite', label: '现场待做', rows: onsite },
    {
      key: 'recent',
      label: range === 'all' ? '其他任务' : '计划开工范围内任务',
      rows: recent,
    },
  ];
}

export function groupCandidatesForDisplay(
  rows: Candidate[],
  allRows: Candidate[],
  today: string,
  range: StartDateRange,
) {
  const groups = groupCandidates(rows, today, range);
  const onsiteKeys = new Set(groups[0].rows.map(candidateOrderKey));
  const allStages = new Map(
    groupCandidateStages(
      groupCandidates(allRows, today, 'all').flatMap((group) => group.rows),
      allRows,
    ).map((order) => [order.key, order]),
  );
  return groups.map((group) => ({
    ...group,
    orders: groupCandidateStages(group.rows, allRows)
      .map((order) => ({
        ...order,
        // Old onsite work must still provide access to its future operations.
        // Keep one later-steps entry even if the order spans both date groups.
        later:
          group.key === 'onsite'
            ? allStages.get(order.key)?.later || []
            : onsiteKeys.has(order.key)
              ? []
              : order.current.length
                ? allStages.get(order.key)?.later || []
                : order.later,
      }))
      .filter((order) => order.current.length || order.later.length),
  }));
}
