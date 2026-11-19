import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useAccess, useModel } from '@umijs/max';
import { App } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import DailyTaskSheets from './index';
import { createTaskSheet, getTaskSheets } from './service';

type TaskSheet = import('./service').TaskSheet;

type MockDetailProps = { sheet: TaskSheet; onBack: () => void };

jest.mock('@umijs/max', () => ({ useAccess: jest.fn(), useModel: jest.fn() }));
jest.mock('./service', () => ({
  getTaskSheets: jest.fn(),
  createTaskSheet: jest.fn(),
}));
jest.mock('./detail', () => ({
  __esModule: true,
  default: ({ sheet, onBack }: MockDetailProps) =>
    require('react').createElement(
      'div',
      null,
      require('react').createElement('span', null, `维护：${sheet.work_date}`),
      require('react').createElement(
        'button',
        { type: 'button', onClick: onBack },
        '返回列表',
      ),
    ),
}));

const row: TaskSheet = {
  id: 1,
  work_date: '2026-11-12',
  dept_name: '水性生产部',
  status: 'draft',
  revision: 1,
  created_by: 'PMC',
  created_at: '2026-11-11 10:00:00',
  task_count: 0,
  station_count: 0,
};
const computedStyle = window.getComputedStyle;
beforeAll(() => {
  Object.assign(globalThis, { React });
});
beforeAll(() =>
  jest
    .spyOn(window, 'getComputedStyle')
    .mockImplementation((element) => computedStyle(element)),
);
afterAll(() => jest.mocked(window.getComputedStyle).mockRestore());
beforeEach(() => {
  jest.clearAllMocks();
  (useAccess as jest.Mock).mockReturnValue({ can: () => true });
  jest
    .mocked(useModel)
    .mockReturnValue({ initialState: { currentUser: { adminAccountId: 1 } } });
  jest.mocked(getTaskSheets).mockResolvedValue([row]);
  jest.mocked(createTaskSheet).mockResolvedValue({
    sheet: { ...row, work_date: '2099-11-12' },
    created: true,
  });
});
afterEach(cleanup);

test('entry shows sheets first; opening and returning keep list filters', async () => {
  render(React.createElement(App, null, React.createElement(DailyTaskSheets)));
  await screen.findByText('2026-11-12');
  expect(screen.queryByText(/维护：/)).toBeNull();
  fireEvent.change(screen.getByLabelText('搜索安排单'), {
    target: { value: 'PMC' },
  });
  fireEvent.click(screen.getByRole('button', { name: '维护安排' }));
  await screen.findByText('维护：2026-11-12');
  fireEvent.click(screen.getByRole('button', { name: '返回列表' }));
  await waitFor(() => expect(getTaskSheets).toHaveBeenCalledTimes(2));
  expect((screen.getByLabelText('搜索安排单') as HTMLInputElement).value).toBe(
    'PMC',
  );
  expect(createTaskSheet).not.toHaveBeenCalled();
});

test('create sheet persists header before entering its details', async () => {
  jest.mocked(getTaskSheets).mockResolvedValue([]);
  render(React.createElement(App, null, React.createElement(DailyTaskSheets)));
  await screen.findByText('暂无安排单');
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: '新建安排单' })
        .hasAttribute('disabled'),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '新建安排单' }));
  expect(screen.queryByLabelText('新建生产部门')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '创建并进入' }));
  await screen.findByText('维护：2099-11-12');
  expect(createTaskSheet).toHaveBeenCalledWith(
    dayjs().add(1, 'day').format('YYYY-MM-DD'),
  );
});

test('view-only user can open sheets without a create entry', async () => {
  (useAccess as jest.Mock).mockReturnValue({ can: () => false });
  render(React.createElement(App, null, React.createElement(DailyTaskSheets)));
  await screen.findByText('2026-11-12');
  expect(screen.queryByRole('button', { name: '新建安排单' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '查看' }));
  await screen.findByText('维护：2026-11-12');
});

test('locked original exposes a separate supplemental-sheet entry', async () => {
  jest.mocked(getTaskSheets).mockResolvedValue([
    {
      ...row,
      sheet_kind: 'main',
      arrangement_locked: true,
      result_cutoff: '2099-11-13 00:00:00',
    },
  ]);
  render(
    <App>
      <DailyTaskSheets />
    </App>,
  );
  fireEvent.click(await screen.findByRole('button', { name: '新建补充安排' }));
  await waitFor(() =>
    expect(createTaskSheet).toHaveBeenCalledWith(row.work_date, row.id),
  );
});
