import {
  buildDashboardView,
  buildFlowFrames,
  completionPercent,
  compareSalesOrders,
  stepAnomalies,
  stepLabel,
  stepState,
  visibleFlowRows,
} from './model';
import type {
  DashboardDaily,
  DashboardOperations,
  DashboardOrder,
  DashboardStep,
} from './service';

function step(values: Partial<DashboardStep> = {}): DashboardStep {
  return {
    seq: 1,
    process_name: '拼接',
    station_name: '拼接一站',
    station_id: 1,
    status: 'partial',
    normal_received_qty: 20,
    normal_done_qty: 10,
    qty_a: 10,
    qty_a1: 0,
    qty_a2: 0,
    qty_c: 0,
    normal_remaining_qty: 10,
    receive_available_qty: 0,
    receiving_qty: 0,
    rework_remaining_qty: 0,
    workers: ['开工甲'],
    rework_workers: [],
    ...values,
  };
}

function order(values: Partial<DashboardOrder> = {}): DashboardOrder {
  return {
    mo_code: 'SCDD-001',
    sort_seq: 1,
    route_id: 1,
    route_name: '拼接路线',
    inv_name: '木皮',
    unit_name: '张',
    dept_name: '生产部',
    plan_qty: 20,
    plan_due_date: '2026-09-10',
    plan_shortfall_qty: 10,
    is_active: true,
    has_work: true,
    has_receivable: false,
    has_rework: false,
    is_overdue: false,
    steps: [step()],
    ...values,
  };
}

it('sorts sales rows by descending first material character without work order or work order line', () => {
  const material = (values: Partial<DashboardOrder>) => order({
    so_code_008: 'XSDD251011882', so_row_008: 6, ...values,
  });
  const finished = material({ mo_code: 'SCDD26113179', inv_code: '1313ZS-HPL' });
  const semiFinished = material({ mo_code: 'SCDD26113197', inv_code: '21-HPL' });
  expect([finished, semiFinished].sort(compareSalesOrders)).toEqual([semiFinished, finished]);
  expect(compareSalesOrders(
    material({ mo_code: 'SCDD-1', sort_seq: 2, inv_code: '1-A' }),
    material({ mo_code: 'SCDD-1', sort_seq: 10, inv_code: '2-A' }),
  )).toBeGreaterThan(0);
  expect(compareSalesOrders(
    material({ mo_code: 'SCDD-99', sort_seq: 10, inv_code: '1-A' }),
    material({ mo_code: 'SCDD-1', sort_seq: 2, inv_code: '1-Z' }),
  )).toBe(0);
  expect(compareSalesOrders(
    material({ inv_code: '1313ZS-HPL' }),
    material({ inv_code: '21-HPL' }),
  )).toBeGreaterThan(0);
  expect(compareSalesOrders(
    material({ inv_code: '1999-Z' }),
    material({ inv_code: '1000-A' }),
  )).toBe(0);
});

function daily(values: Partial<DashboardDaily> = {}): DashboardDaily {
  return {
    date: '2026-09-07',
    kind: 'normal',
    process_name: '末工序',
    station_name: '末站',
    unit_name: '张',
    qty: 10,
    qty_a: 10,
    qty_a1: 0,
    qty_a2: 0,
    qty_c: 0,
    batch_count: 1,
    is_final: true,
    ...values,
  };
}

function data(
  orders: DashboardOrder[] = [order()],
  events: DashboardDaily[] = [],
): DashboardOperations {
  return {
    today: '2026-09-07',
    generated_at: '2026-09-07 11:30:00',
    orders,
    daily: events,
    warnings: [],
  };
}

describe('production flow model', () => {
  it('excludes historical unknowns, unconfirmed plan shortfalls and empty stations', () => {
    const view = buildDashboardView(
      data([
        order(),
        order({
          mo_code: 'HISTORY',
          is_overdue: true,
          steps: [
            step({
              normal_received_qty: null,
              normal_remaining_qty: null,
              receive_available_qty: null,
            }),
          ],
        }),
        order({
          mo_code: 'PLAN',
          is_overdue: true,
          plan_shortfall_qty: 50,
          steps: [step({ normal_done_qty: 20, normal_remaining_qty: 0 })],
        }),
        order({
          mo_code: 'IDLE',
          is_active: false,
          steps: [
            step({
              normal_received_qty: 0,
              normal_done_qty: 0,
              normal_remaining_qty: 0,
            }),
          ],
        }),
      ]),
    );
    expect(view.orders.map((row) => row.mo_code)).toEqual(['SCDD-001']);
    expect(view.reviewCount).toBe(2);
    expect(view.actions).toEqual([]);
  });

  it('keeps ERP-open lines that have not reported any work', () => {
    const view = buildDashboardView(
      data([
        order({
          mo_code: 'SCDD-NEW',
          has_reporting: false,
          is_active: true,
          has_work: false,
          steps: [
            step({
              status: 'pending',
              normal_received_qty: 0,
              normal_done_qty: 0,
              normal_remaining_qty: 0,
              receive_available_qty: 0,
            }),
          ],
        }),
      ]),
    );

    expect(view.orders.map((row) => row.mo_code)).toEqual(['SCDD-NEW']);
  });

  it('retains first receipts without stations, pure rework and quantified work despite stale flags', () => {
    const view = buildDashboardView(
      data([
        order({
          mo_code: 'RECEIVED',
          steps: [
            step({
              status: 'received',
              station_name: null,
              normal_done_qty: 0,
              normal_remaining_qty: 20,
            }),
          ],
        }),
        order({
          mo_code: 'REWORK',
          is_active: false,
          steps: [
            step({
              normal_remaining_qty: 0,
              normal_done_qty: 20,
              rework_remaining_qty: 3,
            }),
          ],
        }),
        order({
          mo_code: 'READY',
          steps: [step({ normal_remaining_qty: 0, receive_available_qty: 5 })],
        }),
      ]),
    );
    expect(view.orders).toHaveLength(3);
    expect(view.reworkCount).toBe(1);
    expect(view.actions.map((item) => item.kind)).toEqual([
      'rework',
      'received',
    ]);
  });

  it('does not add supplemental receipt quantities twice or merge normal and rework', () => {
    const item = step({
      normal_received_qty: 32,
      receiving_qty: 12,
      normal_done_qty: 17,
      normal_remaining_qty: 15,
      rework_remaining_qty: 2,
    });
    const view = buildDashboardView(data([order({ steps: [item] })]));
    expect(completionPercent(item)).toBeCloseTo((17 / 32) * 100);
    expect(view.orders[0].steps[0].normal_remaining_qty).toBe(15);
    expect(view.actions[0].qty).toBe(2);
    expect(stepState(item)).toBe('rework');
  });

  it('uses the next step receivable balance, not total upstream output which includes C', () => {
    const view = buildDashboardView(
      data([
        order({
          steps: [
            step({
              normal_remaining_qty: 0,
              normal_done_qty: 20,
              receive_available_qty: 8,
            }),
            step({
              seq: 2,
              process_name: '修边',
              receive_available_qty: 9,
              normal_remaining_qty: 0,
            }),
          ],
        }),
      ]),
    );
    expect(view.actions).toHaveLength(1);
    expect(view.actions[0]).toMatchObject({
      kind: 'handoff',
      qty: 9,
      step: { seq: 2 },
    });
  });

  it('keeps receiving and rework actions independently for the same step', () => {
    const view = buildDashboardView(
      data([
        order({
          steps: [
            step({
              seq: 2,
              status: 'received',
              rework_remaining_qty: 3,
              receive_available_qty: 7,
            }),
            step({ seq: 1, normal_remaining_qty: 0 }),
          ],
        }),
      ]),
    );
    expect(view.actions.map((item) => item.kind)).toEqual([
      'rework',
      'received',
      'handoff',
    ]);
    expect(new Set(view.actions.map((item) => item.key)).size).toBe(3);
  });

  it('distinguishes known zero, missing history, pending receipts and completed received quantities', () => {
    expect(
      stepState(step({ status: 'processing', normal_remaining_qty: null })),
    ).toBe('unknown');
    expect(
      stepState(step({ status: 'processing', normal_remaining_qty: 0 })),
    ).toBe('done');
    expect(
      stepState(
        step({
          normal_received_qty: 0,
          normal_done_qty: 0,
          normal_remaining_qty: 0,
        }),
      ),
    ).toBe('pending');
    expect(stepState(step({ status: 'received' }))).toBe('received');
    expect(
      stepState(step({ normal_remaining_qty: 0, receive_available_qty: 3 })),
    ).toBe('ready');
    expect(completionPercent(step({ normal_received_qty: null }))).toBeNull();
    expect(completionPercent(step({ normal_received_qty: 0 }))).toBeNull();
    expect(
      completionPercent(step({ normal_received_qty: 10, normal_done_qty: 15 })),
    ).toBe(100);
  });

  it('labels first-station material states without changing downstream pending steps', () => {
    expect(
      stepLabel(
        step({
          is_first_step: true,
          first_issued_qty: 0,
          normal_received_qty: 0,
          normal_done_qty: 0,
          normal_remaining_qty: 0,
        }),
      ),
    ).toBe('未领料');
    expect(
      stepLabel(
        step({
          is_first_step: true,
          first_issued_qty: null,
          normal_received_qty: 0,
          normal_done_qty: 0,
          normal_remaining_qty: 0,
        }),
      ),
    ).toBe('待核对');
    expect(
      stepLabel(
        step({
          seq: 2,
          normal_received_qty: 0,
          normal_done_qty: 0,
          normal_remaining_qty: 0,
        }),
      ),
    ).toBe('未开始');
  });

  it('marks completed shortfalls and real upstream/downstream quantity mismatches', () => {
    const completed = step({
      normal_received_qty: 10,
      normal_done_qty: 10,
      transferable_qty: 9,
      normal_remaining_qty: 0,
    });
    const mismatched = step({
      seq: 2,
      normal_received_qty: 7,
      normal_done_qty: 0,
      normal_remaining_qty: 7,
      receive_available_qty: 1,
    });
    const item = order({ plan_qty: 20, steps: [completed, mismatched] });
    expect(stepAnomalies(item, item.steps, 0)[0]).toContain('完工数量不足');
    expect(stepAnomalies(item, item.steps, 1)[0]).toContain('上下游数量不一致');
  });

  it('does not treat normal unreceived output or C grade as a handoff mismatch', () => {
    const completed = step({
      normal_received_qty: 20,
      normal_done_qty: 20,
      transferable_qty: 19,
      normal_remaining_qty: 0,
    });
    const waiting = step({
      seq: 2,
      normal_received_qty: 9,
      normal_done_qty: 0,
      normal_remaining_qty: 9,
      receive_available_qty: 10,
    });
    const item = order({ plan_qty: 20, steps: [completed, waiting] });
    expect(stepAnomalies(item, item.steps, 1)).toEqual([]);
  });

  it('shows every real step in order and retains each order department when packing a screen', () => {
    const orders = [
      order({ steps: [step({ seq: 3 }), step({ seq: 1 }), step({ seq: 2 })] }),
      order({ mo_code: 'SECOND', dept_name: '设备部' }),
    ];
    const before = JSON.stringify(orders);
    const frames = buildFlowFrames(orders, 2, 2);
    expect(frames).toHaveLength(2);
    expect(
      frames[0].segments.map((row) => row.steps.map((item) => item.seq)),
    ).toEqual([[1, 2], [3]]);
    expect(frames[0].segments[1]).toMatchObject({ start: 2, total: 3 });
    expect(frames[1].segments[0].order.dept_name).toBe('设备部');
    expect(JSON.stringify(orders)).toBe(before);
  });

  it('keeps every order and route segment available for automatic paging', () => {
    const orders = Array.from({ length: 9 }, (_, i) =>
      order({
        mo_code: `ORDER-${i}`,
        steps: Array.from({ length: 7 }, (_, n) => step({ seq: n + 1 })),
      }),
    );
    const frames = buildFlowFrames(orders, 3, 2);
    expect(frames.flatMap((frame) => frame.segments)).toHaveLength(27);
    expect(
      new Set(
        frames.flatMap((frame) => frame.segments.map((segment) => segment.key)),
      ).size,
    ).toBe(27);
  });

  it('fills each screen across departments instead of leaving one order per department page', () => {
    const frames = buildFlowFrames(
      Array.from({ length: 7 }, (_, i) =>
        order({ mo_code: `ORDER-${i}`, dept_name: `部门${i}` }),
      ),
      6,
      4,
    );
    expect(frames.map((frame) => frame.segments.length)).toEqual([4, 3]);
    expect(
      new Set(
        frames.flatMap((frame) =>
          frame.segments.map((segment) => segment.order.mo_code),
        ),
      ).size,
    ).toBe(7);
    expect(visibleFlowRows(850)).toBe(4);
    expect(visibleFlowRows(630)).toBe(3);
    expect(visibleFlowRows(100)).toBe(1);
  });

  it('uses actual today batches at every process and separates rework and units', () => {
    const view = buildDashboardView(
      data(
        [],
        [
          daily({ qty: 10, is_final: false }),
          daily({ qty: 2, kind: 'rework', is_final: false }),
          daily({ qty: 3, unit_name: '千克' }),
          daily({ qty: 500, date: '2026-09-06' }),
          daily({ qty: 600, unit_name: '', batch_count: 2 }),
        ],
      ),
    );
    expect(view.today).toHaveLength(2);
    expect(view.today.find((row) => row.unit === '张')).toMatchObject({
      normal: 10,
      rework: 2,
    });
    expect(view.today.find((row) => row.unit === '千克')).toMatchObject({
      normal: 3,
      rework: 0,
    });
    expect(view.omittedBatches).toBe(2);
  });

  it('preserves distinct processes with the same station and uses process name when station is absent', () => {
    const view = buildDashboardView(
      data(
        [],
        [
          daily(),
          daily({ process_name: '第二工序' }),
          daily({ station_name: null, process_name: '无站工序' }),
        ],
      ),
    );
    expect(view.today).toHaveLength(3);
    expect(view.today.some((row) => row.name === '无站工序')).toBe(true);
  });

  it('does not fabricate today production from historical cumulative totals', () => {
    const view = buildDashboardView(data([order()], []));
    expect(view.today).toEqual([]);
    expect(view.orders).toHaveLength(1);
  });

  it('does not mutate its source snapshot and handles empty data', () => {
    const input = data([order({ is_overdue: true })], [daily()]);
    const original = JSON.stringify(input);
    buildDashboardView(input);
    expect(JSON.stringify(input)).toBe(original);
    expect(buildDashboardView(data([], [])).orders).toEqual([]);
    expect(buildFlowFrames([], 4, 2)).toEqual([]);
  });
});
