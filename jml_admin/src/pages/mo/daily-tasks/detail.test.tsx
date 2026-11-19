import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useAccess, useModel } from '@umijs/max';
import { App } from 'antd';
import React from 'react';
import * as candidateFilter from './candidateFilter';
import DailyTaskDetail from './detail';
import { draftKey, editDraft } from './draft';
import NonorderPublish from './NonorderPublish';
import { PERSON_DRAG } from './NonorderSchedule';
import { planEdit } from './nonorderDraft';
import { getNonorderPublishOptions, getNonorderPublishPeople, getSheetWorkPeople } from './nonorderService';
import { exportTasks, getPrintTasks, getTasks, saveTask } from './service';
import { createSheetDraft } from './sheetDraft';

jest.mock('@umijs/max', () => ({ useAccess: jest.fn(), useModel: jest.fn() }));
jest.mock('./candidateFilter', () => ({
  ...jest.requireActual('./candidateFilter'),
  businessToday: jest.fn(),
}));
jest.mock('./service', () => ({
  getTasks: jest.fn(),
  getPrintTasks: jest.fn(),
  saveTask: jest.fn(),
  exportTasks: jest.fn(),
}));
jest.mock('./nonorderService', () => ({
  ...jest.requireActual('./nonorderService'),
  getNonorderPublishOptions: jest.fn(),
  getNonorderPublishPeople: jest.fn(),
  getSheetWorkPeople: jest.fn(),
}));

const source: import('./service').Candidate = {
  mo_code: 'MO1',
  sort_seq: 1,
  route_id: 1,
  seq: 1,
  kind: 'normal',
  process_name: '水性',
  dept_name: '生产',
  unit_name: '面',
  allowed_station_ids: [7],
  received_remaining: 0,
  receivable: 10,
  ready: 10,
  maximum: 10,
  waiting: 0,
  reserved: 0,
  unassigned: 10,
  reservations: [],
  waiting_reason: 'material',
};
const data: import('./service').DailyData = {
  date: '2099-11-12',
  generated_at: '2099-11-11 12:00:00',
  headers: [],
  target_headers: [],
  stations: [
    { id: 7, station_name: '一号工站', is_active: 1 },
    { id: 8, station_name: '二号工站', is_active: 1 },
  ],
  items: [],
  candidates: [source],
  unplanned: [],
  changes: [],
  warnings: [],
};
const sheet: import('./service').TaskSheet = {
  id: 1,
  work_date: data.date,
  status: 'draft',
  created_by: 'PMC',
  created_at: '',
};
const computedStyle = window.getComputedStyle;
const todaySpy = jest.mocked(candidateFilter.businessToday);
let intervalSpy: jest.SpyInstance;
beforeAll(() => {
  Object.assign(globalThis, { React });
  jest
    .spyOn(window, 'getComputedStyle')
    .mockImplementation((element) => computedStyle(element));
});
afterAll(() => jest.mocked(window.getComputedStyle).mockRestore());
beforeEach(() => {
  jest.clearAllMocks();
  intervalSpy = jest.spyOn(window, 'setInterval');
  todaySpy.mockReturnValue('2026-11-11');
  localStorage.clear();
  (useAccess as jest.Mock).mockReturnValue({ can: () => true });
  (useModel as jest.Mock).mockReturnValue({
    initialState: { currentUser: { adminAccountId: 1 } },
  });
  jest.mocked(getTasks).mockResolvedValue(data);
});
afterEach(cleanup);
afterEach(() => intervalSpy.mockRestore());

async function refreshTick() {
  const timer = [...intervalSpy.mock.calls]
    .reverse()
    .find((call) => call[1] === 30000);
  if (!timer) throw new Error('missing automatic refresh');
  await act(async () => {
    (timer[0] as () => void)();
  });
}

test('reopened nonorder draft lets the planner clear the station and change performers', async () => {
  jest.mocked(getNonorderPublishOptions).mockResolvedValue({
    responsibles: [{ id: 'leader', name: '负责人甲' }],
    categories: { inventory: '盘点' },
  });
  jest.mocked(getNonorderPublishPeople).mockResolvedValue({
    stations: [{ id: 7, name: '一号工站' }],
    default_station_id: 7,
    scanners: [{ id: 'a', name: '员工甲' }, { id: 'b', name: '员工乙' }],
    reviewers: [],
  });
  const onAdd = jest.fn();
  render(<App><NonorderPublish day={data.date} onClose={jest.fn()} onAdd={onAdd} initial={{
    request_id: 'edit-local-work', responsible_name: '负责人甲',
    task: {
      responsible_staff_id: 'leader', content: '盘点任务', category_code: 'inventory',
      acceptance_standard: '核对存量', planned_date: data.date,
      divisions: [{
        content: '库区盘点', work_item: '库存物料盘点', scope: 'A区', objective: '核对数量',
        category_code: 'inventory', acceptance_standard: '结果登记', planned_date: data.date,
        station_id: 7, members: [{ staff_id: 'a', staff_name: '员工甲', responsibility: '' }],
      }],
    },
  }} /></App>);
  const station = await screen.findByRole('combobox', { name: '关联工站' });
  await waitFor(() => expect((station as HTMLInputElement).disabled).toBe(false));
  fireEvent.mouseDown(station);
  fireEvent.click(await screen.findByText('不关联工站'));
  const people = screen.getByRole('combobox', { name: '执行人员' });
  fireEvent.mouseDown(people);
  fireEvent.click(await screen.findByText('员工甲', { selector: '.ant-select-item-option-content' }));
  fireEvent.click(await screen.findByText('员工乙'));
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await waitFor(() => expect(onAdd).toHaveBeenCalled());
  const [saved] = onAdd.mock.calls[0];
  expect(saved.task.divisions[0].station_id).toBeNull();
  expect(saved.task.divisions[0].members.map((person: { staff_id: string }) => person.staff_id)).toEqual(['b']);
});

async function selectTaskType(label: string) {
  fireEvent.mouseDown(screen.getByLabelText('任务类型'));
  fireEvent.click(await screen.findByText(label, {
    selector: '.ant-select-item-option-content',
  }));
}

test('supplement exports by date and allows creation from all tasks', async () => {
  const supplement = { ...sheet, id: 9, sheet_kind: 'supplement' as const };
  jest.mocked(getTasks).mockResolvedValue({
    ...data,
    sheet: supplement,
    supports_day_export: true,
    nonorder: { items: [], history: [], candidates: [], supports_sheet_creation: true },
  });
  jest.mocked(exportTasks).mockResolvedValue(undefined);
  render(<App><DailyTaskDetail sheet={supplement} onBack={jest.fn()} /></App>);
  await screen.findByRole('heading', { name: '待安排工单' });
  expect(screen.getByRole('button', { name: '新增无工单安排' })).toBeTruthy();
  await selectTaskType('无工单任务');
  const pool = within(screen.getByRole('complementary'));
  expect(pool.getByRole('heading', { name: '待安排无工单' })).toBeTruthy();
  expect(pool.queryByRole('button', { name: '新增无工单安排' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '导出 Excel' }));
  expect(exportTasks).toHaveBeenCalledWith(supplement.work_date);
});

test('empty supplement can print saved tasks for the whole execution date', async () => {
  const supplement = { ...sheet, id: 9, sheet_kind: 'supplement' as const };
  jest.mocked(getTasks).mockResolvedValue({ ...data, sheet: supplement, supports_day_print: true });
  jest.mocked(getPrintTasks).mockResolvedValue({
    title: '当日任务安排',
    headers: ['生产线名称', '开线状态', '计划数量', '备注', '工单号', '派单类型'],
    rows: [{ values: ['工站一', '未开工', 3, '', 'MO1', '任务派单\n主单'], station_span: 1, unit: '面', status_color: '666666' }],
  });
  const popupDocument = document.implementation.createHTMLDocument();
  const open = jest.spyOn(window, 'open').mockReturnValue({ document: popupDocument } as unknown as Window);
  try {
    render(<App><DailyTaskDetail sheet={supplement} onBack={jest.fn()} /></App>);
    const button = await screen.findByRole('button', { name: '打印任务单' });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(popupDocument.querySelector('tbody')?.textContent).toContain('MO1'));
    expect(getPrintTasks).toHaveBeenCalledWith(supplement.work_date);
  } finally {
    open.mockRestore();
  }
});

test('new nonorder task is staged on this sheet and shares the publish confirmation', async () => {
  const server = { ...data, sheet, nonorder: { items: [], candidates: [], history: [], supports_sheet_creation: true } };
  const draft = createSheetDraft(server, 'account:1');
  const creation = {
    request_id: 'draft-task-1', responsible_name: '张线长',
    task: {
      responsible_staff_id: 'leader', content: '本周仓库盘点', category_code: 'inventory',
      acceptance_standard: '账物一致', planned_date: sheet.work_date,
      divisions: [{
        content: '库存物料盘点 · A区', planned_date: sheet.work_date,
        station_id: null, members: [{ staff_id: 'a', staff_name: '李甲', responsibility: 'A区' }],
      }],
    },
  };
  draft.nonorderCreations = [creation];
  localStorage.setItem(draftKey('account:1', data.date, draft.dept), JSON.stringify(draft));
  jest.mocked(getTasks).mockResolvedValue(server);
  jest.mocked(saveTask).mockResolvedValue(server);
  render(<App><DailyTaskDetail sheet={sheet} onBack={jest.fn()} /></App>);
  expect(await screen.findByText('无工站 · 张线长')).toBeTruthy();
  const stagedCard = screen.getByText('库存物料盘点 · A区').closest('article');
  expect(stagedCard?.textContent).toContain('无工单');
  expect(stagedCard?.textContent).toContain('李甲 · A区');
  expect(saveTask).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '保存并发布' }));
  fireEvent.click(await screen.findByRole('button', { name: '确认保存并发布' }));
  await waitFor(() => expect(saveTask).toHaveBeenCalledWith(expect.objectContaining({
    sheet_id: sheet.id, date: sheet.work_date,
    nonorder_only: true, nonorder_publish: true,
    nonorder_creations: [{ request_id: creation.request_id, task: creation.task }],
  })));
});

test('published cards use live edit permissions with a restored draft', async () => {
  type NonorderPlan = import('./nonorderService').NonorderPlan;
  const items: NonorderPlan[] = [
    { label: '工位清扫', status: 'unreceived', name: '李甲', canEdit: true },
    { label: '设备清洁', status: 'done', name: '李乙', canEdit: false },
  ].map<NonorderPlan>(({ label, status, name, canEdit }, index) => ({
    id: index + 1, key: `nonorder:plan:${index + 1}`, sheet_id: sheet.id,
    work_date: sheet.work_date, revision: 2, sort_order: index + 1, remark: '',
    status: 'published', can_plan: true, can_edit_work: canEdit, can_publish: true,
    can_replan: false, station_changed: false, created_at: '',
    task: {
      id: index + 4, task_no: 'NW01', content: '巡查', status: 'active', revision: 3,
      creator_name: '张线长', responsible_name: '张线长', responsible_staff_id: 'leader',
      acceptance_standard: '保持整洁',
    },
    division: {
      id: index + 8, content: label, station_id: 7, station_name: '一号工站',
      planned_date: null, due_at: null, acceptance_standard: '保持整洁',
    },
    assignment: {
      id: index + 30, division_id: index + 8, revision: 2, staff_id: name,
      staff_name: name, responsibility: label, status, revoked_at: null,
      requirement_snapshot: {},
    },
    group: { type: 'station', id: 7, name: '一号工站' },
  }));
  const reply = { ...data, sheet, nonorder: { items, candidates: [], history: [] } };
  const draft = createSheetDraft(reply, 'account:1');
  draft.nonorder = [
    planEdit({ ...items[0], can_edit_work: undefined }),
    planEdit({ ...items[1], can_edit_work: true }),
  ];
  localStorage.setItem(draftKey('account:1', data.date, draft.dept), JSON.stringify(draft));
  jest.mocked(getTasks).mockResolvedValue(reply);
  jest.mocked(getSheetWorkPeople).mockResolvedValue([{ id: '李甲', name: '李甲' }]);
  render(<App><DailyTaskDetail sheet={sheet} onBack={jest.fn()} /></App>);

  const completed = (await screen.findByText('李乙 · 设备清洁')).closest('article');
  const editable = screen.getByText('李甲 · 工位清扫').closest('article');
  if (!completed || !editable) throw new Error('missing nonorder cards');
  expect(within(completed).queryByRole('button', { name: /修\s*改/ })).toBeNull();
  expect(within(completed).getByText('已完成核对')).toBeTruthy();
  fireEvent.doubleClick(completed);
  expect(await screen.findByText('该人员已完成核对，原记录已保留')).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.doubleClick(editable);
  expect(within(await screen.findByRole('dialog')).getByText('修改无工单安排')).toBeTruthy();
  expect(getSheetWorkPeople).toHaveBeenCalledWith(items[0].assignment.id);
});

test('PMC filters the pool, stages both task types in the same station and publishes together', async () => {
  const task = {
    id: 3, task_no: 'NW01', revision: 4, status: 'active', content: '车间巡查',
    responsible_name: '张线长', creator_name: '张线长', responsible_staff_id: 'leader',
    acceptance_standard: '通道清空',
  };
  const division = {
    id: 8, content: '公共区域清扫\n清理地面', station_id: 7, station_name: '一号工站',
    planned_date: null, due_at: null, acceptance_standard: '无码放杂物',
  };
  const candidates = ['李甲', '李乙'].map((name, i) => ({
    key: `nonorder:${i + 1}`, task, division, can_plan: true, can_edit_work: true, occupied: false, arranged_dates: [], started: false,
    group: { type: 'station' as const, id: 7, name: '一号工站' },
    assignment: { id: i + 1, division_id: 8, revision: 2, staff_id: name, staff_name: name,
      responsibility: `${i + 1}区`, status: 'unreceived', revoked_at: null, requirement_snapshot: {},
    },
  }));
  const reply = { ...data, nonorder: { items: [], candidates, history: [] } };
  jest.mocked(getTasks).mockResolvedValue(reply);
  jest.mocked(saveTask).mockResolvedValue(reply);
  render(<App><DailyTaskDetail sheet={sheet} onBack={jest.fn()} /></App>);
  await expandOnsite();
  expect(within(screen.getByRole('complementary')).queryByText('车间巡查')).toBeNull();
  fireEvent.click(await screen.findByRole('button', { name: '安排到工站' }));
  await selectTaskType('无工单任务');
  fireEvent.click(await screen.findByRole('checkbox', { name: '李甲' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '李乙' }));
  const draggable = screen.getByRole('checkbox', { name: '李甲' }).closest('[draggable=true]');
  if (!draggable) throw new Error('人员卡片不可拖拽');
  const values = new Map<string, string>();
  const dataTransfer = { types: [PERSON_DRAG], setData: (key: string, value: string) => values.set(key, value),
    getData: (key: string) => values.get(key),
  };
  fireEvent.dragStart(draggable, { dataTransfer });
  fireEvent.drop(screen.getByText('拖入待安排人员'), { dataTransfer });
  await selectTaskType('全部任务');
  const station = within(screen.getByRole('region', { name: '一号工站任务' }));
  expect(station.getByText(/1\. MO1/)).toBeTruthy();
  expect(station.getByText('李甲 · 1区')).toBeTruthy();
  expect(station.getByText('李乙 · 2区')).toBeTruthy();
  expect(station.getAllByText('无工单')).toHaveLength(2);
  expect(station.getAllByText('公共区域清扫')).toHaveLength(2);
  expect(within(screen.getByRole('complementary')).queryByText('车间巡查')).toBeNull();
  const workCard = station.getByText('李甲 · 1区').closest('article');
  if (!workCard) throw new Error('missing nonorder card');
  expect(within(workCard).getByRole('button', { name: /修\s*改/ })).toBeTruthy();
  for (const label of ['备注', '改期', '追加日期']) {
    expect(within(workCard).queryByRole('button', { name: label })).toBeNull();
  }
  jest.mocked(getSheetWorkPeople).mockResolvedValue([{ id: '李甲', name: '李甲' }]);
  fireEvent.doubleClick(workCard);
  const workEditor = await screen.findByRole('dialog');
  expect(within(workEditor).getByText('修改无工单安排')).toBeTruthy();
  fireEvent.change(within(workEditor).getByLabelText('个人职责'), { target: { value: '清理门口' } });
  const stage = within(workEditor).getByRole('button', { name: '暂存修改' });
  await waitFor(() => expect((stage as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(stage);
  expect(await station.findByText('李甲 · 清理门口')).toBeTruthy();
  expect(saveTask).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '保存并发布' }));
  fireEvent.click(await screen.findByRole('button', { name: '确认保存并发布' }));
  await waitFor(() => expect(saveTask).toHaveBeenCalledWith(expect.objectContaining({
    batches: expect.arrayContaining([expect.objectContaining({ dept_name: '生产' })]),
    nonorder_changes: [
      expect.objectContaining({ assignment_id: 1, publish: true,
        work_edit: expect.objectContaining({ staff_id: '李甲', responsibility: '清理门口' }) }),
      expect.objectContaining({ assignment_id: 2, publish: true }),
    ],
  })));
});

test.each([
  { reason: 'upstream' as const, expected: '10面等水性完工' },
  { reason: undefined, expected: '10面原因待核对' },
])('waiting card and details explain $expected without guessing', async ({
  reason,
  expected,
}) => {
  jest.mocked(getTasks).mockResolvedValue({
    ...data,
    candidates: [
      {
        ...source,
        ready: 0,
        receivable: 0,
        waiting: 10,
        plan_start_date: '2026-11-11',
        waiting_reason: reason,
        waiting_process_name: '水性',
      },
    ],
  });
  render(
    <App>
      <DailyTaskDetail sheet={sheet} onBack={jest.fn()} />
    </App>,
  );
  const card = await screen.findByRole('article', { name: 'MO1第1行待安排' });
  expect(card.textContent).toContain(expected);
  fireEvent.mouseEnter(card);
  const popup = await screen.findByRole('region', { name: '任务详情浮窗' });
  expect(popup.textContent).toContain(expected);
  expect(card.textContent).not.toContain('暂不能做');
});

test('last process is labelled before and after arranging without inventing later tasks', async () => {
  jest.mocked(getTasks).mockResolvedValue({
    ...data,
    candidates: [{ ...source, is_last_step: true }],
  });
  render(
    <App>
      <DailyTaskDetail sheet={sheet} onBack={jest.fn()} />
    </App>,
  );
  await expandOnsite();
  const candidate = screen.getByRole('article', { name: 'MO1第1行待安排' });
  expect(within(candidate).getByText('末工序')).toBeTruthy();
  expect(within(candidate).getByText('无后续工序')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'MO1第1行后续工序' })).toBeNull();
  fireEvent.click(await screen.findByRole('button', { name: '安排到工站' }));
  const task = (await screen.findByText(/1\. MO1/)).closest('article');
  if (!task) throw new Error('missing arranged task');
  expect(within(task).getByText('末工序')).toBeTruthy();
  fireEvent.mouseEnter(task);
  await screen.findByRole('button', { name: /编\s*辑/ });
  expect(screen.queryByRole('button', { name: /结\s*转/ })).toBeNull();
  expect(
    screen.getByRole('region', { name: '任务详情浮窗' }).textContent,
  ).toContain('当前已接收待做');
  expect(saveTask).not.toHaveBeenCalled();
});

test('one-click stages current and later steps, save review can be cancelled and includes all pending tasks', async () => {
  const server = {
    ...data,
    candidates: [
      source,
      {
        ...source,
        seq: 2,
        process_name: '修边',
        allowed_station_ids: [8],
        ready: 0,
        receivable: 0,
        waiting: 10,
      },
    ],
  };
  jest.mocked(getTasks).mockResolvedValue(server);
  render(
    <App>
      <DailyTaskDetail sheet={sheet} onBack={jest.fn()} />
    </App>,
  );
  await expandOnsite();
  fireEvent.click(await screen.findByRole('button', { name: '一键安排' }));
  const key =
    'jml.daily-tasks.v1:["account:1","2099-11-12","__all_departments__"]';
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem(key) || '{}').items).toHaveLength(2),
  );
  const stored = localStorage.getItem(key);
  expect(
    JSON.parse(stored || '{}').items.map(
      (row: { seq: number; station_id: number }) => [row.seq, row.station_id],
    ),
  ).toEqual([
    [1, 7],
    [2, 8],
  ]);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(saveTask).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '保存到服务器' }));
  let review = await screen.findByRole('dialog');
  expect(review.textContent).toContain('新增 2 条');
  expect(review.textContent).toContain('1. 水性');
  expect(review.textContent).toContain('2. 修边');
  expect(review.textContent).toContain('此前暂存');
  fireEvent.click(within(review).getByRole('button', { name: '返回修改' }));
  expect(localStorage.getItem(key)).toBe(stored);
  expect(saveTask).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '保存到服务器' }));
  review = await screen.findByRole('dialog');
  jest.mocked(saveTask).mockRejectedValueOnce(new Error('模拟保存失败'));
  fireEvent.click(within(review).getByRole('button', { name: '确认保存' }));
  await within(review).findByText('模拟保存失败');
  expect(localStorage.getItem(key)).toBe(stored);
  expect(saveTask).toHaveBeenCalledTimes(1);
  expect(jest.mocked(saveTask).mock.calls[0][0]).toMatchObject({
    action: 'batch_sheet',
    batches: [
      {
        items: [
          { seq: 1, station_id: 7 },
          { seq: 2, station_id: 8 },
        ],
      },
    ],
  });
});

test('save review refuses a changed browser draft instead of submitting unseen work', async () => {
  render(
    <App>
      <DailyTaskDetail sheet={sheet} onBack={jest.fn()} />
    </App>,
  );
  await expandOnsite();
  fireEvent.click(await screen.findByRole('button', { name: '安排到工站' }));
  fireEvent.click(screen.getByRole('button', { name: '保存到服务器' }));
  const review = await screen.findByRole('dialog');
  const key =
    'jml.daily-tasks.v1:["account:1","2099-11-12","__all_departments__"]';
  const changed = JSON.parse(localStorage.getItem(key) || '{}');
  changed.stamp = 'different-tab';
  changed.items[0].quantity = 2;
  localStorage.setItem(key, JSON.stringify(changed));
  fireEvent.click(within(review).getByRole('button', { name: '确认保存' }));
  await within(review).findByText(
    '另一标签页更新了草稿，请重新打开页面核对后继续',
  );
  expect(saveTask).not.toHaveBeenCalled();
});

test('one-click waits for ambiguous station selection and publishes only after reviewing', async () => {
  const server = {
    ...data,
    candidates: [
      source,
      {
        ...source,
        seq: 2,
        process_name: '修边',
        allowed_station_ids: [7, 8],
        ready: 0,
        receivable: 0,
        waiting: 10,
      },
    ],
  };
  jest.mocked(getTasks).mockResolvedValue(server);
  render(
    <App>
      <DailyTaskDetail sheet={sheet} onBack={jest.fn()} />
    </App>,
  );
  await expandOnsite();
  fireEvent.click(await screen.findByRole('button', { name: '一键安排' }));
  const chooser = await screen.findByRole('dialog');
  expect(
    within(chooser)
      .getByRole('button', { name: '暂存全部安排' })
      .hasAttribute('disabled'),
  ).toBe(true);
  expect(localStorage.length).toBe(0);
  fireEvent.mouseDown(
    within(chooser).getByRole('combobox', { name: '2. 修边目标工站' }),
  );
  fireEvent.click(
    await screen.findByText('二号工站', {
      selector: '.ant-select-item-option-content',
    }),
  );
  expect(
    within(chooser)
      .getByRole('button', { name: '暂存全部安排' })
      .hasAttribute('disabled'),
  ).toBe(false);
  fireEvent.click(
    within(chooser).getByRole('button', { name: '暂存全部安排' }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(saveTask).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '保存并发布' }));
  const review = await screen.findByRole('dialog');
  expect(review.textContent).toContain('新增 2 条');
  expect(saveTask).not.toHaveBeenCalled();
  jest.mocked(saveTask).mockResolvedValue(server);
  fireEvent.click(
    within(review).getByRole('button', { name: '确认保存并发布' }),
  );
  await waitFor(() => expect(saveTask).toHaveBeenCalledTimes(1));
  expect(jest.mocked(saveTask).mock.calls[0][0]).toMatchObject({
    batches: [
      {
        publish: true,
        items: [
          { seq: 1, station_id: 7 },
          { seq: 2, station_id: 8 },
        ],
      },
    ],
  });
});

test('onsite card contains named future steps even when searching only the current process', async () => {
  jest.mocked(getTasks).mockResolvedValue({
    ...data,
    candidates: [
      source,
      {
        ...source,
        seq: 2,
        process_name: '防火板脱胶',
        allowed_station_ids: [8],
        ready: 0,
        receivable: 0,
        waiting: 10,
        plan_start_date: '2020-01-01',
      },
    ],
  });
  render(
    <App>
      <DailyTaskDetail sheet={sheet} onBack={jest.fn()} />
    </App>,
  );
  await expandOnsite();
  fireEvent.change(screen.getByLabelText('搜索待安排任务'), {
    target: { value: '水性' },
  });
  const card = screen.getByRole('article', { name: 'MO1第1行待安排' });
  const link = within(card).getByRole('button', { name: 'MO1第1行后续工序' });
  expect(link.textContent).toContain('后续待安排 · 1 道');
  expect(link.textContent).toContain('2. 防火板脱胶');
  fireEvent.click(link);
  const panel = screen.getByRole('region', { name: '后续工序列表' });
  expect(within(panel).getAllByRole('article')).toHaveLength(1);
  expect(panel.textContent).toContain('防火板脱胶');
  expect(screen.getByLabelText('二号工站任务')).toBeTruthy();
  expect(saveTask).not.toHaveBeenCalled();
});

test('later steps stay collapsed and dragging one from the sidebar creates only its task', async () => {
  const candidates = [3, 4, 5].map((seq) => ({
    ...source,
    mo_code: 'SCDD26103125',
    sort_seq: 2,
    seq,
    process_name: `工序${seq}`,
    allowed_station_ids: [seq === 3 ? 7 : 8],
    ready: 0,
    receivable: 0,
    maximum: 67,
    unassigned: 67,
    waiting: 67,
    plan_start_date: '2026-11-11',
  }));
  jest.mocked(getTasks).mockResolvedValue({ ...data, candidates });
  render(
    <App>
      <DailyTaskDetail sheet={sheet} onBack={jest.fn()} />
    </App>,
  );
  await screen.findByRole('article', { name: 'SCDD26103125第2行待安排' });
  expect(
    screen.getAllByRole('article', { name: 'SCDD26103125第2行待安排' }),
  ).toHaveLength(1);
  expect(screen.queryByText('4. 工序4')).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'SCDD26103125第2行后续工序' }),
  );
  const panel = screen.getByRole('region', { name: '后续工序列表' });
  expect(within(panel).getAllByRole('article')).toHaveLength(2);
  const card = within(panel).getByText('4. 工序4').closest('article');
  if (!card) throw new Error('missing later step');
  fireEvent.dragStart(card, { dataTransfer: { setData: jest.fn() } });
  fireEvent.drop(screen.getByLabelText('一号工站任务'));
  fireEvent.dragEnd(card);
  const key =
    'jml.daily-tasks.v1:["account:1","2099-11-12","__all_departments__"]';
  expect(localStorage.getItem(key)).toBeNull();
  fireEvent.dragStart(card, { dataTransfer: { setData: jest.fn() } });
  fireEvent.drop(screen.getByLabelText('二号工站任务'));
  fireEvent.dragEnd(card);
  const items = JSON.parse(localStorage.getItem(key) || '{}').items;
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ seq: 4, station_id: 8, quantity: 67 });
  expect(saveTask).not.toHaveBeenCalled();
  expect(within(panel).getAllByRole('article')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: '← 返回当前任务' }));
  expect(
    screen.getByRole('article', { name: 'SCDD26103125第2行待安排' })
      .textContent,
  ).toContain('3. 工序3');
  // A later step with newly available material returns to the onsite group.
  jest.mocked(getTasks).mockResolvedValue({
    ...data,
    candidates: candidates.map((c) =>
      c.seq === 5 ? { ...c, ready: 0.5, receivable: 0.5 } : c,
    ),
  });
  await refreshTick();
  expect(
    screen.queryByRole('button', { name: 'SCDD26103125第2行后续工序' }),
  ).toBeNull();
  const onsite = screen.getByText(/现场待做 · 1/).closest('details');
  if (!onsite) throw new Error('missing onsite group');
  fireEvent.click(onsite.querySelector('summary') as HTMLElement);
  expect(
    screen.getAllByRole('article', { name: 'SCDD26103125第2行待安排' }),
  ).toHaveLength(2);
});

test('automatic refresh updates waiting work without changing drafts or an open editor', async () => {
  const waiting = {
    ...source,
    ready: 0,
    receivable: 0,
    waiting: 10,
    plan_start_date: '2026-11-11',
  };
  jest.mocked(getTasks).mockResolvedValue({ ...data, candidates: [waiting] });
  render(
    React.createElement(
      App,
      null,
      React.createElement(DailyTaskDetail, { sheet, onBack: jest.fn() }),
    ),
  );
  fireEvent.mouseEnter(
    await screen.findByRole('article', { name: 'MO1第1行待安排' }),
  );
  fireEvent.click(await screen.findByRole('button', { name: '预安排到工站' }));
  const card = (await screen.findByText(/1\. MO1/)).closest('article');
  if (!card) throw new Error('missing task');
  expect(card.textContent).not.toContain('当前能做');
  expect(card.textContent).toContain('10面等领料');
  const key =
    'jml.daily-tasks.v1:["account:1","2099-11-12","__all_departments__"]';
  const stored = localStorage.getItem(key);
  fireEvent.doubleClick(card);
  await screen.findByRole('dialog');
  fireEvent.change(screen.getByLabelText('安排数量'), {
    target: { value: '8' },
  });
  fireEvent.change(screen.getByLabelText('备注'), {
    target: { value: '明天优先' },
  });
  jest.mocked(getTasks).mockResolvedValue({
    ...data,
    candidates: [{ ...source, ready: 4, receivable: 4 }],
  });
  await refreshTick();
  expect(card.textContent).not.toContain('当前能做');
  expect(card.textContent).toContain('其中6面等领料');
  jest.mocked(getTasks).mockResolvedValue(data);
  await refreshTick();
  expect(getTasks).toHaveBeenLastCalledWith(data.date, true, sheet.id);
  expect(card.textContent).not.toContain('当前能做');
  expect(card.textContent).toContain('无需等待');
  expect(card.textContent).not.toContain('待前道完成0面');
  expect(card.textContent).toContain('安排数量10面');
  expect(
    Number((screen.getByLabelText('安排数量') as HTMLInputElement).value),
  ).toBe(8);
  expect((screen.getByLabelText('备注') as HTMLInputElement).value).toBe(
    '明天优先',
  );
  expect(localStorage.getItem(key)).toBe(stored);
  expect(saveTask).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '暂存修改' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(JSON.parse(localStorage.getItem(key) || '{}').items[0]).toMatchObject({
    quantity: 8,
    remark: '明天优先',
  });
});

test('a stale automatic response cannot replace a newer save result', async () => {
  render(
    React.createElement(
      App,
      null,
      React.createElement(DailyTaskDetail, { sheet, onBack: jest.fn() }),
    ),
  );
  await expandOnsite();
  fireEvent.click(screen.getByRole('button', { name: '安排到工站' }));
  await screen.findByText(/1\. MO1/);
  const key =
    'jml.daily-tasks.v1:["account:1","2099-11-12","__all_departments__"]';
  const savedTask = JSON.parse(localStorage.getItem(key) || '{}').items[0];
  let resolve!: (value: typeof data) => void;
  jest.mocked(getTasks).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await refreshTick();
  jest.mocked(saveTask).mockResolvedValue({
    ...data,
    headers: [{ id: 1, dept_name: '生产', revision: 1, status: 'draft' }],
    items: [
      { ...savedTask, id: 9, task_id: 1, actual: { done: 5 }, remaining: 5 },
    ],
    candidates: [
      { ...source, ready: 5, maximum: 5, reserved: 5, unassigned: 0 },
    ],
  });
  fireEvent.click(screen.getByRole('button', { name: '保存到服务器' }));
  expect(saveTask).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: '确认保存' }));
  await waitFor(() => expect(localStorage.getItem(key)).toBeNull());
  await act(async () => resolve(data));
  const savedCard = screen.getByText(/1\. MO1/).closest('article');
  if (!savedCard) throw new Error('missing saved card');
  fireEvent.mouseEnter(savedCard);
  expect(
    (await screen.findByRole('region', { name: '任务详情浮窗' })).textContent,
  ).toContain('当天完成5');
  expect(saveTask).toHaveBeenCalledTimes(1);
});

test('automatic refresh skips dragging, avoids overlapping requests and retains data on failure', async () => {
  render(
    React.createElement(
      App,
      null,
      React.createElement(DailyTaskDetail, { sheet, onBack: jest.fn() }),
    ),
  );
  await expandOnsite();
  const card = screen.getByRole('article', { name: 'MO1第1行待安排' });
  if (!card) throw new Error('missing candidate');
  const initial = jest.mocked(getTasks).mock.calls.length;
  fireEvent.dragStart(card, { dataTransfer: { setData: jest.fn() } });
  await refreshTick();
  expect(getTasks).toHaveBeenCalledTimes(initial);
  fireEvent.dragEnd(card);
  let reject!: (error: Error) => void;
  jest.mocked(getTasks).mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  await refreshTick();
  await refreshTick();
  expect(getTasks).toHaveBeenCalledTimes(initial + 1);
  fireEvent.mouseEnter(card);
  expect(
    (await screen.findByRole('button', { name: '安排到工站' })).hasAttribute(
      'disabled',
    ),
  ).toBe(false);
  await act(async () => reject(new Error('offline')));
  expect(
    screen.getByText('现场数据自动刷新失败，已保留当前内容，将自动重试。'),
  ).toBeTruthy();
  expect(card.textContent).toContain('MO1');
  await refreshTick();
  expect(
    screen.queryByText('现场数据自动刷新失败，已保留当前内容，将自动重试。'),
  ).toBeNull();
});

async function expandOnsite() {
  const summary = await screen.findByText(/现场待做 ·/);
  const group = summary.closest('details');
  if (!group?.open) fireEvent.click(summary);
  const card = group?.querySelector('article');
  if (card) {
    fireEvent.mouseEnter(card);
    await screen.findByRole('region', { name: '任务详情浮窗' });
  }
}

test('hide empty stations respects local assignments and locating restores an empty station', async () => {
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = jest.fn();
  jest.mocked(getTasks).mockResolvedValue({
    ...data,
    candidates: [{ ...source, allowed_station_ids: [7, 8] }],
  });
  try {
    render(
      <App>
        <DailyTaskDetail sheet={sheet} onBack={jest.fn()} />
      </App>,
    );
    await expandOnsite();
    const toggle = screen.getByRole('switch', { name: '隐藏未分配工站' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByLabelText('一号工站任务')).toBeTruthy();
    expect(screen.getByLabelText('二号工站任务')).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByLabelText('一号工站任务')).toBeNull();
    expect(screen.queryByLabelText('二号工站任务')).toBeNull();
    expect(screen.getByText('暂无已分配任务的工站')).toBeTruthy();
    const card = screen.getByLabelText('MO1第1行待安排');
    fireEvent.click(
      within(card).getByRole('button', { name: '定位到一号工站' }),
    );
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText('一号工站任务')).toBeTruthy();
    expect(screen.queryByLabelText('二号工站任务')).toBeNull();
    fireEvent.click(
      within(card).getByRole('button', { name: '定位到二号工站' }),
    );
    expect(screen.queryByLabelText('一号工站任务')).toBeNull();
    expect(screen.getByLabelText('二号工站任务')).toBeTruthy();
    fireEvent.click(
      within(card).getByRole('button', { name: '定位到一号工站' }),
    );
    expect(localStorage.length).toBe(0);
    fireEvent.dragStart(card, { dataTransfer: { setData: jest.fn() } });
    fireEvent.drop(screen.getByLabelText('一号工站任务'));
    fireEvent.dragEnd(card);
    await waitFor(() =>
      expect(screen.getByLabelText('一号工站任务').textContent).toContain(
        'MO1',
      ),
    );
    const draft = JSON.stringify({ ...localStorage });
    expect(screen.getByLabelText('一号工站任务')).toBeTruthy();
    expect(screen.queryByLabelText('二号工站任务')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByLabelText('二号工站任务')).toBeTruthy();
    expect(JSON.stringify({ ...localStorage })).toBe(draft);
    expect(saveTask).not.toHaveBeenCalled();
  } finally {
    HTMLElement.prototype.scrollIntoView = original;
  }
});

test('onsite starts collapsed while date-range tasks stay open and counts are separate', async () => {
  jest.mocked(getTasks).mockResolvedValue({
    ...data,
    candidates: [
      source,
      {
        ...source,
        mo_code: 'MO2',
        receivable: 0,
        ready: 0,
        waiting: 10,
        plan_start_date: '2026-11-11',
      },
    ],
  });
  render(
    React.createElement(
      App,
      null,
      React.createElement(DailyTaskDetail, { sheet, onBack: jest.fn() }),
    ),
  );
  const onsite = await screen.findByText(/现场待做 · 1/);
  expect(screen.getByText('计划开工 ≤ 2026-11-12')).toBeTruthy();
  expect(screen.getByText('近1天')).toBeTruthy();
  expect(onsite.closest('details')?.open).toBe(false);
  expect(
    screen.getByText(/计划开工范围内任务 · 1/).closest('details')?.open,
  ).toBe(true);
  expect(screen.queryByText(/待安排合计/)).toBeNull();
  const counts = within(screen.getByLabelText('待安排分类数量'));
  expect(counts.getByText('现场待做').parentElement?.textContent).toBe(
    '现场待做1 条',
  );
  expect(
    counts.getByText('计划开工范围内任务').parentElement?.textContent,
  ).toBe('计划开工范围内任务1 条');
  await expandOnsite();
  expect(onsite.closest('details')?.open).toBe(true);
  fireEvent.change(screen.getByPlaceholderText('工单、料号、产品、工序'), {
    target: { value: 'MO' },
  });
  expect(onsite.closest('details')?.open).toBe(true);
  fireEvent.mouseDown(screen.getByLabelText('计划开工日期范围'));
  fireEvent.click(
    await screen.findByText('近7天', {
      selector: '.ant-select-item-option-content',
    }),
  );
  expect(screen.getByText('计划开工 ≤ 2026-11-18')).toBeTruthy();
  todaySpy.mockReturnValue('2026-11-12');
  fireEvent(window, new Event('focus'));
  expect(screen.getByText('计划开工 ≤ 2026-11-19')).toBeTruthy();
});

test('dragging the remaining balance onto an existing task appends directly', async () => {
  const partial = editDraft(createSheetDraft(data, 'account:1'), data, {
    ...source,
    action: 'add',
    station_id: 7,
    quantity: 4,
  });
  const task = { ...partial.items[0], id: 9, task_id: 1, remark: '下午生产' };
  jest.mocked(getTasks).mockResolvedValue({
    ...data,
    items: [task],
    headers: [{ id: 1, dept_name: '生产', revision: 1, status: 'draft' }],
    candidates: [{ ...source, reserved: 4, unassigned: 6 }],
  });
  render(
    React.createElement(
      App,
      null,
      React.createElement(DailyTaskDetail, { sheet, onBack: jest.fn() }),
    ),
  );
  await expandOnsite();
  await screen.findByRole('button', { name: '安排到工站' });
  const pending = screen.getByRole('article', { name: 'MO1第1行待安排' });
  const target = screen.getByText(/1\. MO1/).closest('article');
  if (!pending || !target) throw new Error('missing drag cards');
  fireEvent.dragStart(pending, { dataTransfer: { setData: jest.fn() } });
  fireEvent.drop(target);
  fireEvent.dragEnd(pending);
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: '安排到工站' })).toBeNull(),
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  const stored = localStorage.getItem(
    'jml.daily-tasks.v1:["account:1","2099-11-12","__all_departments__"]',
  );
  const items = JSON.parse(stored || '{}').items;
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ id: 9, quantity: 10, remark: '下午生产' });
  expect(saveTask).not.toHaveBeenCalled();
});

test('drag defaults to ready quantity, leaves waiting quantity visible and allows double-click editing', async () => {
  jest.mocked(getTasks).mockResolvedValue({
    ...data,
    candidates: [
      {
        ...source,
        maximum: 30,
        unassigned: 30,
        receivable: 20,
        ready: 20,
        waiting: 10,
      },
    ],
  });
  render(
    React.createElement(
      App,
      null,
      React.createElement(DailyTaskDetail, { sheet, onBack: jest.fn() }),
    ),
  );
  await expandOnsite();
  await screen.findByRole('button', { name: '安排到工站' });
  const card = screen.getByRole('article', { name: 'MO1第1行待安排' });
  if (!card) throw new Error('missing candidate');
  expect(card.textContent).toContain('本次安排20面');
  expect(
    screen.getByRole('region', { name: '任务详情浮窗' }).textContent,
  ).toContain('未安排总量 30面');
  expect(card.textContent).not.toContain('当前能做');
  expect(card.textContent).toContain('另有10面等领料');
  fireEvent.dragStart(card, { dataTransfer: { setData: jest.fn() } });
  fireEvent.drop(screen.getByLabelText('一号工站任务'));
  fireEvent.dragEnd(card);
  const task = (await screen.findByText(/1\. MO1/)).closest('article');
  expect(task?.textContent).toContain('安排数量20面');
  fireEvent.mouseEnter(card);
  expect(
    (await screen.findByRole('button', { name: '预安排到工站' })).hasAttribute(
      'disabled',
    ),
  ).toBe(false);
  if (!task) throw new Error('missing task');
  fireEvent.doubleClick(task);
  await screen.findByRole('dialog');
  expect(saveTask).not.toHaveBeenCalled();
});

test.each([
  { quantity: 67, stations: [7], row: 2, seq: 4 },
  { quantity: 2, stations: [7, 8], row: 1, seq: 5 },
])('prearranges $quantity waiting units by drag or station button', async ({
  quantity,
  stations,
  row,
  seq,
}) => {
  jest.mocked(getTasks).mockResolvedValue({
    ...data,
    candidates: [
      {
        ...source,
        mo_code: 'SCDD26103125',
        sort_seq: row,
        seq,
        allowed_station_ids: stations,
        plan_start_date: '2026-11-11',
        received_remaining: 0,
        receivable: 0,
        ready: 0,
        maximum: quantity,
        unassigned: quantity,
        waiting: quantity,
      },
    ],
  });
  render(
    React.createElement(
      App,
      null,
      React.createElement(DailyTaskDetail, { sheet, onBack: jest.fn() }),
    ),
  );
  const pendingCard = await screen.findByRole('article', {
    name: `SCDD26103125第${row}行待安排`,
  });
  expect(pendingCard.getAttribute('data-expanded')).toBe('false');
  expect(
    within(pendingCard).getByRole('region', { name: '待安排关键数量' })
      .textContent,
  ).toContain(`本次预安排${quantity}面`);
  fireEvent.mouseEnter(pendingCard);
  const button = await screen.findByRole('button', { name: '预安排到工站' });
  const candidate = pendingCard;
  expect(candidate?.getAttribute('draggable')).toBe('true');
  expect(candidate?.textContent).toContain(`本次预安排${quantity}面`);
  expect(
    screen.getByRole('region', { name: '任务详情浮窗' }).textContent,
  ).toContain(`未安排总量 ${quantity}面`);
  expect(candidate?.textContent).not.toContain('当前能做');
  expect(candidate?.textContent).toContain(`${quantity}面等领料`);
  if (stations.length === 1) {
    if (!candidate) throw new Error('missing candidate');
    fireEvent.dragStart(candidate, { dataTransfer: { setData: jest.fn() } });
    fireEvent.drop(screen.getByLabelText('一号工站任务'));
  } else {
    fireEvent.click(button);
    fireEvent.click(await screen.findByRole('menuitem', { name: '二号工站' }));
  }
  const title = await screen.findByText(
    new RegExp(`1\\. SCDD26103125 · 第${row}行`),
  );
  const task = title.closest('article');
  expect(task?.textContent).toContain(`安排数量${quantity}面`);
  expect(task?.textContent).not.toContain('当前能做');
  expect(task?.textContent).toContain(`${quantity}面等领料`);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('button', { name: '预安排到工站' })).toBeNull();
  if (!task) throw new Error('missing task');
  fireEvent.doubleClick(task);
  await screen.findByRole('dialog');
  fireEvent.change(screen.getByLabelText('安排数量'), {
    target: { value: String(quantity - 1) },
  });
  fireEvent.click(screen.getByRole('button', { name: '暂存修改' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(task.textContent).toContain(`安排数量${quantity - 1}面`);
  expect(saveTask).not.toHaveBeenCalled();
});

test('button adds directly; cancellation restores candidate without any confirmation', async () => {
  render(
    React.createElement(
      App,
      null,
      React.createElement(DailyTaskDetail, { sheet, onBack: jest.fn() }),
    ),
  );
  await expandOnsite();
  fireEvent.click(await screen.findByRole('button', { name: '安排到工站' }));
  await screen.findByText(/1\. MO1/);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('button', { name: '安排到工站' })).toBeNull();
  expect(screen.queryByText('有未保存修改 · 已暂存本地草稿')).toBeNull();
  const assignedCard = screen.getByText(/1\. MO1/).closest('article');
  if (!assignedCard) throw new Error('missing assigned card');
  fireEvent.mouseEnter(assignedCard);
  fireEvent.click(await screen.findByRole('button', { name: /取\s*消/ }));
  await expandOnsite();
  await screen.findByRole('button', { name: '安排到工站' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(saveTask).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '安排到工站' }));
  const title = await screen.findByText(/1\. MO1/);
  const card = title.closest('article');
  if (!card) throw new Error('missing task card');
  fireEvent.doubleClick(card);
  await screen.findByRole('dialog');
  expect(screen.getByText('修改任务')).toBeTruthy();
});

test('multiple stations require only choosing a station, never a quantity confirmation', async () => {
  jest.mocked(getTasks).mockResolvedValue({
    ...data,
    candidates: [{ ...source, allowed_station_ids: [7, 8] }],
  });
  render(
    React.createElement(
      App,
      null,
      React.createElement(DailyTaskDetail, { sheet, onBack: jest.fn() }),
    ),
  );
  await expandOnsite();
  fireEvent.click(await screen.findByRole('button', { name: '安排到工站' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: '二号工站' }));
  await screen.findByText(/1\. MO1/);
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() => {
    const stored = localStorage.getItem(
      'jml.daily-tasks.v1:["account:1","2099-11-12","__all_departments__"]',
    );
    expect(JSON.parse(stored || '{}').items[0].station_id).toBe(8);
  });
  expect(saveTask).not.toHaveBeenCalled();
});

test('locked sheet ignores unsaved draft, allows snapshot export and keeps the local cache', async () => {
  const lockedSheet = {
    ...sheet,
    arrangement_locked: true,
    plan_cutoff: '2099-11-12 00:00:00',
  };
  const server = { ...data, sheet: lockedSheet };
  let draft = createSheetDraft(server, 'account:1');
  draft = editDraft(draft, server, {
    ...source,
    action: 'add',
    station_id: 7,
    quantity: 4,
  });
  const key = `jml.daily-tasks.v1:${JSON.stringify(['account:1', data.date, draft.dept])}`;
  const stored = JSON.stringify(draft);
  localStorage.setItem(key, stored);
  jest.mocked(getTasks).mockResolvedValue(server);
  render(
    <App>
      <DailyTaskDetail sheet={lockedSheet} onBack={() => {}} />
    </App>,
  );
  await screen.findByText('未保存草稿未计入，当前展示服务器内容。');
  expect(screen.queryByRole('button', { name: '保存到服务器' })).toBeNull();
  expect(screen.queryByRole('button', { name: '发布任务' })).toBeNull();
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: '导出 Excel' })
        .hasAttribute('disabled'),
    ).toBe(false),
  );
  expect(localStorage.getItem(key)).toBe(stored);
  expect(saveTask).not.toHaveBeenCalled();
});

test('an already-open page becomes read-only at the server midnight without a reload', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(100000);
  try {
    const midnightSheet = {
      ...sheet,
      plan_cutoff: '2099-11-12 00:00:00',
      result_cutoff: '2099-11-13 00:00:00',
      server_time: '2099-11-11 23:59:59',
    };
    jest.mocked(getTasks).mockResolvedValue({ ...data, sheet: midnightSheet });
    render(
      <App>
        <DailyTaskDetail sheet={midnightSheet} onBack={() => {}} />
      </App>,
    );
    await screen.findByRole('button', { name: '保存到服务器' });
    const tick = intervalSpy.mock.calls
      .filter((c: unknown[]) => c[1] === 1000)
      .at(-1)?.[0] as () => void;
    clock.mockReturnValue(102000);
    act(() => tick());
    await screen.findByText('安排已锁定，临时新增请返回列表创建补充安排');
    expect(screen.queryByRole('button', { name: '保存到服务器' })).toBeNull();
    expect(saveTask).not.toHaveBeenCalled();
  } finally {
    clock.mockRestore();
  }
});

test('candidate station links locate each target without changing assignments', async () => {
  const original = HTMLElement.prototype.scrollIntoView;
  const scroll = jest.fn();
  HTMLElement.prototype.scrollIntoView = scroll;
  try {
    jest.mocked(getTasks).mockResolvedValue({
      ...data,
      candidates: [
        {
          ...source,
          allowed_station_ids: [7, 8],
          plan_start_date: '2026-11-11',
        },
      ],
    });
    render(
      <App>
        <DailyTaskDetail sheet={sheet} onBack={() => {}} />
      </App>,
    );
    const card = await screen.findByLabelText('MO1第1行待安排');
    const second = within(card).getByRole('button', { name: '定位到二号工站' });
    fireEvent.click(second);
    const lane = screen.getByLabelText('二号工站任务');
    await waitFor(() => expect(lane.getAttribute('data-located')).toBe('true'));
    expect(scroll.mock.contexts.at(-1)).toBe(lane);
    expect(scroll).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
    const calls = scroll.mock.calls.length;
    fireEvent.click(second);
    await waitFor(() =>
      expect(scroll.mock.calls.length).toBeGreaterThan(calls),
    );
    fireEvent.click(
      within(card).getByRole('button', { name: '定位到一号工站' }),
    );
    await waitFor(() =>
      expect(
        screen.getByLabelText('一号工站任务').getAttribute('data-located'),
      ).toBe('true'),
    );
    expect(lane.getAttribute('data-located')).toBe('false');
    expect(saveTask).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  } finally {
    HTMLElement.prototype.scrollIntoView = original;
  }
});
