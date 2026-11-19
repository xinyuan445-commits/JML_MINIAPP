import {
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
import StationPermissionsPage from './index';
import {
  getStationConfigurations,
  getStationExemptions,
  getStationProxies,
  getStationStaff,
  saveStationConfiguration,
  saveStationProxies,
  saveStationSetting,
} from './service';

type MockPageProps = { children: import('react').ReactNode };

jest.mock('@umijs/max', () => ({ useAccess: jest.fn(), useModel: jest.fn() }));
jest.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children }: MockPageProps) =>
    require('react').createElement('main', null, children),
}));
jest.mock('./service', () => ({
  getStationConfigurations: jest.fn(),
  getStationProxies: jest.fn(),
  getStationExemptions: jest.fn().mockResolvedValue({
    code: 0,
    data: { staff_ids: [], staff: [], revision: 0, enforcement_enabled: false },
  }),
  getStationStaff: jest.fn(),
  saveStationConfiguration: jest.fn(),
  saveStationProxies: jest.fn(),
  saveStationSetting: jest.fn(),
}));

const leader = {
  id: 'staff-leader',
  name: '线长甲',
  status: '1',
  position: '线长',
};
const scanner = {
  id: 'staff-scanner',
  name: '扫码乙',
  status: '1',
  position: '员工',
};
const row = {
  id: 28,
  station_name: '倒角',
  station_code: 'WS-DJ',
  is_active: 1,
  leader_staff_id: leader.id,
  scanner_staff_ids: [scanner.id],
  leader,
  scanners: [scanner],
  revision: 3,
  configured: true,
  update_time: '2026-09-08 12:00:00',
};

const computedStyle = window.getComputedStyle;
beforeAll(() => {
  jest
    .spyOn(window, 'getComputedStyle')
    .mockImplementation((element) => computedStyle(element));
});
afterAll(() => jest.mocked(window.getComputedStyle).mockRestore());

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getStationProxies).mockResolvedValue({ code: 0, data: [] });
  jest
    .mocked(saveStationProxies)
    .mockResolvedValue({ code: 0, data: { id: 28 } });
  (useAccess as jest.Mock).mockReturnValue({ can: () => true });
  (useModel as jest.Mock).mockReturnValue({
    initialState: { currentUser: { username: 'admin' } },
  });
  jest.mocked(getStationConfigurations).mockResolvedValue({
    code: 0,
    data: {
      enforcement_enabled: false,
      report_access_mode: 'exempt',
      setting_revision: 0,
      stations: [row],
    },
  });
  jest
    .mocked(getStationStaff)
    .mockResolvedValue({ code: 0, data: [leader, scanner] });
  jest
    .mocked(saveStationConfiguration)
    .mockResolvedValue({ code: 0, data: { id: 28 } });
});
afterEach(cleanup);

const showPage = () =>
  render(
    React.createElement(App, null, React.createElement(StationPermissionsPage)),
  );

test('shows saved people, searchable by name, and the admin switch', async () => {
  showPage();
  expect(await screen.findByText('倒角')).toBeTruthy();
  expect(screen.getByText('线长甲')).toBeTruthy();
  expect(screen.getByText('扫码乙')).toBeTruthy();
  expect(screen.getByText('工站权限控制')).toBeTruthy();
  expect(screen.getByText('报表开放范围')).toBeTruthy();
  expect(screen.getByText('仅豁免人员')).toBeTruthy();
  expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  fireEvent.change(screen.getByLabelText('搜索工站或人员'), {
    target: { value: '不存在' },
  });
  expect(screen.queryByText('倒角')).toBeNull();
  fireEvent.change(screen.getByLabelText('搜索工站或人员'), {
    target: { value: '扫码乙' },
  });
  expect(screen.getByText('倒角')).toBeTruthy();
});

test('non-admin users only see station staffing and never request global exemptions', async () => {
  (useModel as jest.Mock).mockReturnValue({
    initialState: { currentUser: { username: 'sandyho' } },
  });
  jest.mocked(getStationConfigurations).mockResolvedValue({
    code: 0,
    data: { stations: [row] },
  });
  showPage();
  expect(await screen.findByText('倒角')).toBeTruthy();
  expect(screen.queryByText('工站权限控制')).toBeNull();
  expect(screen.queryByText('报表开放范围')).toBeNull();
  expect(screen.queryByText('工站豁免人员')).toBeNull();
  expect(getStationExemptions).not.toHaveBeenCalled();
});

test('read-only users cannot open the editor', async () => {
  (useAccess as jest.Mock).mockReturnValue({ can: () => false });
  showPage();
  await screen.findByText('倒角');
  expect(screen.getByText('仅查看')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '配置人员' })).toBeNull();
  expect(screen.queryByRole('button', { name: '配置代理' })).toBeNull();
  expect(getStationStaff).not.toHaveBeenCalled();
  expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
  expect(
    (
      screen.getByRole('combobox', {
        name: '报表开放范围',
      }) as HTMLInputElement
    ).disabled,
  ).toBe(true);
});

test('editing keeps staff IDs and revision, saves without activation, then reloads', async () => {
  showPage();
  fireEvent.click(await screen.findByRole('button', { name: '配置人员' }));
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(getStationStaff).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(
      (
        within(dialog).getByRole('button', {
          name: '保存配置',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(within(dialog).getByRole('button', { name: '保存配置' }));
  await waitFor(() =>
    expect(saveStationConfiguration).toHaveBeenCalledWith({
      station_id: 28,
      leader_staff_id: leader.id,
      scanner_staff_ids: [scanner.id],
      revision: 3,
    }),
  );
  expect(await screen.findByText('配置已保存')).toBeTruthy();
  await waitFor(() =>
    expect(getStationConfigurations).toHaveBeenCalledTimes(2),
  );
});

test('save failure keeps the editor and does not reload or claim success', async () => {
  jest
    .mocked(saveStationConfiguration)
    .mockRejectedValue(new Error('这条配置已被修改，请刷新后重新编辑'));
  showPage();
  fireEvent.click(await screen.findByRole('button', { name: '配置人员' }));
  const dialog = await screen.findByRole('dialog');
  await waitFor(() =>
    expect(
      (
        within(dialog).getByRole('button', {
          name: '保存配置',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(within(dialog).getByRole('button', { name: '保存配置' }));
  expect(
    await screen.findByText('这条配置已被修改，请刷新后重新编辑'),
  ).toBeTruthy();
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.queryByText('配置已保存')).toBeNull();
  expect(getStationConfigurations).toHaveBeenCalledTimes(1);
});

test('staff can be refreshed after employees are added', async () => {
  showPage();
  fireEvent.click(await screen.findByRole('button', { name: '配置人员' }));
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(getStationStaff).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(
      (
        within(dialog).getByRole('button', {
          name: '保存配置',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(within(dialog).getByText('刷新人员'));
  await waitFor(() => expect(getStationStaff).toHaveBeenCalledTimes(2));
});

test('failed staff lookup disables save until a successful retry', async () => {
  jest.mocked(getStationStaff).mockRejectedValueOnce(new Error('unavailable'));
  showPage();
  fireEvent.click(await screen.findByRole('button', { name: '配置人员' }));
  const dialog = await screen.findByRole('dialog');
  expect(await screen.findByText('人员加载失败，请重试')).toBeTruthy();
  expect(
    (
      within(dialog).getByRole('button', {
        name: '保存配置',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(within(dialog).getByText('刷新人员'));
  await waitFor(() =>
    expect(
      (
        within(dialog).getByRole('button', {
          name: '保存配置',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  expect(saveStationConfiguration).not.toHaveBeenCalled();
});

test('failed page load shows retry rather than a successful empty configuration', async () => {
  jest
    .mocked(getStationConfigurations)
    .mockRejectedValue(new Error('unavailable'));
  showPage();
  expect(await screen.findByText(/工站配置加载失败/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '配置人员' })).toBeNull();
  expect(screen.getByRole('button', { name: '刷 新' })).toBeTruthy();
});

test('removing unavailable people keeps all other selected staff', async () => {
  const inactive = { id: 'inactive-staff', name: '停用员工', status: '0' };
  jest.mocked(getStationConfigurations).mockResolvedValue({
    code: 0,
    data: {
      enforcement_enabled: false,
      report_access_mode: 'exempt',
      setting_revision: 0,
      stations: [
        {
          ...row,
          scanner_staff_ids: [scanner.id, inactive.id],
          scanners: [scanner, inactive],
        },
      ],
    },
  });
  showPage();
  fireEvent.click(await screen.findByRole('button', { name: '配置人员' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(
    await within(dialog).findByRole('button', { name: '移除不可用人员' }),
  );
  fireEvent.click(within(dialog).getByRole('button', { name: '保存配置' }));
  await waitFor(() =>
    expect(saveStationConfiguration).toHaveBeenCalledWith({
      station_id: 28,
      leader_staff_id: leader.id,
      scanner_staff_ids: [scanner.id],
      revision: 3,
    }),
  );
});

test('admin switch requires confirmation and saves the current revision', async () => {
  jest
    .mocked(saveStationSetting)
    .mockResolvedValue({ code: 0, data: { id: 1 } });
  showPage();
  await screen.findByText('倒角');
  fireEvent.click(screen.getByRole('switch'));
  const dialog = await screen.findByRole('dialog');
  expect(saveStationSetting).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: '确 认' }));
  await waitFor(() =>
    expect(saveStationSetting).toHaveBeenCalledWith({
      enabled: true,
      report_access_mode: 'exempt',
      revision: 0,
    }),
  );
  await waitFor(() =>
    expect(getStationConfigurations).toHaveBeenCalledTimes(2),
  );
});

test('report access selector confirms and saves without changing station switch', async () => {
  jest
    .mocked(saveStationSetting)
    .mockResolvedValue({ code: 0, data: { id: 1 } });
  showPage();
  await screen.findByText('倒角');
  fireEvent.mouseDown(screen.getByRole('combobox', { name: '报表开放范围' }));
  fireEvent.click(
    await screen.findByText('工站授权人员', {
      selector: '.ant-select-item-option-content',
    }),
  );
  const dialog = await screen.findByRole('dialog');
  expect(saveStationSetting).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: '确 认' }));
  await waitFor(() =>
    expect(saveStationSetting).toHaveBeenCalledWith({
      enabled: false,
      report_access_mode: 'station',
      revision: 0,
    }),
  );
});

const proxyConfiguration = {
  station_id: 28,
  version: 'current-version',
  proxies: [
    {
      id: 7,
      staff_id: scanner.id,
      starts_at: '2026-01-01T04:00:00+00:00',
      ends_at: '2099-01-02T05:00:00+00:00',
      person: { ...scanner, name: '代理丙' },
    },
  ],
};

const openProxyEditor = async () => {
  const button = await screen.findByRole('button', { name: '配置代理' });
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(button);
  const dialog = await screen.findByRole('dialog');
  await waitFor(() =>
    expect(
      (
        within(dialog).getByRole('button', {
          name: '保存代理',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  return dialog;
};

test('shows proxy periods in Beijing time and supports searching proxy names', async () => {
  jest
    .mocked(getStationProxies)
    .mockResolvedValue({ code: 0, data: [proxyConfiguration] });
  showPage();
  expect(await screen.findByText(/代理丙 · 剩余/)).toBeTruthy();
  expect(screen.getByText('01-01 12:00 至 2099-01-02 13:00')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('搜索工站或人员'), {
    target: { value: '代理丙' },
  });
  expect(screen.getByText('倒角')).toBeTruthy();
});

test('saving proxies uses a separate version and never sends permanent staff configuration', async () => {
  jest
    .mocked(getStationProxies)
    .mockResolvedValue({ code: 0, data: [proxyConfiguration] });
  showPage();
  const dialog = await openProxyEditor();
  fireEvent.click(within(dialog).getByRole('button', { name: '保存代理' }));
  await waitFor(() =>
    expect(saveStationProxies).toHaveBeenCalledWith({
      station_id: 28,
      version: 'current-version',
      proxies: [
        {
          staff_id: scanner.id,
          starts_at: '2026-01-01T12:00:00+08:00',
          ends_at: '2099-01-02T13:00:00+08:00',
        },
      ],
    }),
  );
  expect(saveStationConfiguration).not.toHaveBeenCalled();
  await waitFor(() => expect(getStationProxies).toHaveBeenCalledTimes(2));
  expect(screen.getByText('线长甲')).toBeTruthy();
});

test('removing a proxy saves only an empty proxy list, retaining permanent staffing', async () => {
  jest
    .mocked(getStationProxies)
    .mockResolvedValue({ code: 0, data: [proxyConfiguration] });
  showPage();
  const dialog = await openProxyEditor();
  fireEvent.click(within(dialog).getByRole('button', { name: '移除代理' }));
  fireEvent.click(within(dialog).getByRole('button', { name: '保存代理' }));
  await waitFor(() =>
    expect(saveStationProxies).toHaveBeenCalledWith({
      station_id: 28,
      version: 'current-version',
      proxies: [],
    }),
  );
  expect(saveStationConfiguration).not.toHaveBeenCalled();
  expect(screen.getByText('线长甲')).toBeTruthy();
  expect(screen.getByText('扫码乙')).toBeTruthy();
});

test('expired proxies are not displayed even before the next cleanup', async () => {
  jest.mocked(getStationProxies).mockResolvedValue({
    code: 0,
    data: [
      {
        ...proxyConfiguration,
        proxies: [
          {
            ...proxyConfiguration.proxies[0],
            ends_at: '2000-01-01T00:00:00+00:00',
          },
        ],
      },
    ],
  });
  showPage();
  await screen.findByText('倒角');
  expect(screen.queryByText(/代理丙/)).toBeNull();
});

test('proxy load failure does not disable the permanent personnel editor', async () => {
  jest.mocked(getStationProxies).mockRejectedValue(new Error('unavailable'));
  showPage();
  await screen.findByText('代理配置加载失败，请刷新重试。');
  const proxyButton = await screen.findByRole('button', { name: '配置代理' });
  expect((proxyButton as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '配置人员' }));
  expect(await screen.findByRole('dialog')).toBeTruthy();
});

test('stale proxy save keeps the editor and does not claim success', async () => {
  jest
    .mocked(getStationProxies)
    .mockResolvedValue({ code: 0, data: [proxyConfiguration] });
  jest
    .mocked(saveStationProxies)
    .mockRejectedValue(new Error('代理配置已变化或到期，请刷新后重新编辑'));
  showPage();
  const dialog = await openProxyEditor();
  fireEvent.click(within(dialog).getByRole('button', { name: '保存代理' }));
  expect(
    await screen.findByText('代理配置已变化或到期，请刷新后重新编辑'),
  ).toBeTruthy();
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.queryByText('代理配置已保存')).toBeNull();
  expect(saveStationConfiguration).not.toHaveBeenCalled();
});
