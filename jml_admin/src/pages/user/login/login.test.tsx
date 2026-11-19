import { TestBrowser } from '@@/testBrowser';
import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { currentUser, login } from '@/services/ant-design-pro/api';

jest.mock('@/services/ant-design-pro/api', () => ({
  currentUser: jest.fn(),
  login: jest.fn(),
  outLogin: jest.fn(),
}));

const currentUserMock = jest.mocked(currentUser);
const loginMock = jest.mocked(login);

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: jest.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('Login Page', () => {
  beforeEach(() => {
    currentUserMock.mockReset();
    loginMock.mockReset();
    currentUserMock.mockRejectedValue(new Error('not logged in'));
  });

  it('shows the original account login form when there is no platform identity', async () => {
    const rootContainer = render(
      React.createElement(TestBrowser, {
        location: { pathname: '/user/login' },
      }),
    );

    expect(await rootContainer.findByText('欢迎登录')).toBeTruthy();
    expect(rootContainer.getByPlaceholderText('请输入用户名')).toBeTruthy();
    expect(rootContainer.getByPlaceholderText('请输入密码')).toBeTruthy();
    expect(rootContainer.getByText('登录系统')).toBeTruthy();

    rootContainer.unmount();
  });

  it('keeps the existing account login request flow', async () => {
    currentUserMock
      .mockRejectedValueOnce(new Error('not logged in'))
      .mockResolvedValue({
        data: {
          name: '管理员',
          userid: 'admin',
          access: 'admin',
          authSource: 'session',
        } as API.CurrentUser,
      });
    loginMock.mockResolvedValue({ status: 'ok', type: 'account' });

    const rootContainer = render(
      React.createElement(TestBrowser, {
        location: { pathname: '/user/login' },
      }),
    );

    fireEvent.change(await rootContainer.findByPlaceholderText('请输入用户名'), {
      target: { value: 'admin' },
    });
    fireEvent.change(rootContainer.getByPlaceholderText('请输入密码'), {
      target: { value: 'test-password' },
    });
    fireEvent.click(rootContainer.getByText('登录系统'));

    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'admin',
          password: 'test-password',
          type: 'account',
        }),
      ),
    );

    rootContainer.unmount();
  });
});
