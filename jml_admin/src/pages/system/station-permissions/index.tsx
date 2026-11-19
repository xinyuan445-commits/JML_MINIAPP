import { PageContainer } from '@ant-design/pro-components';
import { useAccess, useModel } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import React, { useCallback, useEffect, useState } from 'react';
import { useViewportScrollHeight } from '@/hooks/useViewportScrollHeight';
import ExemptStaffCard from './ExemptStaffCard';
import StationProxyEditor from './StationProxyEditor';
import {
  getStationConfigurations,
  getStationProxies,
  getStationStaff,
  type ReportAccessMode,
  type StationConfiguration,
  type StationProxyConfiguration,
  type StationStaff,
  saveStationConfiguration,
  saveStationSetting,
} from './service';

dayjs.extend(utc);

type StaffForm = { leader_staff_id?: string; scanner_staff_ids: string[] };

const REPORT_ACCESS_OPTIONS: { label: string; value: ReportAccessMode }[] = [
  { label: '仅豁免人员', value: 'exempt' },
  { label: '工站授权人员', value: 'station' },
  { label: '全部有效员工', value: 'all' },
];

const personLabel = (person: StationStaff) =>
  `${person.name}${person.position ? ` · ${person.position}` : ''} · ${person.id.slice(-6)}`;

const names = (row: StationConfiguration) =>
  [
    row.station_name,
    row.station_code,
    row.leader?.name,
    ...row.scanners.map((person) => person.name),
  ]
    .filter(Boolean)
    .join(' ');

const personTag = (person: StationStaff) => (
  <Tag key={person.id} color={person.status === '1' ? 'blue' : 'warning'}>
    {person.name}
    {person.status !== '1' ? '（不可用）' : ''}
  </Tag>
);

export default function StationPermissionsPage() {
  const { scrollRef, scrollHeight } = useViewportScrollHeight();
  const access = useAccess();
  const { initialState } = useModel('@@initialState');
  const isGlobalAdmin = initialState?.currentUser?.username === 'admin';
  const canManage = access.can('station-permissions.manage');
  const { message, modal } = App.useApp();
  const [enforcement, setEnforcement] = useState(false);
  const [reportAccessMode, setReportAccessMode] =
    useState<ReportAccessMode>('exempt');
  const [settingRevision, setSettingRevision] = useState<number>();
  const [settingSaving, setSettingSaving] = useState(false);
  const [rows, setRows] = useState<StationConfiguration[]>([]);
  const [staff, setStaff] = useState<StationStaff[]>([]);
  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffReady, setStaffReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<StationConfiguration>();
  const [proxyRows, setProxyRows] = useState<StationProxyConfiguration[]>([]);
  const [proxyError, setProxyError] = useState('');
  const [proxyReady, setProxyReady] = useState(false);
  const [proxyEditing, setProxyEditing] = useState<{
    stationName: string;
    configuration: StationProxyConfiguration;
  }>();
  const [clock, setClock] = useState(Date.now());
  const [form] = Form.useForm<StaffForm>();

  const loadProxies = useCallback(async () => {
    try {
      const result = await getStationProxies();
      if (result.code !== 0) throw new Error(result.msg || '加载失败');
      setProxyRows(result.data);
      setProxyError('');
      setProxyReady(true);
    } catch {
      setProxyError('代理配置加载失败，请刷新重试。');
      setProxyReady(false);
    }
  }, []);
  useEffect(() => {
    void loadProxies();
    const timer = window.setInterval(() => {
      setClock(Date.now());
      void loadProxies();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadProxies]);
  const proxiesFor = (station: number) =>
    (proxyRows.find((row) => row.station_id === station)?.proxies || []).filter(
      (proxy) => dayjs(proxy.ends_at).valueOf() > clock,
    );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getStationConfigurations();
      if (result.code !== 0) throw new Error(result.msg || '加载失败');
      setRows(result.data.stations);
      if (isGlobalAdmin) {
        setEnforcement(Boolean(result.data.enforcement_enabled));
        setReportAccessMode(result.data.report_access_mode || 'exempt');
        setSettingRevision(result.data.setting_revision);
      }
    } catch {
      setError('工站配置加载失败，请刷新重试。');
    } finally {
      setLoading(false);
    }
  }, [isGlobalAdmin]);

  const loadStaff = async () => {
    setStaffLoading(true);
    setStaffReady(false);
    try {
      const result = await getStationStaff();
      if (result.code !== 0) throw new Error(result.msg || '加载失败');
      setStaff(result.data);
      setStaffReady(true);
    } catch {
      message.error('人员加载失败，请重试');
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const edit = (row: StationConfiguration) => {
    form.setFieldsValue({
      leader_staff_id: row.leader_staff_id || undefined,
      scanner_staff_ids: [...row.scanner_staff_ids],
    });
    setEditing(row);
    void loadStaff();
  };

  const options = new Map(
    staff.map((person) => [
      person.id,
      {
        value: person.id,
        label: personLabel(person),
        disabled: false,
      },
    ]),
  );
  const unavailableStaff = new Set<string>();
  for (const person of [editing?.leader, ...(editing?.scanners || [])]) {
    if (person && !options.has(person.id)) {
      if (staffReady) unavailableStaff.add(person.id);
      options.set(person.id, {
        value: person.id,
        label: `${personLabel(person)}（当前不可选）`,
        disabled: true,
      });
    }
  }
  const visible = rows.filter((row) =>
    `${names(row)} ${proxiesFor(row.id)
      .map((proxy) => proxy.person.name)
      .join(' ')}`
      .toLowerCase()
      .includes(keyword.trim().toLowerCase()),
  );

  const save = async () => {
    if (!editing || !canManage || !staffReady || staffLoading || saving) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await saveStationConfiguration({
        station_id: editing.id,
        leader_staff_id: values.leader_staff_id || null,
        scanner_staff_ids: values.scanner_staff_ids || [],
        revision: editing.revision,
      });
      message.success('配置已保存');
      setEditing(undefined);
      await load();
    } catch (saveError) {
      message.error(
        saveError instanceof Error ? saveError.message : '保存失败',
      );
    } finally {
      setSaving(false);
    }
  };

  const changeEnforcement = (enabled: boolean) => {
    if (!canManage || settingSaving || loading || settingRevision === undefined)
      return;
    modal.confirm({
      title: enabled ? '开启工站权限控制？' : '关闭工站权限控制？',
      content: enabled
        ? '请确认员工已更新小程序。未配置人员的工站仅豁免人员可操作。'
        : '关闭后不再限制工站操作人员。',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        setSettingSaving(true);
        try {
          await saveStationSetting({
            enabled,
            report_access_mode: reportAccessMode,
            revision: settingRevision,
          });
          message.success(enabled ? '已开启' : '已关闭');
          await load();
        } catch (saveError) {
          message.error(
            saveError instanceof Error ? saveError.message : '保存失败',
          );
          await load();
        } finally {
          setSettingSaving(false);
        }
      },
    });
  };

  const changeReportAccessMode = (mode: ReportAccessMode) => {
    if (
      mode === reportAccessMode ||
      !canManage ||
      settingSaving ||
      loading ||
      settingRevision === undefined
    )
      return;
    const label = REPORT_ACCESS_OPTIONS.find(
      (option) => option.value === mode,
    )?.label;
    modal.confirm({
      title: `报表开放范围改为“${label}”？`,
      content: '保存后小程序入口按新范围显示。',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        setSettingSaving(true);
        try {
          await saveStationSetting({
            enabled: enforcement,
            report_access_mode: mode,
            revision: settingRevision,
          });
          message.success('报表开放范围已保存');
          await load();
        } catch (saveError) {
          message.error(
            saveError instanceof Error ? saveError.message : '保存失败',
          );
          await load();
        } finally {
          setSettingSaving(false);
        }
      },
    });
  };

  return (
    <PageContainer title="工站权限">
      {isGlobalAdmin && (
        <>
          <Space wrap style={{ marginBottom: 16 }} size="large">
            <Space>
              <span>工站权限控制</span>
              <Switch
                checked={enforcement}
                checkedChildren="已开启"
                unCheckedChildren="已关闭"
                loading={settingSaving || loading}
                disabled={
                  !canManage || Boolean(error) || settingRevision === undefined
                }
                onChange={changeEnforcement}
              />
            </Space>
            <Space>
              <span>报表开放范围</span>
              <Select<ReportAccessMode>
                aria-label="报表开放范围"
                value={reportAccessMode}
                options={REPORT_ACCESS_OPTIONS}
                loading={settingSaving || loading}
                disabled={
                  !canManage || Boolean(error) || settingRevision === undefined
                }
                onChange={changeReportAccessMode}
                style={{ width: 160 }}
              />
            </Space>
          </Space>
          <ExemptStaffCard canManage={canManage} />
        </>
      )}
      {proxyError && (
        <Alert
          type="error"
          showIcon
          title={proxyError}
          style={{ marginBottom: 16 }}
        />
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          style={{ marginBottom: 16 }}
        />
      )}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          aria-label="搜索工站或人员"
          placeholder="搜索工站、线长、代理人或扫码员工"
          allowClear
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          style={{ width: 300, maxWidth: '100%' }}
        />
        <Button
          onClick={() => {
            void load();
            void loadProxies();
          }}
          loading={loading}
        >
          刷新
        </Button>
        <span>
          共 {rows.length} 个工站 ·{' '}
          {
            rows.filter(
              (row) =>
                row.leader || row.scanners.length || proxiesFor(row.id).length,
            ).length
          }{' '}
          个已配置人员
        </span>
      </Space>
      <div ref={scrollRef}>
        <Table<StationConfiguration>
          rowKey="id"
          loading={loading}
          dataSource={visible}
          scroll={{ x: 1250, y: scrollHeight }}
          pagination={{
            defaultPageSize: 30,
            showSizeChanger: true,
            pageSizeOptions: [10, 30, 50],
          }}
          columns={[
            {
              title: '工站',
              dataIndex: 'station_name',
              width: 220,
              render: (_, row) => (
                <Space wrap>
                  {row.station_name}
                  {!row.is_active && <Tag>工站已停用</Tag>}
                </Space>
              ),
            },
            {
              title: '线长',
              width: 160,
              render: (_, row) =>
                row.leader ? personTag(row.leader) : '待配置',
            },
            {
              title: '代理人 / 有效期',
              width: 300,
              render: (_, row) =>
                proxiesFor(row.id).length ? (
                  <Space orientation="vertical" size={4}>
                    {proxiesFor(row.id).map((proxy) => {
                      const end = dayjs(proxy.ends_at).valueOf();
                      const pending = dayjs(proxy.starts_at).valueOf() > clock;
                      const hours = Math.ceil((end - clock) / 3600000);
                      return (
                        <div key={proxy.id}>
                          <Tag
                            color={
                              proxy.person.status !== '1'
                                ? 'warning'
                                : pending
                                  ? 'default'
                                  : hours <= 24
                                    ? 'orange'
                                    : 'blue'
                            }
                          >
                            {proxy.person.name} ·{' '}
                            {proxy.person.status !== '1'
                              ? '不可用'
                              : pending
                                ? '未生效'
                                : hours > 24
                                  ? `剩余 ${Math.ceil(hours / 24)} 天`
                                  : `剩余 ${hours} 小时`}
                          </Tag>
                          <div>
                            {dayjs(proxy.starts_at)
                              .utcOffset(480)
                              .format('MM-DD HH:mm')}{' '}
                            至{' '}
                            {dayjs(proxy.ends_at)
                              .utcOffset(480)
                              .format('YYYY-MM-DD HH:mm')}
                          </div>
                        </div>
                      );
                    })}
                  </Space>
                ) : proxyReady ? (
                  '未配置'
                ) : (
                  '暂不可用'
                ),
            },
            {
              title: '扫码员工',
              render: (_, row) =>
                row.scanners.length ? (
                  <Space wrap>{row.scanners.map(personTag)}</Space>
                ) : (
                  '待配置'
                ),
            },
            {
              title: '最近保存',
              width: 185,
              render: (_, row) => row.update_time || '尚未保存',
            },
            {
              title: '操作',
              width: 190,
              render: (_, row) =>
                canManage ? (
                  <Space size={0}>
                    <Button
                      type="link"
                      disabled={loading || Boolean(error)}
                      onClick={() => edit(row)}
                    >
                      配置人员
                    </Button>
                    <Button
                      type="link"
                      disabled={!proxyReady || loading || Boolean(error)}
                      onClick={() =>
                        setProxyEditing({
                          stationName: row.station_name,
                          configuration: proxyRows.find(
                            (item) => item.station_id === row.id,
                          ) || { station_id: row.id, version: '', proxies: [] },
                        })
                      }
                    >
                      配置代理
                    </Button>
                  </Space>
                ) : (
                  '仅查看'
                ),
            },
          ]}
        />
      </div>
      <Modal
        title={`配置人员 · ${editing?.station_name || ''}`}
        open={Boolean(editing)}
        onCancel={() => {
          if (!saving) setEditing(undefined);
        }}
        onOk={() => void save()}
        okText="保存配置"
        cancelText="取消"
        confirmLoading={saving}
        okButtonProps={{ disabled: !canManage || staffLoading || !staffReady }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" disabled={saving}>
          <Form.Item label="线长" name="leader_staff_id">
            <Select
              allowClear
              showSearch={{ optionFilterProp: 'label' }}
              options={[...options.values()]}
              loading={staffLoading}
              placeholder="选择线长，可留空"
            />
          </Form.Item>
          <Form.Item
            label="扫码员工"
            name="scanner_staff_ids"
            extra="可以选择多人；同一员工可以配置到多个工站。"
          >
            <Select
              mode="multiple"
              allowClear
              showSearch={{ optionFilterProp: 'label' }}
              options={[...options.values()]}
              loading={staffLoading}
              placeholder="选择扫码员工，可留空"
            />
          </Form.Item>
          <Space wrap>
            <Button onClick={() => void loadStaff()} loading={staffLoading}>
              刷新人员
            </Button>
            {unavailableStaff.size > 0 && (
              <Button
                onClick={() => {
                  const values = form.getFieldsValue();
                  form.setFieldsValue({
                    leader_staff_id:
                      values.leader_staff_id &&
                      unavailableStaff.has(values.leader_staff_id)
                        ? undefined
                        : values.leader_staff_id,
                    scanner_staff_ids: (values.scanner_staff_ids || []).filter(
                      (id) => !unavailableStaff.has(id),
                    ),
                  });
                }}
              >
                移除不可用人员
              </Button>
            )}
            <span>人员来自 jml_staff；新增人员后点击刷新。</span>
          </Space>
          <p style={{ marginBottom: 0 }}>
            留空后保存可解除配置，不会删除员工或历史报工记录。
          </p>
        </Form>
      </Modal>
      {proxyEditing && (
        <StationProxyEditor
          stationName={proxyEditing.stationName}
          configuration={proxyEditing.configuration}
          onClose={() => setProxyEditing(undefined)}
          onSaved={loadProxies}
        />
      )}
    </PageContainer>
  );
}
