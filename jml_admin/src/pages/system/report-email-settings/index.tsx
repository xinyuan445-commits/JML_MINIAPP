import {
  CheckCircleFilled,
  ClockCircleOutlined,
  SendOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  TimePicker,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getReportEmailSettings,
  type ReportDeliverySettings,
  saveReportDeliverySettings,
  sendReportNow,
} from './service';
import styles from './index.less';

type ReportFormValues = Omit<
  ReportDeliverySettings,
  'send_time' | 'to_recipients' | 'cc_recipients' | 'bcc_recipients'
> & {
  send_time: Dayjs;
  to_recipients: string[];
  cc_recipients: string[];
  bcc_recipients: string[];
};

const weekOptions = ['一', '二', '三', '四', '五', '六', '日'].map(
  (label, index) => ({ label: `星期${label}`, value: index + 1 }),
);
const monthOptions = Array.from({ length: 28 }, (_, index) => ({
  label: `${index + 1}日`,
  value: index + 1,
}));
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const recipientSeparators = [',', ';', '，', '；', ' '];

const splitRecipients = (value: string) =>
  String(value || '')
    .split(/[,;；，\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const joinRecipients = (value?: string[]) => (value || []).join(';');

const scheduleText = (settings: ReportDeliverySettings) => {
  if (settings.send_mode === 'manual') return '仅手动';
  const time = settings.send_time || '08:00';
  if (settings.schedule_frequency === 'weekly') {
    const week =
      weekOptions.find((item) => item.value === settings.week_day)?.label ||
      '每周';
    return `${week} ${time}`;
  }
  if (settings.schedule_frequency === 'monthly') {
    return `每月${settings.month_day}日 ${time}`;
  }
  return `每天 ${time}`;
};

const statusMeta = (settings: ReportDeliverySettings) => {
  if (!settings.is_enabled) return { color: 'default', text: '已停用' };
  if (settings.last_send_status === 'failed')
    return { color: 'error', text: '发送异常' };
  return { color: 'success', text: '已启用' };
};

const renderTemplate = (value: string, reportName: string) =>
  String(value || '')
    .replaceAll('{report_name}', reportName)
    .replaceAll('{date}', dayjs().format('YYYY-MM-DD'))
    .replaceAll('{datetime}', dayjs().format('YYYY-MM-DD HH:mm'));

function RecipientInput({ placeholder }: { placeholder: string }) {
  return (
    <Select
      mode="tags"
      tokenSeparators={recipientSeparators}
      placeholder={placeholder}
      maxTagCount="responsive"
      notFoundContent={null}
      className={styles.recipientInput}
    />
  );
}

function ReportForm({
  settings,
  canManage,
  onSaved,
  onDirtyChange,
}: {
  settings: ReportDeliverySettings;
  canManage: boolean;
  onSaved: (value: ReportDeliverySettings) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<ReportFormValues>();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const enabled = Form.useWatch('is_enabled', form);
  const sendMode = Form.useWatch('send_mode', form);
  const frequency = Form.useWatch('schedule_frequency', form);
  const recipients = Form.useWatch('to_recipients', form) || [];
  const ccRecipients = Form.useWatch('cc_recipients', form) || [];
  const bccRecipients = Form.useWatch('bcc_recipients', form) || [];
  const subject = Form.useWatch('email_subject', form) || '';
  const body = Form.useWatch('email_body', form) || '';
  const meta = statusMeta(settings);

  useEffect(() => {
    form.setFieldsValue({
      ...settings,
      send_time: dayjs(settings.send_time, 'HH:mm'),
      to_recipients: splitRecipients(settings.to_recipients),
      cc_recipients: splitRecipients(settings.cc_recipients),
      bcc_recipients: splitRecipients(settings.bcc_recipients),
    });
    setDirty(false);
    onDirtyChange(false);
  }, [form, onDirtyChange, settings]);

  const persist = async (values: ReportFormValues, notify: boolean) => {
    setSaving(true);
    try {
      const saved = await saveReportDeliverySettings({
        ...settings,
        ...values,
        send_time: values.send_time.format('HH:mm'),
        to_recipients: joinRecipients(values.to_recipients),
        cc_recipients: joinRecipients(values.cc_recipients),
        bcc_recipients: joinRecipients(values.bcc_recipients),
      });
      onSaved(saved);
      setDirty(false);
      onDirtyChange(false);
      if (notify) message.success('发送配置已保存');
      return saved;
    } finally {
      setSaving(false);
    }
  };

  const save = async (values: ReportFormValues) => {
    try {
      await persist(values, true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    }
  };

  const sendNow = async () => {
    setSending(true);
    try {
      const values = await form.validateFields();
      const current = dirty ? await persist(values, false) : settings;
      const result = await sendReportNow(settings.report_key);
      onSaved({
        ...current,
        last_sent_time: result.sent_at,
        last_send_status: 'success',
        last_error: null,
      });
      message.success('报表邮件已发送');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const emailRules = [
    {
      validator: (_: unknown, value?: string[]) => {
        if (enabled && (!value || value.length === 0)) {
          return Promise.reject(new Error('请填写收件人'));
        }
        if ((value || []).some((item) => !emailPattern.test(item))) {
          return Promise.reject(new Error('存在无效邮箱'));
        }
        return Promise.resolve();
      },
    },
  ];

  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailHeader}>
        <div>
          <Space size={10} align="center">
            <Typography.Title level={4} className={styles.detailTitle}>
              {settings.report_name}
            </Typography.Title>
            <Tag color={meta.color}>{meta.text}</Tag>
          </Space>
          <Typography.Text type="secondary">
            {scheduleText(settings)}
          </Typography.Text>
        </div>
        {canManage && (
          <Space>
            <Button onClick={() => setPreviewOpen(true)}>邮件预览</Button>
            <Popconfirm
              title={
                dirty ? '保存当前配置并立即发送？' : '确认立即发送当前报表？'
              }
              disabled={!enabled || recipients.length === 0}
              onConfirm={() => void sendNow()}
            >
              <Button
                icon={<SendOutlined />}
                loading={sending}
                disabled={!enabled || recipients.length === 0}
              >
                {dirty ? '保存并发送' : '立即发送'}
              </Button>
            </Popconfirm>
            <Button
              type="primary"
              loading={saving}
              onClick={() => form.submit()}
            >
              保存
            </Button>
          </Space>
        )}
      </div>

      <Form<ReportFormValues>
        form={form}
        layout="vertical"
        disabled={!canManage}
        onFinish={(values) => void save(values)}
        onValuesChange={() => {
          setDirty(true);
          onDirtyChange(true);
        }}
        className={styles.reportForm}
      >
        <Card size="small" title="发送计划" className={styles.sectionCard}>
          <div className={styles.scheduleGrid}>
            <Form.Item
              name="is_enabled"
              label="任务状态"
              valuePropName="checked"
            >
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
            <Form.Item
              name="send_mode"
              label="发送方式"
              rules={[{ required: true }]}
            >
              <Segmented
                options={[
                  { label: '仅手动', value: 'manual' },
                  { label: '定时发送', value: 'scheduled' },
                ]}
              />
            </Form.Item>
            {sendMode === 'scheduled' && (
              <>
                <Form.Item
                  name="schedule_frequency"
                  label="发送周期"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={[
                      { label: '每天', value: 'daily' },
                      { label: '每周', value: 'weekly' },
                      { label: '每月', value: 'monthly' },
                    ]}
                  />
                </Form.Item>
                {frequency === 'weekly' && (
                  <Form.Item name="week_day" label="星期">
                    <Select options={weekOptions} />
                  </Form.Item>
                )}
                {frequency === 'monthly' && (
                  <Form.Item name="month_day" label="日期">
                    <Select options={monthOptions} />
                  </Form.Item>
                )}
                <Form.Item
                  name="send_time"
                  label="发送时间"
                  rules={[{ required: true }]}
                >
                  <TimePicker format="HH:mm" minuteStep={5} />
                </Form.Item>
              </>
            )}
          </div>
          {sendMode === 'scheduled' && (
            <div className={styles.scheduleSummary}>
              <ClockCircleOutlined />
              {settings.next_send_time
                ? `当前配置下次发送：${settings.next_send_time}`
                : '保存后将按当前周期自动发送'}
            </div>
          )}
        </Card>

        <Card size="small" title="收件设置" className={styles.sectionCard}>
          <Form.Item name="to_recipients" label="收件人" rules={emailRules}>
            <RecipientInput placeholder="输入邮箱后按回车" />
          </Form.Item>
          <Collapse
            ghost
            className={styles.moreRecipients}
            items={[
              {
                key: 'more',
                label: '抄送与密送',
                children: (
                  <div className={styles.recipientGrid}>
                    <Form.Item name="cc_recipients" label="抄送人">
                      <RecipientInput placeholder="输入抄送邮箱" />
                    </Form.Item>
                    <Form.Item name="bcc_recipients" label="密送人">
                      <RecipientInput placeholder="输入密送邮箱" />
                    </Form.Item>
                  </div>
                ),
              },
            ]}
          />
        </Card>

        <Card
          size="small"
          title="邮件内容"
          className={styles.sectionCard}
          extra={
            <Button type="link" onClick={() => setPreviewOpen(true)}>
              预览
            </Button>
          }
        >
          <Form.Item
            name="email_subject"
            label="邮件主题"
            rules={[{ required: true }]}
          >
            <Input maxLength={500} />
          </Form.Item>
          <Form.Item name="email_body" label="邮件正文">
            <Input.TextArea rows={8} maxLength={10000} />
          </Form.Item>
          <Space size={6} wrap>
            <Typography.Text type="secondary">可用变量</Typography.Text>
            <Tag>{'{report_name}'}</Tag>
            <Tag>{'{date}'}</Tag>
            <Tag>{'{datetime}'}</Tag>
          </Space>
        </Card>

        <Card size="small" className={styles.lastSendCard}>
          <div className={styles.lastSendRow}>
            <div>
              <Typography.Text strong>最近发送</Typography.Text>
              <div className={styles.lastSendTime}>
                {settings.last_sent_time || '尚未发送'}
              </div>
            </div>
            {settings.last_send_status === 'success' && (
              <Tag icon={<CheckCircleFilled />} color="success">
                发送成功
              </Tag>
            )}
            {settings.last_send_status === 'failed' && (
              <Tag icon={<WarningFilled />} color="error">
                发送失败
              </Tag>
            )}
          </div>
          {settings.last_send_status === 'failed' && settings.last_error && (
            <Alert
              type="error"
              showIcon
              message={settings.last_error}
              className={styles.sendError}
            />
          )}
        </Card>
      </Form>

      <Modal
        title="邮件预览"
        open={previewOpen}
        footer={null}
        width={720}
        onCancel={() => setPreviewOpen(false)}
      >
        <div className={styles.previewMeta}>
          <span>收件人</span>
          <strong>{recipients.join('；') || '—'}</strong>
          <span>抄送</span>
          <strong>{ccRecipients.join('；') || '—'}</strong>
          <span>密送</span>
          <strong>{bccRecipients.join('；') || '—'}</strong>
          <span>主题</span>
          <strong>
            {renderTemplate(subject, settings.report_name) || '—'}
          </strong>
        </div>
        <div className={styles.previewBody}>
          {renderTemplate(body, settings.report_name) || '（无正文）'}
        </div>
        <Tag color="blue">
          {settings.report_name}_{dayjs().format('YYYY-MM-DD')}.xlsx
        </Tag>
      </Modal>
    </div>
  );
}

export default function ReportEmailSettingsPage() {
  const { message, modal } = App.useApp();
  const access = useAccess();
  const canManage = access.can('report-email-settings.manage');
  const [reports, setReports] = useState<ReportDeliverySettings[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [dirtyReportKey, setDirtyReportKey] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getReportEmailSettings();
        setReports(data.reports);
        setSelectedKey(
          (current) => current || data.reports[0]?.report_key || '',
        );
      } catch (error) {
        message.error(error instanceof Error ? error.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [message]);

  useEffect(() => {
    if (!dirtyReportKey) return undefined;
    const preventLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventLeave);
    return () => window.removeEventListener('beforeunload', preventLeave);
  }, [dirtyReportKey]);

  const activeReport = useMemo(
    () => reports.find((item) => item.report_key === selectedKey) || reports[0],
    [reports, selectedKey],
  );
  const enabledCount = reports.filter((item) => item.is_enabled).length;
  const scheduledCount = reports.filter(
    (item) => item.is_enabled && item.send_mode === 'scheduled',
  ).length;
  const handleDirtyChange = useCallback(
    (dirty: boolean) => setDirtyReportKey(dirty ? selectedKey : ''),
    [selectedKey],
  );

  const selectReport = (reportKey: string) => {
    if (reportKey === selectedKey) return;
    if (!dirtyReportKey) {
      setSelectedKey(reportKey);
      return;
    }
    modal.confirm({
      title: '当前配置尚未保存',
      content: '切换报表将放弃本次修改。',
      okText: '放弃修改',
      cancelText: '继续编辑',
      okButtonProps: { danger: true },
      onOk: () => {
        setDirtyReportKey('');
        setSelectedKey(reportKey);
      },
    });
  };

  return (
    <PageContainer title="报表发送" className={styles.page}>
      <Card className={styles.serviceCard}>
        <div className={styles.serviceSummary}>
          <div className={styles.serviceIdentity}>
            <div className={styles.serviceIcon}>
              <SendOutlined />
            </div>
            <div>
              <Typography.Text strong>报表发送任务</Typography.Text>
              <div className={styles.serviceAccount}>
                每个报表单独维护发送计划和收件设置
              </div>
            </div>
          </div>
          <div className={styles.serviceStats}>
            <div>
              <strong>{reports.length}</strong>
              <span>报表任务</span>
            </div>
            <div>
              <strong>{enabledCount}</strong>
              <span>已启用</span>
            </div>
            <div>
              <strong>{scheduledCount}</strong>
              <span>定时发送</span>
            </div>
          </div>
        </div>
      </Card>

      <Spin spinning={loading}>
        <div className={styles.workspace}>
          <Card title="报表任务" className={styles.taskPanel}>
            <div className={styles.taskList}>
              {reports.map((item) => {
                const meta = statusMeta(item);
                const selected = item.report_key === activeReport?.report_key;
                return (
                  <button
                    type="button"
                    key={item.report_key}
                    className={`${styles.taskItem} ${selected ? styles.taskItemActive : ''}`}
                    onClick={() => selectReport(item.report_key)}
                  >
                    <div className={styles.taskNameRow}>
                      <span className={styles.taskName}>
                        {item.report_name}
                      </span>
                      <Tag color={meta.color}>{meta.text}</Tag>
                    </div>
                    <div className={styles.taskSchedule}>
                      {scheduleText(item)}
                    </div>
                    <div className={styles.taskLastSent}>
                      {item.next_send_time
                        ? `下次发送 ${item.next_send_time}`
                        : item.last_sent_time
                          ? `上次发送 ${item.last_sent_time}`
                          : '尚未发送'}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
          <Card className={styles.contentPanel}>
            {activeReport && (
              <ReportForm
                key={activeReport.report_key}
                settings={activeReport}
                canManage={canManage}
                onDirtyChange={handleDirtyChange}
                onSaved={(saved) =>
                  setReports((current) =>
                    current.map((row) =>
                      row.report_key === saved.report_key ? saved : row,
                    ),
                  )
                }
              />
            )}
          </Card>
        </div>
      </Spin>
    </PageContainer>
  );
}
