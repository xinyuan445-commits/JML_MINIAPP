import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link } from '@umijs/max';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React from 'react';
import logo from '@/static/logo.jpg';
import {
  type AdminUser,
  authorizedRedirect,
  homeForUser,
} from '@/utils/adminPermissions';

// Initialize dayjs plugins globally
dayjs.extend(relativeTime);

import ErrorBoundary from '@/components/ErrorBoundary';
import ApprovalMenuLabel from '@/components/ApprovalMenuLabel';
import OfflineBanner from '@/components/OfflineBanner';
import { AvatarDropdown } from '@/components/RightContent/AvatarDropdown';
import { ThemeModeProvider } from '@/components/ThemeMode';
import { currentUser as queryCurrentUser } from '@/services/ant-design-pro/api';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';

const loginPath = '/user/login';
const publicPaths = new Set(['/', '/board/production']);
const menuGroupByPath: Record<string, string> = {
  '/mo/workorder': '工序管理',
  '/mo/workorder-trace': '工序管理',
  '/mo/route': '工序管理',
  '/mo/process': '工序配置',
  '/mo/workstation': '工序配置',
  '/mo/product-category': '工序配置',
  '/mo/worker-department': '工序配置',
  '/demand/calculation': '需求计划',
  '/mo/audit': '系统配置',
  '/system/accounts': '系统配置',
  '/system/roles': '系统配置',
  '/system/station-permissions': '系统配置',
  '/system/page-settings': '系统配置',
  '/system/basic-settings': '系统配置',
};

const safeInternalRedirect = (redirect: string | null): string => {
  if (!redirect?.startsWith('/') || redirect.startsWith('//')) return '/';
  try {
    const parsed = new URL(redirect, window.location.origin);
    return parsed.origin === window.location.origin
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : '/';
  } catch {
    return '/';
  }
};

/**
 * @see https://umijs.org/docs/api/runtime-config#getinitialstate
 * */
export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: AdminUser;
  loading?: boolean;
  fetchUserInfo?: () => Promise<AdminUser | undefined>;
}> {
  const fetchUserInfo = async (redirectOnFailure = true) => {
    try {
      const msg = await queryCurrentUser({
        skipErrorHandler: true,
      });
      const user = msg.data as AdminUser | undefined;
      if (user?.name && /^\?+$/.test(user.name.trim())) {
        return { ...user, name: '管理员' };
      }
      return user;
    } catch (error: any) {
      if (error?.response?.status === 403) {
        history.replace('/403');
      } else if (redirectOnFailure) {
        const { pathname, search, hash } = history.location;
        history.replace(
          `${loginPath}?redirect=${encodeURIComponent(pathname + search + hash)}`,
        );
      }
    }
    return undefined;
  };
  // 如果不是登录页面，执行
  const { location } = history;
  if (publicPaths.has(location.pathname)) {
    return {
      fetchUserInfo,
      settings: defaultSettings as Partial<LayoutSettings>,
    };
  }
  if (location.pathname === loginPath) {
    const currentUser = await fetchUserInfo(false);
    if (currentUser) {
      const redirect = new URLSearchParams(location.search).get('redirect');
      history.replace(
        authorizedRedirect(safeInternalRedirect(redirect), currentUser),
      );
    }
    return {
      fetchUserInfo,
      currentUser,
      settings: defaultSettings as Partial<LayoutSettings>,
    };
  }
  if (
    ![loginPath, '/user/register', '/user/register-result'].includes(
      location.pathname,
    )
  ) {
    const currentUser = await fetchUserInfo();
    if (currentUser && location.pathname === '/') {
      history.replace(homeForUser(currentUser));
    }
    return {
      fetchUserInfo,
      currentUser,
      settings: defaultSettings as Partial<LayoutSettings>,
    };
  }
  return {
    fetchUserInfo,
    settings: defaultSettings as Partial<LayoutSettings>,
  };
}

// ProLayout 支持的api https://procomponents.ant.design/components/layout
export const layout: RunTimeLayoutConfig = ({ initialState }) => {
  const rawUserName = initialState?.currentUser?.name?.trim();
  const displayUserName =
    rawUserName && !/^\?+$/.test(rawUserName) ? rawUserName : '管理员';
  const renderBrand = () => (
    <div className="jml-brand-logo-only">
      <img src={logo} alt="金米龙" />
    </div>
  );

  return {
    breadcrumbRender: (items) => {
      const groupName = menuGroupByPath[history.location.pathname];
      if (!groupName || !items?.length) return items;
      return [
        { title: groupName, path: history.location.pathname },
        items[items.length - 1],
      ];
    },
    menuItemRender: (item, dom) => {
      const content =
        item.path === '/system/approvals' ? (
          <ApprovalMenuLabel>{dom}</ApprovalMenuLabel>
        ) : (
          dom
        );
      if (item.path) {
        return (
          <Link to={item.path} prefetch>
            {content}
          </Link>
        );
      }
      return content;
    },
    actionsRender: () => [],
    avatarProps: {
      src: initialState?.currentUser?.avatar,
      title: displayUserName,
      render: (_, avatarChildren) => (
        <AvatarDropdown>{avatarChildren}</AvatarDropdown>
      ),
    },
    // waterMarkProps: {
    //   content: initialState?.currentUser?.name,
    // },
    footerRender: false,
    onPageChange: () => {
      const { location } = history;
      // 如果没有登录，重定向到 login
      if (
        !initialState?.currentUser &&
        ![loginPath, '/403'].includes(location.pathname) &&
        !publicPaths.has(location.pathname)
      ) {
        history.replace(
          `${loginPath}?redirect=${encodeURIComponent(location.pathname + location.search + location.hash)}`,
        );
      }
    },
    // Replace ProLayout's default ErrorBoundary with our offline-aware version,
    // so chunk load errors show friendly messages instead of "Something went wrong."
    ErrorBoundary,
    // 自定义 403 页面
    // unAccessible: <div>unAccessible</div>,
    // 增加一个 loading 的状态
    childrenRender: (children) => children,
    ...initialState?.settings,
    logo,
    menuHeaderRender: renderBrand,
  };
};

/**
 * @name request 配置，可以配置错误处理
 * 它基于 axios 提供了一套统一的网络请求和错误处理方案。
 * @doc https://umijs.org/docs/max/request#配置
 */
export const request: RequestConfig = {
  baseURL: '',
  withCredentials: true,
  ...errorConfig,
};

export function rootContainer(container: React.ReactNode) {
  return (
    <ThemeModeProvider>
      <OfflineBanner />
      <ErrorBoundary>{container}</ErrorBoundary>
    </ThemeModeProvider>
  );
}
