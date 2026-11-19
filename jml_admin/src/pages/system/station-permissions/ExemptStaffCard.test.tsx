import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import ExemptStaffCard from './ExemptStaffCard';
import {
  getStationExemptions,
  getStationStaff,
  saveStationExemptions,
} from './service';

jest.mock('./service', () => ({
  getStationExemptions: jest.fn(),
  getStationStaff: jest.fn(),
  saveStationExemptions: jest.fn(),
}));

const person = {
  id: 'staff-special',
  name: '特殊员工甲',
  status: '1',
  position: '生产',
};
const configuration = {
  staff_ids: [person.id],
  staff: [person],
  revision: 2,
  enforcement_enabled: false as const,
};
const computedStyle = window.getComputedStyle;
beforeAll(() => {
  jest
    .spyOn(window, 'getComputedStyle')
    .mockImplementation((element) => computedStyle(element));
});
afterAll(() => jest.mocked(window.getComputedStyle).mockRestore());
beforeEach(() => {
  jest.resetAllMocks();
  jest
    .mocked(window.getComputedStyle)
    .mockImplementation((element) => computedStyle(element));
  jest
    .mocked(getStationExemptions)
    .mockResolvedValue({ code: 0, data: configuration });
  jest.mocked(getStationStaff).mockResolvedValue({ code: 0, data: [person] });
  jest
    .mocked(saveStationExemptions)
    .mockResolvedValue({ code: 0, data: { id: 1 } });
});
afterEach(cleanup);

const showCard = (canManage = true) =>
  render(
    React.createElement(
      App,
      null,
      React.createElement(ExemptStaffCard, { canManage }),
    ),
  );
const openEditor = async () => {
  const button = await screen.findByRole('button', { name: '设置豁免人员' });
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(button);
  return screen.findByRole('dialog');
};
const readySave = async (dialog: HTMLElement) => {
  const button = within(dialog).getByRole('button', { name: '保存名单' });
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  );
  return button;
};

test('shows exemptions without verbose explanations or an activation control', async () => {
  showCard();
  expect(await screen.findByText(person.name)).toBeTruthy();
  expect(screen.queryByText(/工站限制启用后|仅豁免工站人员限制/)).toBeNull();
  expect(screen.queryByRole('switch')).toBeNull();
  const dialog = await openEditor();
  expect(
    within(dialog).queryByText(/选择允许跨所有工站操作|人员来自|jml_staff/),
  ).toBeNull();
});

test('view-only users cannot configure exemptions', async () => {
  showCard(false);
  await screen.findByText(person.name);
  expect(screen.queryByRole('button', { name: '设置豁免人员' })).toBeNull();
  expect(getStationStaff).not.toHaveBeenCalled();
});

test('saves stable staff IDs and the original revision then reloads', async () => {
  showCard();
  const dialog = await openEditor();
  fireEvent.click(await readySave(dialog));
  await waitFor(() =>
    expect(saveStationExemptions).toHaveBeenCalledWith({
      staff_ids: [person.id],
      revision: 2,
    }),
  );
  expect(await screen.findByText('豁免人员已保存')).toBeTruthy();
  await waitFor(() => expect(getStationExemptions).toHaveBeenCalledTimes(2));
});

test('can select a new employee from an empty exemption list', async () => {
  jest.mocked(getStationExemptions).mockResolvedValue({
    code: 0,
    data: { ...configuration, staff: [], staff_ids: [], revision: 0 },
  });
  showCard();
  const dialog = await openEditor();
  await readySave(dialog);
  fireEvent.mouseDown(within(dialog).getByRole('combobox'));
  fireEvent.click(await screen.findByText('特殊员工甲 · 生产 · pecial'));
  fireEvent.click(await readySave(dialog));
  await waitFor(() =>
    expect(saveStationExemptions).toHaveBeenCalledWith({
      staff_ids: [person.id],
      revision: 0,
    }),
  );
});

test('can remove all exemptions without changing station configurations', async () => {
  showCard();
  const dialog = await openEditor();
  await readySave(dialog);
  fireEvent.click(
    within(
      within(dialog).getByTitle('特殊员工甲 · 生产 · pecial'),
    ).getByLabelText('close'),
  );
  fireEvent.click(await readySave(dialog));
  await waitFor(() =>
    expect(saveStationExemptions).toHaveBeenCalledWith({
      staff_ids: [],
      revision: 2,
    }),
  );
});

test('cancel does not save and reopening restores the saved list', async () => {
  showCard();
  const dialog = await openEditor();
  await readySave(dialog);
  fireEvent.click(
    within(
      within(dialog).getByTitle('特殊员工甲 · 生产 · pecial'),
    ).getByLabelText('close'),
  );
  fireEvent.click(within(dialog).getByRole('button', { name: '取 消' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(saveStationExemptions).not.toHaveBeenCalled();
  const reopened = await openEditor();
  fireEvent.click(await readySave(reopened));
  await waitFor(() =>
    expect(saveStationExemptions).toHaveBeenCalledWith({
      staff_ids: [person.id],
      revision: 2,
    }),
  );
});

test('save conflict preserves selection and does not claim success', async () => {
  jest
    .mocked(saveStationExemptions)
    .mockRejectedValue(new Error('配置已被修改，请刷新后重新编辑'));
  showCard();
  const dialog = await openEditor();
  fireEvent.click(await readySave(dialog));
  expect(
    await screen.findByText('配置已被修改，请刷新后重新编辑'),
  ).toBeTruthy();
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(getStationExemptions).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('豁免人员已保存，工站操作限制仍未启用')).toBeNull();
});

test('failed employee lookup blocks save until refreshed successfully', async () => {
  jest.mocked(getStationStaff).mockRejectedValueOnce(new Error('unavailable'));
  showCard();
  const dialog = await openEditor();
  await screen.findByText('人员加载失败，请重试');
  expect(
    (
      within(dialog).getByRole('button', {
        name: '保存名单',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(within(dialog).getByRole('button', { name: '刷新人员' }));
  await readySave(dialog);
  expect(getStationStaff).toHaveBeenCalledTimes(2);
  expect(saveStationExemptions).not.toHaveBeenCalled();
});

test('unavailable employee can be removed without losing active exemptions', async () => {
  const inactive = { id: 'staff-inactive', name: '已停用人员', status: '0' };
  jest.mocked(getStationExemptions).mockResolvedValue({
    code: 0,
    data: {
      ...configuration,
      staff_ids: [person.id, inactive.id],
      staff: [person, inactive],
    },
  });
  showCard();
  expect(await screen.findByText('已停用人员（不可用）')).toBeTruthy();
  const dialog = await openEditor();
  fireEvent.click(
    await within(dialog).findByRole('button', { name: '移除不可用人员' }),
  );
  fireEvent.click(await readySave(dialog));
  await waitFor(() =>
    expect(saveStationExemptions).toHaveBeenCalledWith({
      staff_ids: [person.id],
      revision: 2,
    }),
  );
});

test('load failure is not treated as an empty editable list', async () => {
  jest
    .mocked(getStationExemptions)
    .mockRejectedValueOnce(new Error('unavailable'));
  showCard();
  expect(await screen.findByText(/豁免人员加载失败/)).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: '设置豁免人员' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(screen.queryByText('尚未设置豁免人员')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '刷新名单' }));
  expect(await screen.findByText(person.name)).toBeTruthy();
});
