import { PageContainer } from '@ant-design/pro-components';
import { history, useAccess, useLocation } from '@umijs/max';
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Descriptions,
  Drawer,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Upload,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { announceApprovalChange } from '@/utils/approvalNotifications';
import { submitConfigApproval, updateConfigApproval } from '../service';
import {
  bases,
  capacityLabel,
  displayDecimal,
  periods,
  profileFields,
} from './model';
import {
  calculateCapacity,
  getApproval,
  getDetail,
  getEquipment,
  getOptions,
  previewCapacity,
  type Conversion,
  type EquipmentDetail,
  type EquipmentRow,
  type Options,
} from './service';

type Editor = {
  module: 'equipment' | 'equipment-capacity';
  row?: Record<string, any>;
};
const fieldLabels: Record<string, string> = {
  device_code: '设备编号',
  device_name: '设备名称',
  device_type: '设备类型',
  workshop: '所属车间',
  location: '安装位置',
  brand: '品牌',
  model: '型号',
  serial_no: '出厂编号',
  commissioned_on: '投用日期',
  remark: '备注',
};
const activeTag = (value: unknown) => (
  <Tag color={value ? 'green' : 'default'}>{value ? '启用' : '停用'}</Tag>
);
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : '操作失败，请重试';

function ConversionView({
  value,
  unit,
}: {
  value?: Conversion;
  unit?: string;
}) {
  if (!value || value.state === 'incomplete') return <span>待填写</span>;
  if (value.state !== 'finite')
    return (
      <span>
        {value.state === 'unlimited'
          ? '无限产能'
          : value.state === 'unconfigured'
            ? '未配置'
            : '已停用'}{' '}
        · 参考用时 —
      </span>
    );
  return (
    <Space wrap>
      <span>
        {displayDecimal(value.hourly)}
        {unit}/小时
      </span>
      <span>
        {displayDecimal(value.unit_minutes)}分钟/{unit}
      </span>
      {value.target_minutes !== null && (
        <span>参考加工用时 {displayDecimal(value.target_minutes)}分钟</span>
      )}
    </Space>
  );
}

export default function EquipmentPage() {
  const access = useAccess();
  const { message } = App.useApp();
  const location = useLocation();
  const [form] = Form.useForm();
  const [rows, setRows] = useState<EquipmentRow[]>([]);
  const [options, setOptions] = useState<Options>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [detail, setDetail] = useState<EquipmentDetail>();
  const [selected, setSelected] = useState<EquipmentRow>();
  const [tab, setTab] = useState('profile');
  const [editor, setEditor] = useState<Editor>();
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [preview, setPreview] = useState<Conversion>();
  const [previewError, setPreviewError] = useState('');
  const [targetQuantity, setTargetQuantity] = useState<string | null>(null);
  const [calculation, setCalculation] = useState<
    Conversion & { standard_id?: number | null }
  >();
  const [calcInput, setCalcInput] = useState<Record<string, any>>({});
  const [calculating, setCalculating] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<Record<string, any>>();
  const [historyRecord, setHistoryRecord] = useState<Record<string, any>>();
  const detailRequest = React.useRef(0);
  const saveLock = useRef(false);
  const previewRequest = useRef(0);
  const photoRequest = useRef(0);
  const calculationRequest = useRef(0);
  const watched = Form.useWatch([], { form, preserve: true });
  const changeCalculation = (patch: Record<string, any>) => {
    calculationRequest.current++;
    setCalcInput((previous) => ({ ...previous, ...patch }));
    setCalculation(undefined);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [newRows, newOptions] = await Promise.all([
        getEquipment(),
        getOptions(),
      ]);
      setRows(newRows);
      setOptions(newOptions);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const showDetail = async (row: EquipmentRow) => {
    const requestId = ++detailRequest.current;
    calculationRequest.current++;
    setSelected(row);
    setDetail(undefined);
    setDetailError('');
    setCalculation(undefined);
    setCalcInput({});
    try {
      const result = await getDetail(row.id);
      if (requestId === detailRequest.current) setDetail(result);
    } catch (err) {
      if (requestId === detailRequest.current) setDetailError(errorText(err));
    }
  };

  const beginEdit = (module: Editor['module'], row?: Record<string, any>) => {
    photoRequest.current++;
    const values = row?.approval_payload || row || {};
    form.resetFields();
    form.setFieldsValue(
      module === 'equipment'
        ? {
            device_type: '未分类',
            device_enabled: 1,
            ...values,
            device_id:
              values.new_device || !values.device_id
                ? '__new__'
                : values.device_id,
          }
        : {
            capacity_mode: 'finite',
            period: 'hour',
            basis: 'experience',
            is_active: 1,
            ...values,
            device_id: values.device_id || selected?.device_id,
          },
    );
    if (module === 'equipment') {
      const source = options?.devices.find((r) => r.id === values.device_id);
      form.setFieldValue('profile_revision', source?.profile?.revision || 0);
    }
    setTargetQuantity(null);
    setPreview(undefined);
    setPreviewError('');
    setEditor({ module, row });
  };

  useEffect(() => {
    if (!options) return;
    const approvalId = Number(
      new URLSearchParams(location.search).get('approval_id'),
    );
    if (!approvalId) return;
    let cancelled = false;
    getApproval(approvalId)
      .then(async (approval) => {
        if (cancelled) return;
        const values = approval.after_data;
        if (approval.module_type === 'equipment-capacity') {
          const binding = options.bindings.find(
            (r) => r.device_id === values.device_id,
          );
          const row = rows.find((r) => r.id === binding?.id);
          if (row) {
            setTab('capacity');
            await showDetail(row);
          }
        }
        if (cancelled) return;
        beginEdit(approval.module_type, {
          ...values,
          approval_payload: values,
          approval_status: approval.status,
          approval_id: approval.id,
          approval_revision: approval.revision,
          approval_action: approval.action_type,
          revision: approval.current_data?.revision ?? values.revision,
        });
        history.replace('/mo/equipment');
      })
      .catch((err) => {
        if (!cancelled) message.error(errorText(err));
      });
    return () => {
      cancelled = true;
    };
  }, [options, location.search]);

  useEffect(() => {
    const requestId = ++previewRequest.current;
    if (editor?.module !== 'equipment-capacity') return;
    setPreview(undefined);
    setPreviewError('');
    const timer = setTimeout(() => {
      const values = form.getFieldsValue();
      previewCapacity({
        capacity_mode: values.capacity_mode,
        quantity: values.quantity,
        unit: values.unit,
        period: values.period,
        effective_hours: values.effective_hours,
        target_quantity: targetQuantity || undefined,
      })
        .then((result) => {
          if (requestId === previewRequest.current) setPreview(result);
        })
        .catch((err) => {
          if (requestId === previewRequest.current)
            setPreviewError(errorText(err));
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [watched, targetQuantity, editor]);

  const save = async () => {
    if (!editor || saveLock.current) return;
    let values: Record<string, any>;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    saveLock.current = true;
    setSaving(true);
    try {
      const row = editor.row;
      const action = row?.approval_action || (row ? 'edit' : 'create');
      const payload: Record<string, any> = {
        ...values,
        ...(action !== 'create'
          ? { id: row?.id, revision: row?.revision }
          : {}),
      };
      if (editor.module === 'equipment-capacity')
        payload.device_id = values.device_id || selected?.device_id;
      if (editor.module === 'equipment') {
        payload.new_device = values.device_id === '__new__';
        if (payload.new_device)
          payload.device_id = row?.approval_payload?.new_device
            ? row.approval_payload.device_id
            : undefined;
      }
      if (
        editor.module === 'equipment-capacity' &&
        payload.capacity_mode === 'unlimited'
      ) {
        Object.assign(payload, {
          quantity: null,
          period: null,
          effective_hours: null,
        });
      }
      const result = row?.approval_id
        ? await updateConfigApproval(
            row.approval_id,
            row.approval_revision,
            payload,
          )
        : await submitConfigApproval(editor.module, action, payload);
      if (result.code !== 0) {
        message.error(result.msg || '提交失败');
        return;
      }
      message.success('申请已提交');
      announceApprovalChange();
      setEditor(undefined);
      await load();
      if (selected) await showDetail(selected);
    } catch (err) {
      message.error(errorText(err));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const changeStatus = async () => {
    if (!confirmStatus || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    try {
      const result = await submitConfigApproval(
        'equipment-capacity',
        'status',
        {
          id: confirmStatus.id,
          revision: confirmStatus.revision,
          is_active: confirmStatus.is_active ? 0 : 1,
        },
      );
      if (result.code !== 0) {
        message.error(result.msg || '提交失败');
        return;
      }
      setConfirmStatus(undefined);
      message.success('申请已提交');
      announceApprovalChange();
      await load();
      if (selected) await showDetail(selected);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const filtered = rows.filter((row) => {
    const searchable = [
      row.station_code,
      row.station_name,
      row.device_name,
      row.device_code,
    ]
      .join(' ')
      .toLowerCase();
    return (
      searchable.includes(keyword.trim().toLowerCase()) &&
      (!filters.type || row.device_type === filters.type) &&
      (!filters.workshop || row.workshop === filters.workshop) &&
      (filters.station === undefined ||
        Number(row.station_active) === filters.station) &&
      (filters.device === undefined ||
        Number(row.device_active) === filters.device) &&
      (filters.capacity === undefined ||
        Number(Number(row.capacity_count) > 0) === filters.capacity)
    );
  });
  const capacityProcesses =
    options?.processes
      .filter((row) => row.station_id === selected?.station_id)
      .filter(
        (row, index, all) =>
          all.findIndex((item) => item.id === row.id) === index,
      ) || [];
  const permissionFor = (module: Editor['module'], row?: Record<string, any>) =>
    access.can(
      module === 'equipment'
        ? row && row.approval_action !== 'create'
          ? 'equipment.edit'
          : 'equipment.add'
        : 'equipment-capacity.edit',
    );
  const pendingButton = (module: Editor['module'], row: Record<string, any>) =>
    row.approval_can_edit &&
    ['create', 'edit'].includes(row.approval_action) &&
    permissionFor(module, row) ? (
      <Button type="link" size="small" onClick={() => beginEdit(module, row)}>
        {row.approval_status === 'rejected' ? '修改并重提' : '修改申请'}
      </Button>
    ) : (
      <span>{row.approval_status === 'rejected' ? '已驳回' : '待审批'}</span>
    );
  const profile = detail;

  return (
    <PageContainer title="设备管理">
      {error && (
        <Alert
          type="error"
          title={error}
          action={<Button onClick={load}>重试</Button>}
        />
      )}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          aria-label="搜索设备"
          placeholder="工站或设备"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          allowClear
        />
        {[
          [
            'type',
            '设备类型',
            options?.types.map((value) => ({ value, label: value })),
          ],
          [
            'workshop',
            '车间',
            options?.workshops.map((value) => ({ value, label: value })),
          ],
          [
            'station',
            '工站状态',
            [
              { value: 1, label: '工站启用' },
              { value: 0, label: '工站停用' },
            ],
          ],
          [
            'device',
            '设备状态',
            [
              { value: 1, label: '设备启用' },
              { value: 0, label: '设备停用' },
            ],
          ],
          [
            'capacity',
            '产能配置',
            [
              { value: 1, label: '已配置' },
              { value: 0, label: '未配置' },
            ],
          ],
        ].map(([key, label, values]) => (
          <Select
            key={String(key)}
            aria-label={String(label)}
            placeholder={String(label)}
            style={{ minWidth: 120 }}
            allowClear
            options={values as any[]}
            onChange={(value) =>
              setFilters((previous) => ({ ...previous, [String(key)]: value }))
            }
          />
        ))}
        <Button onClick={load} loading={loading}>
          刷新
        </Button>
        {access.can('equipment.add') && (
          <Button
            type="primary"
            disabled={!options}
            onClick={() => beginEdit('equipment')}
          >
            新增档案
          </Button>
        )}
      </Space>
      <Table<EquipmentRow>
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        scroll={{ x: 1200 }}
        columns={[
          {
            title: '工站',
            key: 'station',
            render: (_, row) => (
              <div>
                {row.station_name ||
                  options?.stations.find((s) => s.id === row.station_id)
                    ?.station_name}
                <div>{row.station_code}</div>
              </div>
            ),
          },
          {
            title: '设备',
            dataIndex: 'device_name',
            render: (_, row) =>
              row.id > 0 ? (
                <Button
                  type="link"
                  onClick={() => {
                    setTab('profile');
                    void showDetail(row);
                  }}
                >
                  {row.device_name}
                </Button>
              ) : (
                row.device_name
              ),
          },
          {
            title: '设备编号',
            dataIndex: 'device_code',
            render: (value) => value || '未登记',
          },
          { title: '类型', dataIndex: 'device_type' },
          { title: '车间', dataIndex: 'workshop' },
          { title: '型号', dataIndex: 'model' },
          {
            title: '工站状态',
            dataIndex: 'station_active',
            render: (value, row) => (row.id > 0 ? activeTag(value) : '—'),
          },
          { title: '设备状态', dataIndex: 'device_active', render: activeTag },
          {
            title: '产能配置',
            dataIndex: 'capacity_count',
            render: (value, row) =>
              row.id < 0 ? '—' : value ? `已配置${value}条` : '未配置',
          },
          {
            title: '申请状态',
            dataIndex: 'approval_status',
            render: (value) =>
              value ? (
                <Tag color={value === 'rejected' ? 'error' : 'processing'}>
                  {value === 'rejected' ? '已驳回' : '待审批'}
                </Tag>
              ) : (
                '—'
              ),
          },
          {
            title: '操作',
            key: 'actions',
            render: (_, row) =>
              row.approval_status
                ? pendingButton('equipment', row)
                : (
                    <Space size={0}>
                      {access.can('equipment.edit') && (
                        <Button
                          type="link"
                          onClick={() =>
                            beginEdit('equipment', {
                              ...options?.devices.find(
                                (d) => d.id === row.device_id,
                              )?.profile,
                              ...row,
                            })
                          }
                        >
                          编辑档案
                        </Button>
                      )}
                      {row.id > 0 && access.can('equipment-capacity.edit') && (
                        <Button
                          type="link"
                          onClick={() => {
                            setTab('capacity');
                            void showDetail(row);
                          }}
                        >
                          产能设置
                        </Button>
                      )}
                    </Space>
                  ),
          },
        ]}
      />

      <Drawer
        title={selected?.device_name || '设备详情'}
        open={!!selected}
        size={960}
        onClose={() => {
          ++detailRequest.current;
          setSelected(undefined);
          setDetail(undefined);
        }}
      >
        {detailError ? (
          <Alert
            type="error"
            title={detailError}
            action={
              <Button onClick={() => selected && showDetail(selected)}>
                重试
              </Button>
            }
          />
        ) : !detail ? (
          '正在加载…'
        ) : (
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={[
              {
                key: 'profile',
                label: '设备档案',
                children: (
                  <>
                    <Descriptions
                      column={2}
                      items={[
                        {
                          key: 'station',
                          label: '工站',
                          children: selected?.station_name,
                        },
                        ...Object.entries(fieldLabels).map(([key, label]) => ({
                          key,
                          label,
                          children: String(profile?.[key] || '—'),
                        })),
                        {
                          key: 'station-status',
                          label: '工站状态',
                          children: activeTag(selected?.station_active),
                        },
                        {
                          key: 'device-status',
                          label: '设备状态',
                          children: activeTag(detail.device_enabled),
                        },
                      ]}
                    />
                    {profile?.photo && (
                      <Image width={200} src={profile.photo} alt="设备照片" />
                    )}
                    <Table
                      rowKey="id"
                      size="small"
                      style={{ marginTop: 20 }}
                      dataSource={detail.history.filter(
                        (row) => row.module_type === 'equipment',
                      )}
                      columns={[
                        { title: '生效时间', dataIndex: 'effective_at' },
                        { title: '审批人', dataIndex: 'approved_by' },
                        {
                          title: '变更',
                          key: 'change',
                          render: (_, row) => {
                            const before =
                              typeof row.before_data === 'string'
                                ? JSON.parse(row.before_data)
                                : row.before_data;
                            const after =
                              typeof row.after_data === 'string'
                                ? JSON.parse(row.after_data)
                                : row.after_data;
                            return (
                              <span>
                                {before
                                  ? `${before.device_name || before.device_id} → ${after.device_name || after.device_id}`
                                  : '建立档案'}
                              </span>
                            );
                          },
                        },
                        {
                          title: '操作',
                          key: 'detail',
                          render: (_, row) => (
                            <Button
                              type="link"
                              onClick={() => setHistoryRecord(row)}
                            >
                              查看
                            </Button>
                          ),
                        },
                      ]}
                    />
                  </>
                ),
              },
              ...(access.can('equipment-capacity.view')
                ? [
                    {
                      key: 'capacity',
                      label: '标准产能',
                      children: (
                        <>
                          {access.can('equipment-capacity.edit') && (
                            <Button
                              type="primary"
                              style={{ marginBottom: 12 }}
                              onClick={() => beginEdit('equipment-capacity')}
                            >
                              新增标准
                            </Button>
                          )}
                          <Table<Record<string, any>>
                            rowKey="id"
                            dataSource={detail.standards}
                            scroll={{ x: 900 }}
                            columns={[
                              {
                                title: '工序',
                                dataIndex: 'process_id',
                                render: (id) =>
                                  options?.processes.find((p) => p.id === id)
                                    ?.process_name || `工序#${id}`,
                              },
                              {
                                title: '类别',
                                dataIndex: 'category_code',
                                render: (code) =>
                                  code
                                    ? options?.categories.find(
                                        (c) => c.code === code,
                                      )?.name || code
                                    : '通用',
                              },
                              {
                                title: '标准产能',
                                key: 'capacity',
                                render: (_, row) => capacityLabel(row),
                              },
                              {
                                title: '有效工时',
                                dataIndex: 'effective_hours',
                                render: (value) =>
                                  value ? `${displayDecimal(value)}小时` : '—',
                              },
                              {
                                title: '配员',
                                dataIndex: 'staffing',
                                render: (value) => value || '—',
                              },
                              {
                                title: '依据',
                                dataIndex: 'basis',
                                render: (value) =>
                                  bases[value as keyof typeof bases],
                              },
                              {
                                title: '状态',
                                dataIndex: 'is_active',
                                render: (value, row) =>
                                  row.id < 0 ? '—' : activeTag(value),
                              },
                              {
                                title: '操作',
                                key: 'actions',
                                render: (_, row) =>
                                  row.approval_status
                                    ? pendingButton('equipment-capacity', row)
                                    : access.can('equipment-capacity.edit') && (
                                        <Space>
                                          <Button
                                            type="link"
                                            onClick={() =>
                                              beginEdit(
                                                'equipment-capacity',
                                                row,
                                              )
                                            }
                                          >
                                            编辑
                                          </Button>
                                          <Button
                                            type="link"
                                            onClick={() =>
                                              setConfirmStatus(row)
                                            }
                                          >
                                            {row.is_active ? '停用' : '启用'}
                                          </Button>
                                        </Space>
                                      ),
                              },
                            ]}
                            expandable={{
                              expandedRowRender: (row) => (
                                <Descriptions
                                  column={2}
                                  items={[
                                    {
                                      key: 'spec',
                                      label: '规格说明',
                                      children: row.specification || '—',
                                    },
                                    {
                                      key: 'setup',
                                      label: '换型准备',
                                      children:
                                        row.setup_minutes === null ||
                                        row.setup_minutes === undefined
                                          ? '未知'
                                          : `${displayDecimal(row.setup_minutes)}分钟/次`,
                                    },
                                    {
                                      key: 'measured',
                                      label: '测定日期',
                                      children: row.measured_on || '—',
                                    },
                                    {
                                      key: 'remark',
                                      label: '备注',
                                      children: row.remark || '—',
                                    },
                                    {
                                      key: 'conversion',
                                      label: '换算',
                                      children: (
                                        <ConversionView
                                          value={row.conversion}
                                          unit={row.unit}
                                        />
                                      ),
                                    },
                                    {
                                      key: 'history',
                                      label: '修订记录',
                                      children: detail.history
                                        .filter(
                                          (h) =>
                                            h.module_type ===
                                              'equipment-capacity' &&
                                            h.target_id === row.id,
                                        )
                                        .map((h) => (
                                          <div key={h.id}>
                                            {h.effective_at} · {h.approved_by} ·{' '}
                                            {capacityLabel(
                                              typeof h.after_data === 'string'
                                                ? JSON.parse(h.after_data)
                                                : h.after_data,
                                            )}
                                            <Button
                                              type="link"
                                              onClick={() =>
                                                setHistoryRecord(h)
                                              }
                                            >
                                              查看
                                            </Button>
                                          </div>
                                        )),
                                    },
                                  ]}
                                />
                              ),
                            }}
                          />
                          <Space wrap style={{ marginTop: 12 }}>
                            <Select
                              aria-label="计算工序"
                              placeholder="选择工序"
                              style={{ minWidth: 130 }}
                              options={capacityProcesses.map((p) => ({
                                value: p.id,
                                label: p.process_name,
                              }))}
                              onChange={(value) =>
                                changeCalculation({ process_id: value })
                              }
                            />
                            <Select
                              aria-label="计算类别"
                              placeholder="通用类别"
                              allowClear
                              style={{ minWidth: 130 }}
                              options={options?.categories.map((c) => ({
                                value: c.code,
                                label: c.name,
                              }))}
                              onChange={(value) =>
                                changeCalculation({
                                  category_code: value || '',
                                })
                              }
                            />
                            <InputNumber
                              aria-label="计算数量"
                              placeholder="计算数量"
                              stringMode
                              min="0.00000001"
                              onChange={(value) =>
                                changeCalculation({ quantity: value })
                              }
                            />
                            <Select
                              aria-label="计算单位"
                              placeholder="单位"
                              style={{ width: 100 }}
                              options={options?.units.map((value) => ({
                                value,
                                label: value,
                              }))}
                              onChange={(value) =>
                                changeCalculation({ unit: value })
                              }
                            />
                            <Button
                              loading={calculating}
                              disabled={
                                !calcInput.process_id ||
                                !calcInput.quantity ||
                                !calcInput.unit
                              }
                              onClick={async () => {
                                setCalculating(true);
                                setCalculation(undefined);
                                const requestId = ++calculationRequest.current;
                                try {
                                  const result = await calculateCapacity({
                                    ...calcInput,
                                    equipment_id: selected?.id,
                                  });
                                  if (requestId === calculationRequest.current)
                                    setCalculation(result);
                                } catch (err) {
                                  message.error(errorText(err));
                                } finally {
                                  setCalculating(false);
                                }
                              }}
                            >
                              换算
                            </Button>
                          </Space>
                          {calculation && (
                            <div style={{ marginTop: 12 }}>
                              <ConversionView
                                value={calculation}
                                unit={calcInput.unit}
                              />
                              {calculation.standard_id && (
                                <span> · 标准#{calculation.standard_id}</span>
                              )}
                              <div>仅计算加工时间</div>
                            </div>
                          )}
                        </>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </Drawer>

      <Modal
        title={editor?.module === 'equipment' ? '设备档案申请' : '标准产能申请'}
        open={!!editor}
        onCancel={() => {
          photoRequest.current++;
          setEditor(undefined);
        }}
        onOk={save}
        okText="提交申请"
        cancelText="取消"
        confirmLoading={saving}
        cancelButtonProps={{ disabled: saving }}
        closable={!saving}
        mask={{ closable: !saving }}
        keyboard={!saving}
        width={720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" disabled={saving}>
          {editor?.module === 'equipment' ? (
            <>
              <Form.Item
                name="station_id"
                label="对应工站"
                rules={[{ required: true }]}
              >
                <Select
                  showSearch={{ optionFilterProp: 'label' }}
                  onChange={(value) => {
                    if (form.getFieldValue('device_id') === '__new__') {
                      const station = options?.stations.find(
                        (s) => s.id === value,
                      );
                      form.setFieldsValue({
                        device_name: station?.station_name,
                        device_code: station
                          ? `EQ-${station.station_code}`
                          : undefined,
                      });
                    }
                  }}
                  options={options?.stations.map((s) => ({
                    value: s.id,
                    label: `${s.station_code} ${s.station_name}`,
                    disabled:
                      (!s.is_active && s.id !== editor.row?.station_id) ||
                      options.bindings.some(
                        (b) => b.station_id === s.id && b.id !== editor.row?.id,
                      ),
                  }))}
                />
              </Form.Item>
              <Form.Item
                name="device_id"
                label="关联设备"
                rules={[{ required: true }]}
              >
                <Select
                  showSearch={{ optionFilterProp: 'label' }}
                  options={[
                    { value: '__new__', label: '新建设备' },
                    ...(options?.devices.map((d) => ({
                      value: d.id,
                      label: `${d.name} · ${d.device_code || d.id}`,
                      disabled:
                        (String(d.enable) !== '1' &&
                          d.id !== editor.row?.device_id) ||
                        options.bindings.some(
                          (b) =>
                            b.device_id === d.id && b.id !== editor.row?.id,
                        ),
                    })) || []),
                  ]}
                  onChange={(value) => {
                    photoRequest.current++;
                    const source = options?.devices.find((d) => d.id === value);
                    const data = source?.profile || {};
                    for (const field of profileFields)
                      form.setFieldValue(field, data[field] ?? null);
                    const station = options?.stations.find(
                      (s) => s.id === form.getFieldValue('station_id'),
                    );
                    form.setFieldsValue({
                      device_code:
                        source?.device_code ||
                        (station ? `EQ-${station.station_code}` : undefined),
                      device_name: source?.name || station?.station_name,
                      device_enabled: data.device_enabled ?? 1,
                      device_type: data.device_type || '未分类',
                    });
                    form.setFieldValue('profile_revision', data.revision || 0);
                  }}
                />
              </Form.Item>
              <Form.Item name="profile_revision" hidden>
                <InputNumber />
              </Form.Item>
              {Object.entries(fieldLabels).map(([field, label]) => (
                <Form.Item
                  key={field}
                  name={field}
                  label={label}
                  rules={
                    ['device_type', 'device_code', 'device_name'].includes(
                      field,
                    )
                      ? [{ required: true, whitespace: true }]
                      : []
                  }
                >
                  {field === 'device_type' || field === 'workshop' ? (
                    <AutoComplete
                      options={(field === 'device_type'
                        ? options?.types
                        : options?.workshops
                      )?.map((value) => ({ value }))}
                      maxLength={100}
                    />
                  ) : field === 'remark' ? (
                    <Input.TextArea maxLength={1000} />
                  ) : (
                    <Input
                      type={field === 'commissioned_on' ? 'date' : 'text'}
                      maxLength={
                        field === 'location'
                          ? 255
                          : field === 'device_code'
                            ? 64
                            : 100
                      }
                    />
                  )}
                </Form.Item>
              ))}
              <Form.Item
                name="device_enabled"
                label="设备状态"
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { value: 1, label: '启用' },
                    { value: 0, label: '停用' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="photo" hidden>
                <Input />
              </Form.Item>
              <Upload
                accept="image/png,image/jpeg,image/webp"
                showUploadList={false}
                beforeUpload={(file) => {
                  if (file.size > 1024 * 1024) {
                    message.error('照片请控制在1MB以内');
                    return false;
                  }
                  const requestId = ++photoRequest.current;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (requestId === photoRequest.current)
                      form.setFieldValue('photo', reader.result);
                  };
                  reader.onerror = () => message.error('照片读取失败');
                  reader.readAsDataURL(file);
                  return false;
                }}
              >
                <Button>选择照片</Button>
              </Upload>
              {watched?.photo && (
                <Space style={{ marginTop: 8 }}>
                  <Image src={watched.photo} alt="设备照片预览" width={100} />
                  <Button
                    onClick={() => {
                      photoRequest.current++;
                      form.setFieldValue('photo', null);
                    }}
                  >
                    移除照片
                  </Button>
                </Space>
              )}
            </>
          ) : (
            <>
              <Form.Item name="device_id" hidden>
                <Input />
              </Form.Item>
              <Form.Item
                name="process_id"
                label="工序"
                rules={[{ required: true }]}
              >
                <Select
                  options={capacityProcesses.map((p) => ({
                    value: p.id,
                    label: p.process_name,
                  }))}
                />
              </Form.Item>
              <Form.Item name="category_code" label="产品类别">
                <Select
                  allowClear
                  placeholder="通用"
                  options={options?.categories.map((c) => ({
                    value: c.code,
                    label: c.name,
                  }))}
                />
              </Form.Item>
              <Form.Item name="specification" label="规格说明">
                <Input maxLength={255} />
              </Form.Item>
              <Form.Item
                name="capacity_mode"
                label="产能模式"
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { value: 'finite', label: '有限产能' },
                    { value: 'unlimited', label: '无限产能（不限制排产）' },
                  ]}
                  onChange={() => {
                    form.setFieldsValue({
                      quantity: null,
                      period: undefined,
                      effective_hours: null,
                    });
                  }}
                />
              </Form.Item>
              {watched?.capacity_mode === 'finite' && (
                <>
                  <Form.Item
                    name="quantity"
                    label="标准数量"
                    rules={[{ required: true }]}
                  >
                    <InputNumber
                      stringMode
                      min="0.00000001"
                      max="999999999999.99999999"
                      precision={8}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item
                    name="unit"
                    label="计量单位"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={options?.units.map((value) => ({
                        value,
                        label: value,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    name="period"
                    label="时间周期"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={Object.entries(periods).map(
                        ([value, label]) => ({ value, label }),
                      )}
                      onChange={() =>
                        form.setFieldValue('effective_hours', null)
                      }
                    />
                  </Form.Item>
                  {['day', 'shift'].includes(watched?.period) && (
                    <Form.Item
                      name="effective_hours"
                      label={
                        watched?.period === 'day'
                          ? '每天有效工时'
                          : '每班有效工时'
                      }
                      rules={[{ required: true }]}
                    >
                      <InputNumber
                        stringMode
                        min="0.000001"
                        max="24"
                        precision={6}
                        suffix="小时"
                      />
                    </Form.Item>
                  )}
                </>
              )}
              <Form.Item name="staffing" label="标准配员">
                <InputNumber min={1} max={100000} precision={0} suffix="人" />
              </Form.Item>
              <Form.Item name="setup_minutes" label="换型准备时间">
                <InputNumber
                  stringMode
                  min="0"
                  max="99999999"
                  precision={6}
                  suffix="分钟/次"
                  placeholder="未知可留空"
                />
              </Form.Item>
              <Form.Item
                name="basis"
                label="标准依据"
                rules={[{ required: true }]}
              >
                <Select
                  options={Object.entries(bases).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </Form.Item>
              <Form.Item name="measured_on" label="测定日期">
                <Input type="date" />
              </Form.Item>
              <Form.Item name="remark" label="备注">
                <Input.TextArea maxLength={1000} />
              </Form.Item>
              <Form.Item name="is_active" hidden>
                <InputNumber />
              </Form.Item>
              {watched?.capacity_mode === 'finite' && (
                <InputNumber
                  aria-label="预览数量"
                  placeholder="输入数量预览用时"
                  stringMode
                  min="0.00000001"
                  value={targetQuantity}
                  onChange={setTargetQuantity}
                />
              )}
              <div style={{ marginTop: 12 }}>
                {previewError ? (
                  <span>{previewError}</span>
                ) : (
                  <ConversionView value={preview} unit={watched?.unit} />
                )}
              </div>
            </>
          )}
        </Form>
      </Modal>
      <Modal
        title={confirmStatus?.is_active ? '提交停用申请？' : '提交启用申请？'}
        open={!!confirmStatus}
        onCancel={() => setConfirmStatus(undefined)}
        onOk={changeStatus}
        confirmLoading={saving}
        cancelButtonProps={{ disabled: saving }}
        closable={!saving}
      />
      <Modal
        title="变更记录"
        open={!!historyRecord}
        footer={null}
        width={720}
        onCancel={() => setHistoryRecord(undefined)}
      >
        {historyRecord &&
          (() => {
            const before =
              typeof historyRecord.before_data === 'string'
                ? JSON.parse(historyRecord.before_data)
                : historyRecord.before_data || {};
            const after =
              typeof historyRecord.after_data === 'string'
                ? JSON.parse(historyRecord.after_data)
                : historyRecord.after_data || {};
            const labels: Record<string, string> = {
              ...fieldLabels,
              device_name: '设备',
              device_enabled: '设备状态',
              station_name: '工站',
              process_id: '工序',
              category_code: '类别',
              specification: '规格说明',
              capacity_mode: '产能模式',
              quantity: '标准数量',
              unit: '单位',
              period: '时间周期',
              effective_hours: '有效工时',
              staffing: '标准配员',
              setup_minutes: '换型准备时间',
              basis: '标准依据',
              measured_on: '测定日期',
              is_active: '状态',
              photo: '照片',
            };
            const display = (field: string, value: any) => {
              if (value === undefined || value === null || value === '')
                return '—';
              if (field === 'photo')
                return <Image width={100} src={value} alt="历史设备照片" />;
              if (field === 'capacity_mode')
                return value === 'unlimited' ? '无限产能' : '有限产能';
              if (field === 'period')
                return periods[value as keyof typeof periods];
              if (field === 'basis') return bases[value as keyof typeof bases];
              if (field === 'is_active' || field === 'device_enabled')
                return value ? '启用' : '停用';
              if (field === 'category_code')
                return (
                  options?.categories.find((c) => c.code === value)?.name ||
                  value
                );
              if (field === 'process_id')
                return (
                  options?.processes.find((p) => p.id === value)
                    ?.process_name || value
                );
              return String(value);
            };
            return (
              <Table
                rowKey="field"
                pagination={false}
                size="small"
                dataSource={Object.entries(labels)
                  .filter(([field]) => field in after || field in before)
                  .map(([field, label]) => ({
                    field,
                    label,
                    before: display(field, before[field]),
                    after: display(field, after[field]),
                  }))}
                columns={[
                  { title: '项目', dataIndex: 'label' },
                  { title: '变更前', dataIndex: 'before' },
                  { title: '变更后', dataIndex: 'after' },
                ]}
              />
            );
          })()}
      </Modal>
    </PageContainer>
  );
}
