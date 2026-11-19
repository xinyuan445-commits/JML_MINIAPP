import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useAccess } from '@umijs/max';
import { App } from 'antd';
import React from 'react';
import { announceApprovalChange } from '@/utils/approvalNotifications';
import ApprovalCenter from './index';
import { getConfigApprovals, reviewConfigApproval } from './service';

type ApprovalItem = import('./service').ApprovalItem;
type MockPageProps = { children: import('react').ReactNode };

jest.mock('@umijs/max', () => ({
  history: { push: jest.fn() },
  useAccess: jest.fn(),
  useModel: () => ({ initialState: { currentUser: { adminAccountId: 1 } } }),
}));
jest.mock('@ant-design/pro-components', () => ({
  ...jest.requireActual('@ant-design/pro-components'),
  PageContainer: ({ children }: MockPageProps) => require('react').createElement('main', null, children),
}));
jest.mock('@/hooks/useViewportScrollHeight', () => ({
  useViewportScrollHeight: () => ({ scrollRef: { current: null }, scrollHeight: 300 }),
}));
jest.mock('@/utils/approvalNotifications', () => ({ announceApprovalChange: jest.fn() }));
jest.mock('./service', () => ({
  getConfigApprovals: jest.fn(),
  reviewConfigApproval: jest.fn(),
  markApprovalResultsRead: jest.fn().mockResolvedValue({ code: 0 }),
}));

const records: ApprovalItem[] = ['甲', '乙', '丙'].map((name, index) => ({
  id: index + 1,
  request_no: `APR-0000000${index + 1}`,
  module_type: 'process',
  action_type: 'create',
  target_key: `P-${index + 1}`,
  after_data: { process_name: `工序${name}`, process_code: `P-${index + 1}` },
  status: 'pending',
  applicant_account_id: index === 1 ? 3 : 2,
  applicant_name: index === 1 ? '申请人乙' : '申请人甲',
  apply_time: '2026-10-07 10:00:00',
  revision: index + 1,
}));
const applicants = [
  { applicant_account_id: 2, applicant_name: '申请人甲' },
  { applicant_account_id: 3, applicant_name: '申请人乙' },
];
const getApprovals = jest.mocked(getConfigApprovals);
const reviewApproval = jest.mocked(reviewConfigApproval);
const computedStyle = window.getComputedStyle;

beforeAll(() => {
  jest.spyOn(window, 'getComputedStyle').mockImplementation((element) => computedStyle(element));
});
afterAll(() => jest.mocked(window.getComputedStyle).mockRestore());
beforeEach(() => {
  jest.clearAllMocks();
  (useAccess as jest.Mock).mockReturnValue({ can: () => true });
  getApprovals.mockImplementation(async (params) => ({
    code: 0,
    data: params.applicant_account_id
      ? records.filter((row) => row.applicant_account_id === params.applicant_account_id)
      : records,
    total: params.applicant_account_id ? 1 : records.length,
    applicants,
  }));
  reviewApproval.mockResolvedValue({ code: 0 });
});
afterEach(cleanup);

async function showPage() {
  render(React.createElement(App, null, React.createElement(ApprovalCenter)));
  await screen.findByText('工序甲');
}

test('route approval details show category names on both sides and retain unknown codes', async () => {
  getApprovals.mockResolvedValue({
    code: 0, total: 1,
    data: [{ ...records[0], module_type: 'route', action_type: 'edit',
      before_data: { route_name: '测试路线', product_codes: ['old'] },
      after_data: { product_codes: ['12', 'missing'] },
      product_category_names: { old: '旧类别', '12': '实木单贴肤感板（PB、OSB、MDF、PW）' },
    }],
  });
  render(React.createElement(App, null, React.createElement(ApprovalCenter)));
  fireEvent.click(await screen.findByText('测试路线'));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('旧类别（old）')).toBeTruthy();
  expect(within(dialog).getByText('实木单贴肤感板（PB、OSB、MDF、PW）（12）、类别名称未找到（missing）')).toBeTruthy();
});

function selectRow(name: string) {
  const row = screen.getByText(name).closest('tr');
  if (!row) throw new Error('Missing approval row');
  fireEvent.click(within(row).getByRole('checkbox'));
}

test('checkbox selection keeps row details closed and applicant filtering clears selection', async () => {
  await showPage();
  selectRow('工序甲');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('已选 1 条')).toBeTruthy();
  fireEvent.mouseDown(screen.getByRole('combobox', { name: '筛选申请人' }));
  fireEvent.click(await screen.findByText('申请人乙', { selector: '.ant-select-item-option-content' }));
  await waitFor(() => expect(getApprovals).toHaveBeenLastCalledWith(expect.objectContaining({
    scope: 'pending', applicant_account_id: 3,
  })));
  expect(screen.getByText('已选 0 条')).toBeTruthy();
  await waitFor(() => expect(screen.queryByText('工序甲')).toBeNull());
  fireEvent.click(screen.getByText('工序乙'));
  expect(await screen.findByRole('dialog')).toBeTruthy();
});

test('selections survive pagination and batch review includes the selected rows from both pages', async () => {
  getApprovals.mockImplementation(async (params) => ({
    code: 0, data: params.current === 2 ? [records[1]] : [records[0]], total: 21, applicants,
  }));
  await showPage();
  selectRow('工序甲');
  fireEvent.click(screen.getByTitle('2'));
  await screen.findByText('工序乙');
  selectRow('工序乙');
  expect(screen.getByText('已选 2 条')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '批量通过' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('工序甲')).toBeTruthy();
  expect(within(dialog).getByText('工序乙')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: '确认通过' }));
  await waitFor(() => expect(reviewApproval).toHaveBeenCalledTimes(2));
  expect(reviewApproval.mock.calls.map(([request]) => [request.id, request.revision])).toEqual([[1, 1], [2, 2]]);
  await waitFor(() => expect(screen.getByText('已选 0 条')).toBeTruthy());
});

test('batch review submits sequentially, prevents duplicate confirmation, and reports partial failure', async () => {
  let finishFirst: (value: { code: number }) => void = () => undefined;
  reviewApproval
    .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
    .mockResolvedValueOnce({ code: 400, msg: '申请内容已修改，请刷新后重新审批' })
    .mockResolvedValueOnce({ code: 0 });
  await showPage();
  for (const name of ['工序甲', '工序乙', '工序丙']) selectRow(name);
  fireEvent.click(screen.getByRole('button', { name: '批量通过' }));
  const dialog = await screen.findByRole('dialog');
  const confirm = within(dialog).getByRole('button', { name: '确认通过' });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(reviewApproval).toHaveBeenCalledTimes(1);
  expect((within(dialog).getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true);
  await act(async () => { finishFirst({ code: 0 }); });
  await waitFor(() => expect(reviewApproval).toHaveBeenCalledTimes(3));
  expect(reviewApproval.mock.calls.map(([request]) => request.id)).toEqual([1, 2, 3]);
  const result = await screen.findByRole('dialog');
  expect(within(result).getByText('未完成的审核')).toBeTruthy();
  expect(within(result).getByText('APR-00000002')).toBeTruthy();
  expect(within(result).getByText('申请内容已修改，请刷新后重新审批')).toBeTruthy();
  expect(announceApprovalChange).toHaveBeenCalledTimes(1);
  expect(screen.getByText('已选 0 条')).toBeTruthy();
});

test('batch rejection requires one reason and sends it with each selected revision', async () => {
  await showPage();
  selectRow('工序甲');
  selectRow('工序乙');
  fireEvent.click(screen.getByRole('button', { name: '批量驳回' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: '确认驳回' }));
  expect(reviewApproval).not.toHaveBeenCalled();
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: ' 请补充说明 ' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '确认驳回' }));
  await waitFor(() => expect(reviewApproval).toHaveBeenCalledTimes(2));
  expect(reviewApproval.mock.calls.map(([request]) => request)).toEqual([
    { id: 1, revision: 1, decision: 'reject', comment: '请补充说明' },
    { id: 2, revision: 2, decision: 'reject', comment: '请补充说明' },
  ]);
});
