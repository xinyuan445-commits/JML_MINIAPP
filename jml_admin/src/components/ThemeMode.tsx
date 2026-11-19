import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { theme as antdTheme, Button, ConfigProvider } from 'antd';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type ThemeMode = 'light' | 'dark';

type ThemeModeContextValue = {
  mode: ThemeMode;
  toggleMode: () => void;
};

const STORAGE_KEY = 'jml-admin-theme-v2';

const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'light',
  toggleMode: () => undefined,
});

const getInitialMode = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
};

export const useThemeMode = () => useContext(ThemeModeContext);

export const ThemeModeProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);

  useEffect(() => {
    document.documentElement.dataset.jmlTheme = mode;
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode((currentMode) => (currentMode === 'light' ? 'dark' : 'light'));
  }, []);

  const contextValue = useMemo(
    () => ({ mode, toggleMode }),
    [mode, toggleMode],
  );

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ConfigProvider
        variant="filled"
        theme={{
          algorithm:
            mode === 'dark'
              ? antdTheme.darkAlgorithm
              : antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: '#2457d6',
            borderRadius: 8,
            fontFamily:
              "AlibabaSans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeModeContext.Provider>
  );
};

export const ThemeModeButton: React.FC = () => {
  const { mode, toggleMode } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <Button
      type="text"
      className="jml-theme-toggle"
      icon={isDark ? <MoonOutlined /> : <SunOutlined />}
      onClick={toggleMode}
      title={`当前为${isDark ? '深色' : '浅色'}主题，点击切换`}
    >
      {isDark ? '深色主题' : '浅色主题'}
    </Button>
  );
};
