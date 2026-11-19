import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useAccess } from '@umijs/max';
import { App } from 'antd';
import React from 'react';
import EquipmentPage from './index';
import { submitConfigApproval } from '../service';
import {
  getDetail,
  getEquipment,
  getOptions,
  previewCapacity,
} from './service';
type MockPageProps = { children: import('react').ReactNode };

jest.mock('@umijs/max', () => ({
  history: { replace: jest.fn() },
  useAccess: jest.fn(),
  useLocation: () => ({ search: '' }),
}));
jest.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children }: MockPageProps) =>
    require('react').createElement('main', null, children),
}));
jest.mock('../service', () => ({
  submitConfigApproval: jest.fn(),
  updateConfigApproval: jest.fn(),
}));
jest.mock('./service', () => ({
  getEquipment: jest.fn(),
  getOptions: jest.fn(),
  getDetail: jest.fn(),
  getApproval: jest.fn(),
  previewCapacity: jest.fn(),
  calculateCapacity: jest.fn(),
}));

const row = {
  id: 1,
  device_id: 'd1',
  station_id: 1,
  device_name: '测试裁切机',
  station_name: '裁切工站',
  device_type: '裁切机',
  station_active: 1,
  device_active: true,
  capacity_count: 1,
};
const metadata = {
  devices: [
    { id: 'd1', name: '测试裁切机', enable: '1', profile: { revision: 1 } },
  ],
  stations: [
    { id: 1, station_code: 'W1', station_name: '裁切工站', is_active: 1 },
  ],
  bindings: [{ id: 1, device_id: 'd1', station_id: 1 }],
  processes: [{ id: 1, process_name: '裁切', station_id: 1 }],
  categories: [],
  types: ['裁切机'],
  workshops: [],
  units: ['件'],
};
const computedStyle = window.getComputedStyle;
beforeAll(() =>
  jest
    .spyOn(window, 'getComputedStyle')
    .mockImplementation((element) => computedStyle(element)),
);
afterAll(() => jest.mocked(window.getComputedStyle).mockRestore());
beforeEach(() => {
  jest.clearAllMocks();
  (useAccess as jest.Mock).mockReturnValue({ can: () => true });
  jest.mocked(getEquipment).mockResolvedValue([row]);
  jest.mocked(getOptions).mockResolvedValue(metadata);
  jest
    .mocked(getDetail)
    .mockResolvedValue({ ...row, standards: [], history: [] });
  jest.mocked(previewCapacity).mockResolvedValue({
    state: 'incomplete',
    hourly: null,
    unit_minutes: null,
    target_minutes: null,
  });
  jest.mocked(submitConfigApproval).mockResolvedValue({ code: 0 });
});
afterEach(cleanup);

async function openCapacity() {
  render(React.createElement(App, null, React.createElement(EquipmentPage)));
  fireEvent.click(await screen.findByRole('button', { name: '测试裁切机' }));
  fireEvent.click(await screen.findByRole('tab', { name: '标准产能' }));
  fireEvent.click(await screen.findByRole('button', { name: '新增标准' }));
  const title = await screen.findByText('标准产能申请');
  const dialog = title.closest<HTMLElement>('[role="dialog"]');
  if (!dialog) throw new Error('Missing capacity dialog');
  await within(dialog).findByLabelText('标准数量');
  return dialog;
}

test('day standards require explicit working hours and switch to unlimited hides numeric fields', async () => {
  const dialog = await openCapacity();
  fireEvent.mouseDown(await within(dialog).findByLabelText('时间周期'));
  fireEvent.click(
    await screen.findByText('每天', {
      selector: '.ant-select-item-option-content',
    }),
  );
  expect(await within(dialog).findByLabelText('每天有效工时')).toBeTruthy();
  expect(
    (within(dialog).getByLabelText('每天有效工时') as HTMLInputElement).value,
  ).toBe('');
  fireEvent.mouseDown(within(dialog).getByLabelText('产能模式'));
  fireEvent.click(
    await screen.findByText('无限产能（不限制排产）', {
      selector: '.ant-select-item-option-content',
    }),
  );
  await waitFor(() =>
    expect(within(dialog).queryByLabelText('标准数量')).toBeNull(),
  );
  expect(within(dialog).queryByLabelText('每天有效工时')).toBeNull();
});

test('unlimited standards submit through the existing approval API without invented capacity', async () => {
  const dialog = await openCapacity();
  fireEvent.mouseDown(within(dialog).getByLabelText('工序'));
  fireEvent.click(
    await screen.findByText('裁切', {
      selector: '.ant-select-item-option-content',
    }),
  );
  fireEvent.mouseDown(within(dialog).getByLabelText('产能模式'));
  fireEvent.click(
    await screen.findByText('无限产能（不限制排产）', {
      selector: '.ant-select-item-option-content',
    }),
  );
  await waitFor(() =>
    expect(within(dialog).queryByLabelText('标准数量')).toBeNull(),
  );
  fireEvent.click(within(dialog).getByRole('button', { name: '提交申请' }));
  await waitFor(() =>
    expect(submitConfigApproval).toHaveBeenCalledWith(
      'equipment-capacity',
      'create',
      expect.objectContaining({
        device_id: 'd1',
        process_id: 1,
        capacity_mode: 'unlimited',
        quantity: null,
        effective_hours: null,
      }),
    ),
  );
  await waitFor(() => expect(screen.queryByText('标准产能申请')).toBeNull());
});

test('finite day standards cannot submit without hours and preserve the original day basis', async () => {
  const dialog = await openCapacity();
  for (const [label, option] of [
    ['工序', '裁切'],
    ['计量单位', '件'],
    ['时间周期', '每天'],
  ]) {
    fireEvent.mouseDown(within(dialog).getByLabelText(label));
    fireEvent.click(
      await screen.findByText(option, {
        selector: '.ant-select-item-option-content',
      }),
    );
  }
  fireEvent.change(within(dialog).getByLabelText('标准数量'), {
    target: { value: '400' },
  });
  const hours = await within(dialog).findByLabelText('每天有效工时');
  fireEvent.click(within(dialog).getByRole('button', { name: '提交申请' }));
  await waitFor(() =>
    expect(dialog.querySelector('.ant-form-item-has-error')).not.toBeNull(),
  );
  expect(submitConfigApproval).not.toHaveBeenCalled();
  fireEvent.change(hours, { target: { value: '8' } });
  fireEvent.blur(hours);
  fireEvent.click(within(dialog).getByRole('button', { name: '提交申请' }));
  await waitFor(() =>
    expect(submitConfigApproval).toHaveBeenCalledWith(
      'equipment-capacity',
      'create',
      expect.objectContaining({
        device_id: 'd1',
        process_id: 1,
        capacity_mode: 'finite',
        quantity: '400',
        period: 'day',
        effective_hours: '8',
        unit: '件',
      }),
    ),
  );
  await waitFor(() => expect(screen.queryByText('标准产能申请')).toBeNull());
});

test('view-only accounts see archives without maintenance controls', async () => {
  (useAccess as jest.Mock).mockReturnValue({
    can: (permission: string) => permission.endsWith('.view'),
  });
  render(React.createElement(App, null, React.createElement(EquipmentPage)));
  await screen.findByRole('button', { name: '测试裁切机' });
  expect(screen.queryByRole('button', { name: '新增档案' })).toBeNull();
  expect(screen.queryByRole('button', { name: '编辑档案' })).toBeNull();
  expect(screen.queryByRole('button', { name: '产能设置' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '测试裁切机' }));
  fireEvent.click(await screen.findByRole('tab', { name: '标准产能' }));
  expect(screen.queryByRole('button', { name: '新增标准' })).toBeNull();
});

test('list actions distinguish archive editing and open capacity settings directly', async () => {
  render(React.createElement(App, null, React.createElement(EquipmentPage)));
  expect(await screen.findByRole('button', { name: '编辑档案' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '产能设置' }));
  await waitFor(() => expect(getDetail).toHaveBeenCalledWith(1));
  const capacityTab = await screen.findByRole('tab', { name: '标准产能' });
  expect(capacityTab.getAttribute('aria-selected')).toBe('true');
  expect(await screen.findByRole('button', { name: '新增标准' })).toBeTruthy();
});

test('loading failure is visible and does not silently appear as an empty successful list', async () => {
  jest.mocked(getOptions).mockRejectedValue(new Error('设备资料暂不可用'));
  render(React.createElement(App, null, React.createElement(EquipmentPage)));
  expect(await screen.findByText('设备资料暂不可用')).toBeTruthy();
  expect(screen.getByRole('button', { name: /重\s*试/ })).toBeTruthy();
});

test('new independent archives default to station names and submit manual equipment fields', async () => {
  jest.mocked(getEquipment).mockResolvedValue([]);
  jest.mocked(getOptions).mockResolvedValue({
    ...metadata,
    bindings: [],
    devices: [],
  });
  render(React.createElement(App, null, React.createElement(EquipmentPage)));
  const create = await screen.findByRole('button', { name: '新增档案' });
  await waitFor(() => expect(create.hasAttribute('disabled')).toBe(false));
  fireEvent.click(create);
  const title = await screen.findByText('设备档案申请');
  const dialog = title.closest<HTMLElement>('[role="dialog"]');
  if (!dialog) throw new Error('Missing archive dialog');
  fireEvent.mouseDown(within(dialog).getByLabelText('对应工站'));
  fireEvent.click(
    await screen.findByText('W1 裁切工站', {
      selector: '.ant-select-item-option-content',
    }),
  );
  expect(
    (within(dialog).getByLabelText('设备名称') as HTMLInputElement).value,
  ).toBe('裁切工站');
  expect(
    (within(dialog).getByLabelText('设备编号') as HTMLInputElement).value,
  ).toBe('EQ-W1');
  fireEvent.change(within(dialog).getByLabelText('设备类型'), {
    target: { value: '裁切机' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: '提交申请' }));
  await waitFor(() =>
    expect(submitConfigApproval).toHaveBeenCalledWith(
      'equipment',
      'create',
      expect.objectContaining({
        device_id: undefined,
        new_device: true,
        device_name: '裁切工站',
        device_code: 'EQ-W1',
        station_id: 1,
        device_type: '裁切机',
        profile_revision: 0,
      }),
    ),
  );
  await waitFor(() => expect(screen.queryByText('设备档案申请')).toBeNull());
});

test('editing a standard carries the formal revision from the opened record', async () => {
  jest.mocked(getDetail).mockResolvedValue({
    ...row,
    standards: [
      {
        id: 4,
        device_id: 'd1',
        process_id: 1,
        category_code: '',
        capacity_mode: 'unlimited',
        basis: 'experience',
        is_active: 1,
        revision: 2,
      },
    ],
    history: [],
  });
  render(React.createElement(App, null, React.createElement(EquipmentPage)));
  fireEvent.click(await screen.findByRole('button', { name: '测试裁切机' }));
  fireEvent.click(await screen.findByRole('tab', { name: '标准产能' }));
  const label = await screen.findByText('无限产能');
  const standardRow = label.closest('tr');
  if (!standardRow) throw new Error('Missing standard row');
  fireEvent.click(within(standardRow).getByRole('button', { name: /编\s*辑/ }));
  const title = await screen.findByText('标准产能申请');
  const dialog = title.closest<HTMLElement>('[role="dialog"]');
  if (!dialog) throw new Error('Missing edit dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: '提交申请' }));
  await waitFor(() =>
    expect(submitConfigApproval).toHaveBeenCalledWith(
      'equipment-capacity',
      'edit',
      expect.objectContaining({
        id: 4,
        revision: 2,
        device_id: 'd1',
        capacity_mode: 'unlimited',
      }),
    ),
  );
  await waitFor(() => expect(screen.queryByText('标准产能申请')).toBeNull());
});
