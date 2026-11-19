import type { ProLayoutProps } from '@ant-design/pro-components';

const Settings: ProLayoutProps & {
  logo?: string;
} = {
  navTheme: 'light',
  colorPrimary: '#2457d6',
  layout: 'side',
  menu: { autoClose: false },
  contentWidth: 'Fluid',
  fixedHeader: true,
  fixSiderbar: true,
  siderWidth: 216,
  colorWeak: false,
  title: '金米龙生产管理',
  iconfontUrl: '',
  token: {
    header: {
      colorBgHeader: 'var(--jml-header-bg)',
      heightLayoutHeader: 64,
    },
    sider: {
      colorMenuBackground: 'var(--jml-sider-bg)',
      colorTextMenu: 'var(--jml-sider-text)',
      colorTextMenuSelected: 'var(--jml-sider-selected-text)',
      colorBgMenuItemSelected: 'var(--jml-sider-selected-bg)',
      colorTextMenuActive: 'var(--jml-sider-selected-text)',
      colorTextMenuItemHover: 'var(--jml-sider-selected-text)',
      colorBgMenuItemHover: 'var(--jml-sider-hover)',
    },
  },
};

export default Settings;
