import { Link, useModel } from '@umijs/max';
import { App, Button, Card, Result, Space } from 'antd';
import { outLogin } from '@/services/ant-design-pro/api';
import { homeForUser } from '@/utils/adminPermissions';

export default function ForbiddenPage() {
  const { initialState } = useModel('@@initialState');
  const { message } = App.useApp();
  const home = homeForUser(initialState?.currentUser);
  return (
    <Card variant="borderless">
      <Result
        status="403"
        title="暂无访问权限"
        subTitle="当前账号没有此页面权限，请联系管理员分配角色。"
        extra={
          <Space>
            {home !== '/403' && (
              <Link to={home}>
                <Button type="primary">返回可访问页面</Button>
              </Link>
            )}
            <Button
              onClick={async () => {
                try {
                  const result = (await outLogin()) as {
                    data?: { authSource?: string; redirectUrl?: string };
                  };
                  window.location.assign(
                    result.data?.authSource === 'oidc'
                      ? result.data.redirectUrl || '/'
                      : '/user/login',
                  );
                } catch {
                  message.error('退出失败，请稍后重试');
                }
              }}
            >
              退出 / 切换账号
            </Button>
          </Space>
        }
      />
    </Card>
  );
}
