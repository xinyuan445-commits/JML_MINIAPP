import {
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { Helmet, useModel } from '@umijs/max';
import { Alert, App } from 'antd';
import { createStyles } from 'antd-style';
import React, { startTransition, useState } from 'react';
import { login } from '@/services/ant-design-pro/api';
import logo from '@/static/logo.jpg';
import { authorizedRedirect } from '@/utils/adminPermissions';

const useStyles = createStyles(({ token }) => ({
  container: {
    position: 'relative',
    display: 'flex',
    minHeight: '100dvh',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 32,
    background:
      'radial-gradient(circle at 12% 14%, rgba(42, 115, 204, 0.11), transparent 28%), radial-gradient(circle at 90% 85%, rgba(21, 69, 126, 0.09), transparent 30%), #eef3f8',
    '&::before': {
      position: 'absolute',
      top: -190,
      right: -130,
      width: 460,
      height: 460,
      border: '1px solid rgba(28, 92, 164, 0.08)',
      borderRadius: '50%',
      boxShadow:
        '0 0 0 70px rgba(28, 92, 164, 0.025), 0 0 0 140px rgba(28, 92, 164, 0.018)',
      content: '""',
    },
    '@media (max-width: 820px)': {
      padding: 20,
    },
    '@media (max-width: 480px)': {
      alignItems: 'stretch',
      padding: 0,
      background: '#fff',
    },
  },
  shell: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    width: 980,
    maxWidth: '100%',
    minHeight: 570,
    gridTemplateColumns: '1.06fr 0.94fr',
    overflow: 'hidden',
    border: '1px solid rgba(30, 61, 95, 0.08)',
    borderRadius: 24,
    background: token.colorBgContainer,
    boxShadow: '0 28px 80px rgba(34, 61, 91, 0.16)',
    '@media (max-width: 820px)': {
      width: 450,
      minHeight: 0,
      gridTemplateColumns: '1fr',
      borderRadius: 20,
    },
    '@media (max-width: 480px)': {
      width: '100%',
      minHeight: '100dvh',
      border: 0,
      borderRadius: 0,
      boxShadow: 'none',
    },
  },
  brandPanel: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    overflow: 'hidden',
    padding: '54px 56px 50px',
    color: '#fff',
    background:
      'linear-gradient(145deg, #0c2e52 0%, #154b7f 58%, #1b65a5 100%)',
    '&::before': {
      position: 'absolute',
      right: -100,
      bottom: -130,
      width: 390,
      height: 390,
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: '50%',
      boxShadow:
        '0 0 0 54px rgba(255, 255, 255, 0.035), 0 0 0 108px rgba(255, 255, 255, 0.025)',
      content: '""',
    },
    '@media (max-width: 820px)': {
      display: 'none',
    },
  },
  logoPlate: {
    position: 'relative',
    zIndex: 1,
    display: 'inline-flex',
    width: 286,
    maxWidth: '100%',
    alignItems: 'center',
    padding: '10px 14px',
    borderRadius: 12,
    background: '#fff',
    boxShadow: '0 10px 30px rgba(2, 18, 38, 0.16)',
    '& img': {
      display: 'block',
      width: '100%',
      height: 'auto',
    },
  },
  brandContent: {
    position: 'relative',
    zIndex: 1,
    marginTop: 52,
  },
  eyebrow: {
    marginBottom: 16,
    color: 'rgba(255, 255, 255, 0.68)',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.16em',
  },
  brandTitle: {
    margin: 0,
    color: '#fff',
    fontSize: 38,
    fontWeight: 650,
    letterSpacing: '-0.02em',
    lineHeight: 1.28,
  },
  brandDescription: {
    maxWidth: 390,
    margin: '22px 0 0',
    color: 'rgba(255, 255, 255, 0.74)',
    fontSize: 16,
    lineHeight: 1.8,
  },
  featureList: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    marginTop: 44,
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  featureItem: {
    padding: '14px 12px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    color: 'rgba(255, 255, 255, 0.76)',
    fontSize: 13,
    textAlign: 'center',
    background: 'rgba(255, 255, 255, 0.06)',
    backdropFilter: 'blur(6px)',
  },
  formPanel: {
    display: 'flex',
    minWidth: 0,
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '58px 58px 48px',
    background: '#fff',
    '@media (max-width: 820px)': {
      padding: '42px 38px 34px',
    },
    '@media (max-width: 480px)': {
      justifyContent: 'center',
      padding: '36px 26px 28px',
    },
  },
  mobileLogo: {
    display: 'none',
    '@media (max-width: 820px)': {
      display: 'block',
      width: 230,
      maxWidth: '82%',
      marginBottom: 38,
    },
  },
  formEyebrow: {
    marginBottom: 10,
    color: '#286aa7',
    fontSize: 13,
    fontWeight: 650,
    letterSpacing: '0.12em',
  },
  formTitle: {
    margin: 0,
    color: '#172b3f',
    fontSize: 32,
    fontWeight: 650,
    lineHeight: 1.3,
    '@media (max-width: 480px)': {
      fontSize: 28,
    },
  },
  formDescription: {
    margin: '12px 0 34px',
    color: '#788a9b',
    fontSize: 14,
  },
  loginForm: {
    width: '100%',
    overflow: 'hidden',
    '& .ant-pro-form-login-container': {
      width: '100%',
    },
    '& .ant-pro-form-login-main': {
      width: '100% !important',
      minWidth: '0 !important',
      maxWidth: 'none !important',
    },
    '& .ant-form-item': {
      marginBottom: 20,
    },
    '& .ant-input-affix-wrapper': {
      minHeight: 48,
      paddingInline: 15,
      borderColor: '#dce4ec',
      borderRadius: 10,
      background: '#f8fafc',
      transition: 'all 0.2s ease',
    },
    '& .ant-input-affix-wrapper:hover, & .ant-input-affix-wrapper-focused': {
      borderColor: '#2f74b5',
      background: '#fff',
      boxShadow: '0 0 0 3px rgba(47, 116, 181, 0.1)',
    },
    '& .ant-input-prefix': {
      marginInlineEnd: 10,
      color: '#7a8c9e',
    },
    '& .ant-btn-primary': {
      height: 48,
      marginTop: 6,
      borderRadius: 10,
      fontSize: 15,
      fontWeight: 600,
      boxShadow: '0 8px 20px rgba(38, 105, 170, 0.24)',
    },
  },
  securityNote: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    color: '#91a0ae',
    fontSize: 12,
    gap: 7,
  },
  footer: {
    marginTop: 40,
    color: '#a1adba',
    fontSize: 12,
    textAlign: 'center',
  },
}));

const LoginMessage: React.FC<{ content: string }> = ({ content }) => (
  <Alert style={{ marginBottom: 24 }} title={content} type="error" showIcon />
);

const safeRedirect = (redirect: string | null): string => {
  if (!redirect?.startsWith('/') || redirect.startsWith('//')) return '/';
  try {
    const parsed = new URL(redirect, window.location.origin);
    if (parsed.origin !== window.location.origin) return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
};

const Login: React.FC = () => {
  const [loginError, setLoginError] = useState('');
  const { initialState, setInitialState } = useModel('@@initialState');
  const { styles } = useStyles();
  const { message } = App.useApp();

  const fetchUserInfo = async () => {
    const userInfo = await initialState?.fetchUserInfo?.();
    if (userInfo) {
      startTransition(() => {
        setInitialState((state) => ({ ...state, currentUser: userInfo }));
      });
    }
    return userInfo;
  };

  const handleSubmit = async (values: API.LoginParams) => {
    setLoginError('');
    try {
      const result = await login({ ...values, type: 'account' });
      if (result.status !== 'ok') {
        setLoginError('用户名或密码错误');
        return;
      }
      const userInfo = await fetchUserInfo();
      if (!userInfo) {
        setLoginError('登录状态建立失败，请重试');
        return;
      }
      message.success('登录成功');
      const redirect = new URL(window.location.href).searchParams.get(
        'redirect',
      );
      window.location.href = authorizedRedirect(safeRedirect(redirect), userInfo);
    } catch {
      setLoginError('登录失败，请检查后台服务是否正常');
    }
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>登录 - 金米龙生产管理</title>
      </Helmet>
      <div className={styles.shell}>
        <section className={styles.brandPanel}>
          <div className={styles.logoPlate}>
            <img alt="金米龙" src={logo} />
          </div>
          <div className={styles.brandContent}>
            <div className={styles.eyebrow}>JINMILONG PRODUCTION</div>
            <h1 className={styles.brandTitle}>
              让生产进度
              <br />
              清晰、准确、可追溯
            </h1>
            <p className={styles.brandDescription}>
              统一管理生产工单、工艺路线、现场报工与生产数据，让每个环节都有记录。
            </p>
          </div>
          <div className={styles.featureList}>
            <div className={styles.featureItem}>工单管理</div>
            <div className={styles.featureItem}>工序报工</div>
            <div className={styles.featureItem}>数据追溯</div>
          </div>
        </section>

        <main className={styles.formPanel}>
          <img className={styles.mobileLogo} alt="金米龙" src={logo} />
          <div className={styles.formEyebrow}>生产管理平台</div>
          <h2 className={styles.formTitle}>欢迎登录</h2>
          <p className={styles.formDescription}>请输入账号和密码进入管理后台</p>
          <div className={styles.loginForm}>
            <LoginForm
              onFinish={handleSubmit}
              submitter={{
                searchConfig: { submitText: '登录系统' },
                submitButtonProps: { block: true, size: 'large' },
              }}
            >
              {loginError && <LoginMessage content={loginError} />}
              <ProFormText
                name="username"
                fieldProps={{
                  autoComplete: 'username',
                  size: 'large',
                  prefix: <UserOutlined />,
                }}
                placeholder="请输入用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              />
              <ProFormText.Password
                name="password"
                fieldProps={{
                  autoComplete: 'current-password',
                  size: 'large',
                  prefix: <LockOutlined />,
                }}
                placeholder="请输入密码"
                rules={[{ required: true, message: '请输入密码' }]}
              />
            </LoginForm>
          </div>
          <div className={styles.securityNote}>
            <SafetyCertificateOutlined />
            仅限授权人员使用
          </div>
          <div className={styles.footer}>金米龙集团 · 生产运营数字化管理</div>
        </main>
      </div>
    </div>
  );
};

export default Login;
