import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const validPort = (value: string | undefined, fallback: number) => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535
    ? port
    : fallback;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = validPort(env.PORT, 8890);
  const apiTarget =
    env.DASHBOARD_API_MODE?.trim().toLowerCase() === 'external'
      ? env.DASHBOARD_API_TARGET?.trim() || 'http://127.0.0.1:5001'
      : `http://127.0.0.1:${validPort(env.DASHBOARD_API_PORT, 8891)}`;

  return {
    plugins: [react()],
    server: {
      host: env.HOST?.trim() || '0.0.0.0',
      port,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: env.HOST?.trim() || '0.0.0.0',
      port,
      strictPort: true,
    },
  };
});
