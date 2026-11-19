import {
  AuditOutlined,
  MailOutlined,
  SendOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import styles from './index.less';
import {
  type ApprovalEmailSettings,
  type EmailServiceSettings,
  getApprovalEmailSettings,
  getEmailServiceSettings,
  saveApprovalEmailSettings,
  saveEmailServiceSettings,
  sendLatestApprovalEmail,
  sendWeeklyApprovalEmail,
  testEmailServiceSettings,
} from './service';

type EmailServiceFormValues = Pick<
  EmailServiceSettings,
  'smtp_server' | 'smtp_port' | 'smtp_user' | 'smtp_use_ssl'
> & {
  smtp_password?: string;
};

type ApprovalEmailFormValues = Pick<
  ApprovalEmailSettings,
  | 'instant_enabled'
  | 'weekly_enabled'
  | 'weekly_day'
  | 'weekly_time'
  | 'to_recipients'
  | 'cc_recipients'
  | 'bcc_recipients'
>;

const weekDays = [
  { label: '星期一', value: 1 },
  { label: '星期二', value: 2 },
  { label: '星期三', value: 3 },
  { label: '星期四', value: 4 },
  { label: '星期五', value: 5 },
  { label: '星期六', value: 6 },
  { label: '星期日', value: 7 },
];

export default function BasicSettingsPage() {
  const { message } = App.useApp();
  const access = useAccess();
  const canManage = access.can('basic-settings.manage');
  const [form] = Form.useForm<EmailServiceFormValues>();
  const [approvalForm] = Form.useForm<ApprovalEmailFormValues>();
  const [settings, setSettings] = useState<EmailServiceSettings>();
  const [approvalSettings, setApprovalSettings] =
    useState<ApprovalEmailSettings>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [approvalDrawerOpen, setApprovalDrawerOpen] = useState(false);
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [sendingLatest, setSendingLatest] = useState(false);
  const [sendingWeekly, setSendingWeekly] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [data, approvalData] = await Promise.all([
        getEmailServiceSettings(),
        getApprovalEmailSettings(),
      ]);
      setSettings(data);
      setApprovalSettings(approvalData);
      form.setFieldsValue({
        smtp_server: data.smtp_server,
        smtp_port: data.smtp_port,
        smtp_user: data.smtp_user,
        smtp_use_ssl: data.smtp_use_ssl,
        smtp_password: undefined,
      });
      approvalForm.setFieldsValue({
        instant_enabled: approvalData.instant_enabled,
        weekly_enabled: approvalData.weekly_enabled,
        weekly_day: approvalData.weekly_day,
        weekly_time: approvalData.weekly_time,
        to_recipients: approvalData.to_recipients,
        cc_recipients: approvalData.cc_recipients,
        bcc_recipients: approvalData.bcc_recipients,
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      const data = await saveEmailServiceSettings({
        ...values,
        revision: settings.revision,
      });
      setSettings(data);
      form.setFieldValue('smtp_password', undefined);
      message.success('邮件服务已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await testEmailServiceSettings();
      message.success('邮件服务连接正常');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '连接失败');
    } finally {
      setTesting(false);
    }
  };

  const saveApprovalSettings = async () => {
    if (!approvalSettings) throw new Error('审批邮件配置尚未加载');
    const values = await approvalForm.validateFields();
    const data = await saveApprovalEmailSettings({
      ...approvalSettings,
      ...values,
      revision: approvalSettings.revision,
    });
    setApprovalSettings(data);
    return data;
  };

  const handleApprovalSave = async () => {
    setApprovalSaving(true);
    try {
      await saveApprovalSettings();
      message.success('审批邮件已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setApprovalSaving(false);
    }
  };

  const handleSendLatest = async () => {
    setSendingLatest(true);
    try {
      await saveApprovalSettings();
      const result = await sendLatestApprovalEmail();
      message.success(`已发送 ${result.request_no}`);
      await loadSettings();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '发送失败');
    } finally {
      setSendingLatest(false);
    }
  };

  const handleSendWeekly = async () => {
    setSendingWeekly(true);
    try {
      await saveApprovalSettings();
      const result = await sendWeeklyApprovalEmail();
      message.success(`已发送，共 ${result.total} 条`);
      await loadSettings();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '发送失败');
    } finally {
      setSendingWeekly(false);
    }
  };

  return (
    <PageContainer title="基础配置" className={styles.page}>
      <Spin spinning={loading}>
        <section className={styles.settingGroup}>
          <div className={styles.groupHeader}>
            <Typography.Title level={5}>通信服务</Typography.Title>
            <Typography.Text type="secondary">
              系统消息的发送服务
            </Typography.Text>
          </div>

          <Card className={styles.settingCard}>
            <div className={styles.serviceSummary}>
              <div className={styles.serviceIdentity}>
                <span className={styles.serviceIcon}>
                  <MailOutlined />
                </span>
                <div>
                  <Space size={8}>
                    <Typography.Text strong>邮件服务</Typography.Text>
                    <Tag
                      color={
                        settings?.password_configured ? 'success' : 'warning'
                      }
                    >
                      {settings?.password_configured ? '已配置' : '待配置'}
                    </Tag>
                  </Space>
                  <div className={styles.serviceAccount}>
                    {settings?.smtp_user || '尚未填写发件账号'}
                  </div>
                </div>
              </div>

              <div className={styles.serviceMeta}>
                <span>{settings?.smtp_server || '未设置服务器'}</span>
                <span>
                  端口 {settings?.smtp_port || '-'} ·{' '}
                  {settings?.smtp_use_ssl ? 'SSL' : '非 SSL'}
                </span>
              </div>

              <Button
                icon={<SettingOutlined />}
                onClick={() => setDrawerOpen(true)}
              >
                {canManage ? '配置' : '查看'}
              </Button>
            </div>
          </Card>
        </section>

        <section className={styles.settingGroup}>
          <div className={styles.groupHeader}>
            <Typography.Title level={5}>业务通知</Typography.Title>
            <Typography.Text type="secondary">业务结果与定期清单</Typography.Text>
          </div>

          <Card className={styles.settingCard}>
            <div className={styles.serviceSummary}>
              <div className={styles.serviceIdentity}>
                <span className={styles.serviceIcon}>
                  <AuditOutlined />
                </span>
                <div>
                  <Space size={8}>
                    <Typography.Text strong>审批邮件</Typography.Text>
                    <Tag
                      color={
                        approvalSettings?.instant_enabled ||
                        approvalSettings?.weekly_enabled
                          ? 'success'
                          : 'default'
                      }
                    >
                      {approvalSettings?.instant_enabled ||
                      approvalSettings?.weekly_enabled
                        ? '自动发送已启用'
                        : '仅手动发送'}
                    </Tag>
                  </Space>
                  <div className={styles.serviceAccount}>
                    {approvalSettings?.to_recipients || '尚未填写收件人'}
                  </div>
                </div>
              </div>

              <div className={styles.serviceMeta}>
                <span>
                  审批通过：
                  {approvalSettings?.instant_enabled ? '自动发送' : '手动发送'}
                </span>
                <span>
                  每周清单：
                  {approvalSettings?.weekly_enabled
                    ? `${weekDays.find((item) => item.value === approvalSettings.weekly_day)?.label} ${approvalSettings.weekly_time}`
                    : '未启用'}
                </span>
              </div>

              <Button
                icon={<SettingOutlined />}
                onClick={() => setApprovalDrawerOpen(true)}
              >
                {canManage ? '配置' : '查看'}
              </Button>
            </div>
          </Card>
        </section>
      </Spin>

      <Drawer
        title="邮件服务"
        width={520}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose={false}
      >
        {!settings?.password_configured && (
          <Alert
            className={styles.statusAlert}
            type="warning"
            showIcon
            message="请先完成邮件服务配置"
          />
        )}

        <Form<EmailServiceFormValues>
          form={form}
          layout="vertical"
          disabled={!canManage}
        >
          <Form.Item
            label="SMTP 服务器"
            name="smtp_server"
            rules={[{ required: true, message: '请填写 SMTP 服务器' }]}
          >
            <Input placeholder="smtp.example.com" />
          </Form.Item>

          <div className={styles.drawerGrid}>
            <Form.Item
              label="SMTP 端口"
              name="smtp_port"
              rules={[{ required: true, message: '请填写 SMTP 端口' }]}
            >
              <InputNumber min={1} max={65535} precision={0} />
            </Form.Item>
            <Form.Item label="SSL" name="smtp_use_ssl" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
          </div>

          <Form.Item
            label="SMTP 账号"
            name="smtp_user"
            rules={[{ required: true, message: '请填写 SMTP 账号' }]}
          >
            <Input placeholder="mail@example.com" />
          </Form.Item>

          <Form.Item
            label="SMTP 密码"
            name="smtp_password"
            extra={
              settings?.password_configured ? '留空则保持当前密码' : undefined
            }
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          {canManage && (
            <Space>
              <Button type="primary" loading={saving} onClick={handleSave}>
                保存
              </Button>
              <Button
                loading={testing}
                disabled={!settings?.password_configured}
                onClick={handleTest}
              >
                测试连接
              </Button>
            </Space>
          )}
        </Form>

        {settings?.update_time && (
          <div className={styles.updatedMeta}>
            最近更新：{settings.updated_by || '-'} · {settings.update_time}
          </div>
        )}
      </Drawer>

      <Drawer
        title="审批邮件"
        width={560}
        open={approvalDrawerOpen}
        onClose={() => setApprovalDrawerOpen(false)}
        destroyOnClose={false}
      >
        <Form<ApprovalEmailFormValues>
          form={approvalForm}
          layout="vertical"
          disabled={!canManage}
        >
          <Form.Item
            label="收件人"
            name="to_recipients"
            rules={[{ required: true, message: '请填写收件人' }]}
            extra="多个邮箱用分号分隔"
          >
            <Input placeholder="name@example.com" />
          </Form.Item>

          <div className={styles.drawerGrid}>
            <Form.Item label="抄送人" name="cc_recipients">
              <Input placeholder="可不填" />
            </Form.Item>
            <Form.Item label="密送人" name="bcc_recipients">
              <Input placeholder="可不填" />
            </Form.Item>
          </div>

          <Card size="small" className={styles.ruleCard}>
            <div className={styles.ruleRow}>
              <div>
                <Typography.Text strong>审批通过后发送</Typography.Text>
                <div className={styles.ruleHint}>每次审批通过发送一封</div>
              </div>
              <Form.Item
                name="instant_enabled"
                valuePropName="checked"
                noStyle
              >
                <Switch />
              </Form.Item>
            </div>
          </Card>

          <Card size="small" className={styles.ruleCard}>
            <div className={styles.ruleRow}>
              <div>
                <Typography.Text strong>每周清单</Typography.Text>
                <div className={styles.ruleHint}>全部审批倒序，标记上一周</div>
              </div>
              <Form.Item
                name="weekly_enabled"
                valuePropName="checked"
                noStyle
              >
                <Switch />
              </Form.Item>
            </div>
            <div className={styles.scheduleGrid}>
              <Form.Item label="发送日期" name="weekly_day">
                <Select options={weekDays} />
              </Form.Item>
              <Form.Item label="发送时间" name="weekly_time">
                <Input type="time" />
              </Form.Item>
            </div>
          </Card>

          {canManage && (
            <>
              <Button
                type="primary"
                loading={approvalSaving}
                onClick={handleApprovalSave}
              >
                保存
              </Button>
              <div className={styles.manualActions}>
                <Typography.Text strong>手动发送</Typography.Text>
                <Space wrap>
                  <Button
                    icon={<SendOutlined />}
                    loading={sendingLatest}
                    onClick={handleSendLatest}
                  >
                    发送最近审批
                  </Button>
                  <Button
                    icon={<SendOutlined />}
                    loading={sendingWeekly}
                    onClick={handleSendWeekly}
                  >
                    发送每周清单
                  </Button>
                </Space>
              </div>
            </>
          )}
        </Form>

        {approvalSettings?.update_time && (
          <div className={styles.updatedMeta}>
            最近更新：{approvalSettings.updated_by || '-'} ·{' '}
            {approvalSettings.update_time}
          </div>
        )}
      </Drawer>
    </PageContainer>
  );
}
