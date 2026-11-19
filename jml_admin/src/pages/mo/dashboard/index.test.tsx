import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { history } from '@umijs/max';
import React from 'react';
import { currentUser } from '@/services/ant-design-pro/api';
import { exportDashboardExcel } from './exportExcel';
import DashboardPage from './index';
import { getDashboardOperations } from './service';

type DashboardOperations = import('./service').DashboardOperations;
type DashboardOrder = import('./service').DashboardOrder;
type DashboardStep = import('./service').DashboardStep;

jest.mock('./service', () => ({ getDashboardOperations: jest.fn() }));
jest.mock('./exportExcel', () => ({
  exportDashboardExcel: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/ant-design-pro/api', () => ({ currentUser: jest.fn() }));
jest.mock('@umijs/max', () => ({
  history: { push: jest.fn() },
  useModel: () => {
    const [initialState, setInitialState] = jest.requireActual('react').useState({});
    return { initialState, setInitialState };
  },
}));

const getOperations = jest.mocked(getDashboardOperations);
const getCurrentUser = jest.mocked(currentUser);
const navigate = jest.mocked(history.push);

function step(values: Partial<DashboardStep> = {}): DashboardStep {
  return {
    seq: 1,
    process_name: '拼接',
    station_name: '拼接一站',
    station_id: 1,
    status: 'partial',
    normal_received_qty: 20,
    normal_done_qty: 10,
    qty_a: 7,
    qty_a1: 1,
    qty_a2: 1,
    qty_c: 1,
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
    inv_code: '3402-TEST-001',
    inv_name: '测试木皮',
    inv_std: '1220*2440*18',
    customer_name: '南京艾尔其装饰材料有限公司',
    unit_name: '张',
    dept_name: '生产部',
    plan_qty: 20,
    plan_start_date: '2026-09-01',
    plan_due_date: '2026-09-07',
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

function snapshot(orders: DashboardOrder[] = [order()]): DashboardOperations {
  return {
    generated_at: '2026-09-07 11:30:00',
    today: '2026-09-07',
    orders,
    daily: [],
    warnings: [],
  };
}

async function show(data = snapshot()) {
  getOperations.mockResolvedValue({ code: 0, data });
  await act(async () => {
    render(React.createElement(DashboardPage));
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  getOperations.mockReset();
  getCurrentUser.mockReset();
  getCurrentUser.mockResolvedValue({
    data: { username: 'admin' },
  } as any);
  jest.mocked(exportDashboardExcel).mockClear();
  navigate.mockReset();
  jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  jest.replaceProperty(window, 'innerHeight', 620);
  jest.replaceProperty(window, 'innerWidth', 1440);
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('production progress matrix screen', () => {
  it('sorts by sales order, numeric sales line and descending material prefix across pages', async () => {
    const orders = [
      order({ mo_code: 'NO-SALE', inv_code: 'AAA' }),
      order({ mo_code: 'A10', so_code_008: 'SO-A', so_row_008: 10, inv_code: 'AAA' }),
      order({ mo_code: 'A2-Z', so_code_008: 'SO-A', so_row_008: 2, inv_code: '1313ZS-HPL' }),
      order({ mo_code: 'B1', so_code_008: 'SO-B', so_row_008: 1, inv_code: 'AAA' }),
      order({ mo_code: 'A2-A', so_code_008: 'SO-A', so_row_008: '2', inv_code: '21-HPL' }),
      order({ mo_code: 'A-UNKNOWN', so_code_008: 'SO-A', inv_code: 'AAA' }),
      order({ mo_code: 'CLOSED', so_code_008: 'SO-A', so_row_008: 1, is_closed: true }),
    ];
    await show(snapshot(orders));
    fireEvent.click(screen.getByRole('button', { name: '销售订单' }));
    const matrix = screen.getByRole('region', { name: '工单工序进度矩阵' });
    const firstPage = within(matrix).getAllByRole('article');
    expect(firstPage[0].textContent).toContain('SO-A · 第 2 行');
    expect(firstPage[0].textContent).toContain('A2-A · 第 1 行');
    expect(firstPage[1].textContent).toContain('A2-Z · 第 1 行');
    expect(firstPage[2].textContent).toContain('SO-A · 第 10 行');
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(within(matrix).getByText('SO-A · 行号待核对')).toBeTruthy();
    expect(within(matrix).getByText('未关联销售单')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '导出 Excel' }));
    });
    const [exported, salesMode] = jest.mocked(exportDashboardExcel).mock.calls[0];
    expect(salesMode).toBe(true);
    expect(exported.map((row) => row.mo_code)).toEqual(['A2-A', 'A2-Z', 'A10', 'A-UNKNOWN', 'B1', 'NO-SALE']);
  });

  it('exports all pages and follows the closed-order switch', async () => {
    const orders = Array.from({ length: 8 }, (_, index) =>
      order({ mo_code: `EXPORT-${index}`, is_closed: index === 7 }),
    );
    await show(snapshot(orders));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '导出 Excel' }));
    });
    expect(jest.mocked(exportDashboardExcel).mock.calls[0][0]).toHaveLength(7);
    fireEvent.click(screen.getByRole('switch', { name: '显示已关闭' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '导出 Excel' }));
    });
    expect(jest.mocked(exportDashboardExcel).mock.calls[1][0]).toHaveLength(8);
  });
  it('shows customer, order, product, plan quantity, start date, due date and process status', async () => {
    await show();
    expect(screen.getByRole('heading', { name: '生产现场看板' })).toBeTruthy();
    const matrix = screen.getByRole('region', { name: '工单工序进度矩阵' });
    expect(matrix.textContent).toContain('南京艾尔其装饰材料有限公司');
    expect(matrix.textContent).toContain('SCDD-001 · 第 1 行');
    expect(matrix.textContent).toContain('测试木皮');
    expect(matrix.textContent).toContain('3402-TEST-001');
    expect(matrix.textContent).toContain('1220*2440*18');
    expect(matrix.textContent).toContain('计划数量');
    expect(matrix.textContent).toContain('计划开工');
    expect(matrix.textContent).toContain('计划完工');
    expect(matrix.textContent).toContain('20');
    expect(matrix.textContent).toContain('09-01');
    expect(matrix.textContent).toContain('09-07');
    expect(matrix.textContent).toContain('工序1');
    expect(matrix.textContent).toContain('拼接');
    expect(matrix.textContent).toContain('生产中');
    expect(matrix.textContent).toContain('10/20张');
    expect(matrix.querySelector('[data-state="work"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: '当前看板' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '工序进度' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '上一页' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: '下一页' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('main')
        .querySelector('details, input, select, textarea, nav'),
    ).toBeNull();
  });

  it('hides process scheduling from users other than admin', async () => {
    getCurrentUser.mockResolvedValueOnce({
      data: { username: 'viewer' },
    } as any);
    await show();
    expect(screen.queryByRole('button', { name: '工序进度' })).toBeNull();
    expect(screen.getByRole('button', { name: '当前看板' })).toBeTruthy();
  });

  it('shows the earliest planned dates only when they differ from current dates', async () => {
    await show(
      snapshot([
        order({
          original_start_date: '2026-08-30',
          original_due_date: '2026-09-05',
        }),
      ]),
    );
    const matrix = screen.getByRole('region', { name: '工单工序进度矩阵' });
    expect(matrix.textContent).toContain('原 08-30');
    expect(matrix.textContent).toContain('原 09-05');
  });

  it('opens process details when a process card is clicked', async () => {
    await show();
    fireEvent.click(screen.getByRole('button', { name: '查看拼接详情' }));
    const dialog = screen.getByRole('dialog', { name: '工序详情' });
    expect(dialog.textContent).toContain('SCDD-001 · 第 1 行');
    expect(dialog.textContent).toContain('拼接一站');
    expect(dialog.textContent).toContain('累计接收20');
    const grades = within(dialog).getByLabelText('完工等级数量');
    expect(grades.textContent).toContain('合计10');
    expect(grades.textContent).toContain('A7');
    expect(grades.textContent).toContain('A11');
    expect(grades.textContent).toContain('A21');
    expect(grades.textContent).toContain('C1');
    expect(dialog.textContent).toContain('开工人员开工甲');
    fireEvent.click(screen.getByRole('button', { name: '关闭工序详情' }));
    expect(screen.queryByRole('dialog', { name: '工序详情' })).toBeNull();
  });

  it('shows the real BOM conversion formula when hovering receivable quantity', async () => {
    await show(
      snapshot([
        order({
          plan_qty: 400,
          steps: [
            step({
              is_first_step: true,
              first_issued_qty: 320,
              normal_received_qty: 20,
              receive_available_qty: 300,
              first_issue_calculation: {
                mode: 'bom_ratio',
                material_count: 3,
                bottleneck_inv_code: '4402-TEST',
                bottleneck_required_qty: 100,
                bottleneck_issued_qty: 80,
                bottleneck_ratio: 0.8,
              },
            }),
          ],
        }),
      ]),
    );
    fireEvent.click(screen.getByRole('button', { name: '查看拼接详情' }));
    fireEvent.mouseEnter(screen.getByLabelText('查看可接收数量计算'));
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    expect(screen.getByText('可接收数量计算')).toBeTruthy();
    expect(
      screen.getByText(/计划 400 × 最低领料比例 80% = 折算领料 320/),
    ).toBeTruthy();
    expect(screen.getByText(/可接收 = 320 − 已接收 20 = 300/)).toBeTruthy();
    expect(screen.getByText(/最低比例物料：4402-TEST/)).toBeTruthy();
    expect(screen.getByText(/已领 80 ÷ 应领 100/)).toBeTruthy();
  });

  it('explains panel first-station receipt using the fixed square meters per sheet', async () => {
    await show(snapshot([order({ plan_qty: 150, steps: [step({
      is_first_step: true,
      first_issued_qty: 158.7255,
      normal_received_qty: 30,
      receive_available_qty: 128.7255,
      first_issue_calculation: { mode: 'panel_area', issued_area: 872.99, square_meters_per_sheet: 5.5 },
    })] })]));
    fireEvent.click(screen.getByRole('button', { name: '查看拼接详情' }));
    fireEvent.mouseEnter(screen.getByLabelText('查看可接收数量计算'));
    await act(async () => { jest.runOnlyPendingTimers(); });
    expect(screen.getByText(/实领 872\.99 ㎡ ÷ 5\.5 ㎡\/张 = 158\.7255 张/)).toBeTruthy();
    expect(screen.getByText(/减已接收 30 张，可接收 128\.7255 张/)).toBeTruthy();
  });

  it('shows the first start and last completion time below each started process', async () => {
    await show(
      snapshot([
        order({
          steps: [
            step({
              normal_remaining_qty: 0,
              first_start_time: '2026-09-06 08:15:00',
              last_end_time: '2026-09-06 14:30:00',
            }),
            step({
              seq: 2,
              process_name: '修边',
              first_start_time: '2026-09-07 09:20:00',
            }),
            step({
              seq: 3,
              process_name: '拉丝',
              normal_remaining_qty: 0,
              first_start_time: '2026-09-06 16:20:00',
              last_end_time: '2026-09-07 08:10:00',
            }),
          ],
        }),
      ]),
    );
    const matrix = screen.getByRole('region', { name: '工单工序进度矩阵' });
    expect(matrix.textContent).toContain('09-06 08:15 → 14:30');
    expect(matrix.textContent).toContain('09-07 09:20 → 进行中');
    expect(matrix.textContent).toContain('始 09-06 16:20');
    expect(matrix.textContent).toContain('终 09-07 08:10');
  });

  it('switches between dark and light themes and remembers the choice', async () => {
    await show();
    fireEvent.click(screen.getByRole('button', { name: '切换到浅色主题' }));
    expect(screen.getByRole('button', { name: '切换到深色主题' })).toBeTruthy();
    expect(window.localStorage.getItem('production-dashboard-theme')).toBe(
      'light',
    );
  });

  it('hides closed work orders by default and shows them from the switch', async () => {
    await show(
      snapshot([
        order(),
        order({
          mo_code: 'SCDD-CLOSED',
          customer_name: '已关闭客户',
          is_closed: true,
        }),
      ]),
    );
    expect(screen.queryByText('已关闭客户')).toBeNull();
    const toggle = screen.getByRole('switch', { name: '显示已关闭' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByText('已关闭客户')).toBeTruthy();
    expect(screen.getByText('已关闭')).toBeTruthy();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('labels work orders that were deleted from ERP', async () => {
    await show(
      snapshot([
        order({
          mo_code: 'SCDD26103058',
          sort_seq: 3,
          erp_deleted: true,
          inv_code: '',
          inv_name: '',
        }),
      ]),
    );
    expect(screen.getByText('系统已删除')).toBeTruthy();
    expect(screen.getByText('工单资料已删除')).toBeTruthy();
    expect(screen.queryByText('产品待补')).toBeNull();
  });

  it('uses business colors for completed, waiting, rework, pending and non-route cells', async () => {
    await show(
      snapshot([
        order({
          steps: [
            step({ seq: 1, process_name: '已完', normal_remaining_qty: 0 }),
            step({
              seq: 2,
              process_name: '待接',
              normal_remaining_qty: 0,
              receive_available_qty: 5,
            }),
            step({
              seq: 3,
              process_name: '返工',
              rework_remaining_qty: 2,
            }),
            step({
              seq: 4,
              process_name: '未开始',
              normal_received_qty: 0,
              normal_done_qty: 0,
              normal_remaining_qty: 0,
            }),
          ],
        }),
        order({
          mo_code: 'SCDD-002',
          customer_name: '第二客户',
          steps: [step({ process_name: '已完', normal_remaining_qty: 0 })],
        }),
      ]),
    );
    const matrix = screen.getByRole('region', { name: '工单工序进度矩阵' });
    for (const state of ['done', 'ready', 'rework', 'pending'])
      expect(matrix.querySelector(`[data-state="${state}"]`)).toBeTruthy();
    expect(matrix.textContent).toContain('返工待完');
    expect(matrix.textContent).toContain('待接收');
    expect(matrix.textContent).toContain('未开始');
  });

  it('shows current KPI counts and customer fallback text', async () => {
    await show(
      snapshot([
        order(),
        order({
          mo_code: 'SCDD-002',
          customer_name: '',
          is_overdue: true,
          plan_due_date: '2026-09-06',
          steps: [step({ rework_remaining_qty: 2 })],
        }),
      ]),
    );
    const kpis = screen.getByRole('region', { name: '生产概况' });
    expect(kpis.textContent).toContain('在制工单2项');
    expect(kpis.textContent).toContain('今日计划完工1项');
    expect(kpis.textContent).toContain('逾期工单1项');
    expect(kpis.textContent).toContain('返工待完1项');
    expect(screen.getByText('未关联客户')).toBeTruthy();
  });

  it('shows closed orders on request and excludes them from all headline counts', async () => {
    await show(
      snapshot([
        order({ is_overdue: true, plan_due_date: '2026-09-06' }),
        order({
          mo_code: 'CLOSED-OVERDUE',
          is_closed: true,
          is_overdue: true,
          has_reporting: false,
          plan_due_date: '2026-09-06',
        }),
        order({
          mo_code: 'CLOSED-DUE-TODAY',
          is_closed: true,
          steps: [step({ rework_remaining_qty: 2 })],
        }),
      ]),
    );
    const kpis = screen.getByRole('region', { name: '生产概况' });
    const matrix = screen.getByRole('region', { name: '工单工序进度矩阵' });
    const initialCounts = kpis.textContent;
    expect(initialCounts).toContain('在制工单1项');
    expect(initialCounts).toContain('今日计划完工0项');
    expect(initialCounts).toContain('逾期工单1项');
    expect(initialCounts).toContain('返工待完0项');
    expect(within(matrix).queryByRole('article', { name: /CLOSED-OVERDUE/ })).toBeNull();

    fireEvent.click(screen.getByRole('switch', { name: '显示已关闭' }));

    const closed = within(matrix).getByRole('article', { name: /CLOSED-OVERDUE/ });
    expect(within(closed).getByText('已关闭')).toBeTruthy();
    expect(within(closed).queryByText('逾期')).toBeNull();
    expect(within(closed).queryByText('未报工')).toBeNull();
    expect(kpis.textContent).toBe(initialCounts);
  });

  it('keeps normal pending quantity visible together with rework', async () => {
    await show(
      snapshot([
        order({
          steps: [
            step({
              rework_remaining_qty: 3,
              normal_remaining_qty: 10,
            }),
          ],
        }),
      ]),
    );
    const matrix = screen.getByRole('region', { name: '工单工序进度矩阵' });
    expect(matrix.textContent).toContain('返工待完');
    expect(matrix.textContent).toContain('3张');
    expect(matrix.textContent).toContain('正常待完 10');
  });

  it('highlights process anomalies and explains them in process details', async () => {
    await show(
      snapshot([
        order({
          steps: [
            step({
              normal_received_qty: 10,
              normal_done_qty: 10,
              normal_remaining_qty: 0,
              transferable_qty: 10,
            }),
          ],
        }),
      ]),
    );
    const anomaly = screen.getByRole('button', { name: '查看拼接详情' });
    expect(anomaly.getAttribute('data-anomaly')).toBe('true');
    expect(anomaly.textContent).toContain('异常');
    fireEvent.click(anomaly);
    expect(
      screen.getByRole('dialog', { name: '工序详情' }).textContent,
    ).toContain('完工数量不足：累计10，计划20');
  });

  it('does not show historical records without quantified current work', async () => {
    await show(
      snapshot([
        order({
          is_overdue: true,
          steps: [
            step({
              normal_received_qty: null,
              normal_remaining_qty: null,
              receive_available_qty: null,
            }),
          ],
        }),
      ]),
    );
    expect(screen.getByText('当前没有在制工单')).toBeTruthy();
    expect(screen.queryByText('南京艾尔其装饰材料有限公司')).toBeNull();
  });

  it('shows the maximum route length and pages order rows only when requested', async () => {
    const manySteps = Array.from({ length: 5 }, (_, index) =>
      step({ seq: index + 1, process_name: `工序${index + 1}` }),
    );
    await show(
      snapshot([
        order({ steps: manySteps }),
        ...Array.from({ length: 5 }, (_, index) =>
          order({
            mo_code: `ORDER-${index + 2}`,
            customer_name: `客户${index + 2}`,
            steps: manySteps,
          }),
        ),
      ]),
    );
    const matrix = screen.getByRole('region', { name: '工单工序进度矩阵' });
    expect(matrix.textContent).toContain('工序1');
    expect(matrix.textContent).toContain('工序5');
    expect(matrix.textContent).not.toContain('工序6');
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    expect(matrix.textContent).toContain('客户2');
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(matrix.textContent).toContain('客户6');
    expect(matrix.textContent).not.toContain('客户2');
    fireEvent.click(screen.getByRole('button', { name: '上一页' }));
    expect(matrix.textContent).toContain('工序5');
    expect(getOperations).toHaveBeenCalledTimes(1);
  });

  it('uses a return button instead of a hidden clock shortcut', async () => {
    await show();
    expect(screen.queryByRole('button', { name: '当前时间' })).toBeNull();
    expect(screen.getByLabelText('当前时间')).toBeTruthy();
    expect(screen.getByRole('button', { name: '返回' })).toBeTruthy();
  });

  it('returns anonymous viewers to login and signed-in users to an operation page', async () => {
    getCurrentUser.mockRejectedValue(new Error('not signed in'));
    await show();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '返回' }));
    });
    expect(navigate).toHaveBeenLastCalledWith('/user/login?redirect=%2Fadmin');

    cleanup();
    getCurrentUser.mockReset();
    getCurrentUser.mockResolvedValue({
      data: { permissions: ['dashboard.view', 'workorder.view'] },
    } as any);
    await show();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '返回' }));
    });
    expect(navigate).toHaveBeenLastCalledWith('/mo/workorder');
  });

  it('retains the last snapshot after refresh failure and recovers later', async () => {
    await show();
    getOperations.mockRejectedValueOnce(new Error('network unavailable'));
    await act(async () => {
      jest.advanceTimersByTime(120000);
    });
    expect(screen.getByText('数据刷新失败，正在重试')).toBeTruthy();
    expect(screen.getByText('南京艾尔其装饰材料有限公司')).toBeTruthy();

    getOperations.mockResolvedValueOnce({
      code: 0,
      data: snapshot([order({ customer_name: '更新后的客户' })]),
    });
    await act(async () => {
      jest.advanceTimersByTime(120000);
    });
    expect(screen.getByText('更新后的客户')).toBeTruthy();
    expect(screen.queryByText('数据刷新失败，正在重试')).toBeNull();
  });

  it('keeps only concise status text in the footer', async () => {
    await show();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText('已完成')).toBeTruthy();
    expect(within(footer).getByText('生产中')).toBeTruthy();
    expect(within(footer).getByText('等待处理')).toBeTruthy();
    expect(within(footer).getByText('返工')).toBeTruthy();
    expect(screen.getByRole('main').textContent).not.toMatch(
      /数据已连接|自动轮播|全部生产部门/,
    );
  });
});
