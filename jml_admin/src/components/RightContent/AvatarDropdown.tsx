import {
  LogoutOutlined,
  SettingOutlined,
  SkinOutlined,
} from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Spin } from 'antd';
import React, { startTransition } from 'react';
import { outLogin } from '@/services/ant-design-pro/api';
import HeaderDropdown from '../HeaderDropdown';
import { useThemeMode } from '../ThemeMode';

type GlobalHeaderRightProps = {
  children?: React.ReactNode;
};

type AuthAwareCurrentUser = API.CurrentUser & {
  authSource?: 'oidc' | 'session';
};

export const AvatarDropdown: React.FC<GlobalHeaderRightProps> = ({
  children,
}) => {
  const { initialState, setInitialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser as
    | AuthAwareCurrentUser
    | undefined;
  const loginOut = async () => {
    const result = await outLogin();
    if (currentUser?.authSource === 'oidc') {
      const redirectUrl = (result as { data?: { redirectUrl?: string } }).data
        ?.redirectUrl;
      window.location.assign(redirectUrl || '/');
      return;
    }
    const { search, pathname } = window.location;
    const urlParams = new URL(window.location.href).searchParams;
    const searchParams = new URLSearchParams({
      redirect: pathname + search,
    });
    const redirect = urlParams.get('redirect');
    if (window.location.pathname !== '/user/login' && !redirect) {
      history.replace({
        pathname: '/user/login',
        search: searchParams.toString(),
      });
    }
  };
  const { mode, toggleMode } = useThemeMode();

  const onMenuClick: MenuProps['onClick'] = (event) => {
    const { key } = event;
    if (key === 'logout') {
      startTransition(() => {
        setInitialState((s) => ({ ...s, currentUser: undefined }));
      });
      loginOut();
      return;
    }
    if (key === 'theme') {
      toggleMode();
      return;
    }
    history.push(`/account/${key}`);
  };

  if (!initialState) {
    return <Spin size="small" />;
  }

  if (!currentUser) {
    return <Spin size="small" />;
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '个人设置',
    },
    {
      key: 'theme',
      icon: <SkinOutlined />,
      label: `切换为${mode === 'dark' ? '浅色' : '深色'}主题`,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
    },
  ];

  return (
    <HeaderDropdown
      placement="bottomRight"
      menu={{
        selectedKeys: [],
        onClick: onMenuClick,
        items: menuItems,
      }}
      arrow
    >
      {children}
    </HeaderDropdown>
  );
};
