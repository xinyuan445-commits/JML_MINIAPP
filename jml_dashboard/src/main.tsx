import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { createRoot } from 'react-dom/client';
import Dashboard from './Dashboard';
import './global.css';

const root = document.getElementById('root');
if (!root) throw new Error('找不到看板页面挂载点');

createRoot(root).render(
  <ConfigProvider
    locale={zhCN}
    theme={{ token: { fontFamily: 'Microsoft YaHei, sans-serif' } }}
  >
    <Dashboard />
  </ConfigProvider>,
);
