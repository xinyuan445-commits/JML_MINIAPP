import { PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ModalForm, ProFormSwitch, ProFormText, ProFormTextArea, ProTable } from '@ant-design/pro-components';
import { Alert, App, Button, Drawer, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag } from 'antd';
import { history, useAccess, useLocation } from '@umijs/max';
import React, { useEffect, useRef, useState } from 'react';
import { useViewportScrollHeight } from '@/hooks/useViewportScrollHeight';
import { announceApprovalChange } from '@/utils/approvalNotifications';
import {
  addRoute, createRouteVersion, getDepartments, getProcessList, getRouteDetail, getRouteList,
  getProductCategoryList, getRouteNextCode, getWorkstationList,
  getRouteVersionHistory, restoreRouteVersion, setRouteProcesses, toggleRoute, updateConfigApproval, updateRoute,
} from '../service';

type RouteItem = { id: number; route_code: string; route_name: string; dept_code: string; is_active: number; is_default: number; is_current?: number; version_no?: number; version_group?: string; version_note?: string; usage_count?: number; product_codes?: string[]; product_names?: string; approval_status?: 'pending' | 'rejected'; approval_id?: number; approval_action?: string; approval_payload?: Record<string, any>; approval_revision?: number; approval_can_edit?: boolean; };
type StepItem  = { seq: number; process_id: number; process_name: string; station_id: number | null; station_name: string; };

const RoutePage: React.FC = () => {
  const { message } = App.useApp();
  const access = useAccess();
  const { search } = useLocation();
  const requestedApprovalId = Number(new URLSearchParams(search).get('approval_id'));
  const actionRef = useRef<ActionType | undefined>(undefined);
  const { scrollRef, scrollHeight } = useViewportScrollHeight();
  const [editRow, setEditRow] = useState<RouteItem | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [depts, setDepts] = useState<{ code: string; name: string }[]>([]);
  const [productCategories, setProductCategories] = useState<{ code: string; name: string }[]>([]);
  const [routeList, setRouteList] = useState<RouteItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [showDisabled, setShowDisabled] = useState(false);
  const [deptWarning, setDeptWarning] = useState('');

  const [historyTarget, setHistoryTarget] = useState<RouteItem | null>(null);
  const [historyRows, setHistoryRows] = useState<RouteItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [drawerRoute, setDrawerRoute] = useState<RouteItem | undefined>();
  const [isNewRoute, setIsNewRoute] = useState(false);
  const [newRouteDraft, setNewRouteDraft] = useState<Record<string, any>>();
  const [versionSourceId, setVersionSourceId] = useState<number>();
  const [versionSourceSteps, setVersionSourceSteps] = useState<StepItem[]>([]);
  const [editingApproval, setEditingApproval] = useState<{ id: number; revision: number; resubmitting: boolean }>();
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [defaultChoiceOpen, setDefaultChoiceOpen] = useState(false);
  const defaultVersion = routeList.find(route =>
    route.version_group === drawerRoute?.version_group && route.is_current && route.is_active);

  useEffect(() => {
    getDepartments().then(r => { if (r.code === 0) setDepts(r.data); });
    getProductCategoryList().then(r => { if (r.code === 0) setProductCategories(r.data); });
    getRouteList(true, true).then(r => { if (r.code === 0) setRouteList(r.data); });
  }, []);

  useEffect(() => {
    if (drawerRoute) {
      if (!isNewRoute && !editingApproval) {
        getRouteDetail(drawerRoute.id).then(r => { if (r.code === 0) setSteps(r.data.steps || []); });
      }
      getProcessList().then(r => { if (r.code === 0) setProcesses(r.data); });
      getWorkstationList().then(r => { if (r.code === 0) setStations(r.data); });
    }
  }, [drawerRoute, isNewRoute, editingApproval]);

  const checkDeptWarning = (deptCode: string, isDefault: boolean) => {
    if (!deptCode) { setDeptWarning(''); return; }
    const existing = routeList.filter(r => r.dept_code === deptCode && (!editRow || r.id !== editRow.id));
    if (existing.length > 0 && !isDefault) {
      setDeptWarning(`该部门已有 ${existing.length} 条路线，建议勾选"是否默认"以明确默认路线`);
    } else {
      setDeptWarning('');
    }
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const next = [...steps];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    setSteps(next.map((s, i) => ({ ...s, seq: i + 1 })));
  };
  const drawerReadOnly = !isNewRoute && !editingApproval && (!access.can('route.edit') || !!drawerRoute?.usage_count);

  const editPendingRoute = (route: RouteItem) => {
    if (!route.approval_can_edit || !route.approval_id || !route.approval_revision) return;
    if (route.approval_action === 'edit' && route.approval_payload?.mode === 'steps') {
      setEditingApproval({ id: route.approval_id, revision: route.approval_revision, resubmitting: route.approval_status === 'rejected' });
      setIsNewRoute(false);
      setSteps(route.approval_payload.steps || []);
      setDrawerRoute(route);
      return;
    }
    setEditRow(route);
    setModalOpen(true);
  };

  const createNewVersion = async (route: RouteItem) => {
    if (!access.can('route.edit')) return;
    const res = await getRouteDetail(route.id);
    if (res.code !== 0) { message.error(res.msg || '路线工序加载失败'); return; }
    const copiedSteps = res.data.steps || [];
    setVersionSourceId(route.id);
    setVersionSourceSteps(copiedSteps);
    setNewRouteDraft(undefined);
    setEditingApproval(undefined);
    setSteps(copiedSteps);
    setIsNewRoute(true);
    setDrawerRoute({ ...route, ...res.data });
  };

  const openHistory = async (route: RouteItem) => {
    setHistoryTarget(route);
    setHistoryLoading(true);
    const res = await getRouteVersionHistory(route.id);
    setHistoryLoading(false);
    if (res.code === 0) setHistoryRows(res.data || []);
    else message.error(res.msg || '历史版本加载失败');
  };

  const submitSteps = async (setDefault?: boolean) => {
    if (!drawerRoute || saving) return;
    if (steps.length === 0) { message.warning('请至少添加一道工序'); return; }
    const missing = steps.findIndex(s => !s.station_id);
    if (missing !== -1) { message.warning(`第 ${missing + 1} 道工序未指定工站，工站为必填`); return; }
    if (versionSourceId) {
      const signature = (items: StepItem[]) => items.map(item => [item.process_id, item.station_id]);
      if (JSON.stringify(signature(steps)) === JSON.stringify(signature(versionSourceSteps))) {
        message.warning('请先调整工序后再提交新版本');
        return;
      }
      if (setDefault === undefined) {
        setDefaultChoiceOpen(true);
        return;
      }
    }
    setSaving(true);
    try {
      const res = editingApproval
        ? await updateConfigApproval(
            editingApproval.id,
            editingApproval.revision,
            isNewRoute
              ? { ...newRouteDraft, steps }
              : { ...drawerRoute.approval_payload, route_id: drawerRoute.id, mode: 'steps', steps },
          )
        : isNewRoute
          ? versionSourceId
            ? await createRouteVersion({ source_route_id: versionSourceId, steps, set_default: setDefault || !defaultVersion })
            : await addRoute({ ...newRouteDraft, steps })
          : await setRouteProcesses({ route_id: drawerRoute.id, steps });
      if (res.code === 0) {
        message.success(editingApproval?.resubmitting ? '申请已重新提交' : editingApproval ? '申请已修改' : '申请已提交');
        announceApprovalChange();
        setDefaultChoiceOpen(false);
        setDrawerRoute(undefined);
        setSteps([]);
        setIsNewRoute(false);
        setNewRouteDraft(undefined);
        setVersionSourceId(undefined);
        setVersionSourceSteps([]);
        setEditingApproval(undefined);
        actionRef.current?.reload();
      } else {
        message.error(res.msg || (editingApproval ? '修改失败' : '提交失败'));
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: ProColumns<RouteItem>[] = [
    { title: '路线名称', dataIndex: 'route_name', width: 160 },
    { title: '版本', dataIndex: 'version_no', width: 80, render: (_, r) => <Tag color="blue">V{r.version_no || 1}</Tag> },
    { title: '部门代码', dataIndex: 'dept_code', width: 120 },
    { title: '产品类别', dataIndex: 'product_names', width: 220, ellipsis: true, render: (_, r) => r.product_names || '-' },
    { title: '已使用', dataIndex: 'usage_count', width: 90, render: (_, r) => `${r.usage_count || 0} 个工单` },
    { title: '默认版本', dataIndex: 'is_current', width: 100, render: (_, r) => r.is_current ? <Tag color="blue">默认版本</Tag> : '-' },
    { title: '状态', dataIndex: 'is_active', width: 90, render: (_, r) => r.approval_status
      ? <Tag color={r.approval_status === 'pending' ? 'processing' : 'error'}>{r.approval_status === 'pending' ? '待审批' : '已驳回'}</Tag>
      : <Tag color={r.is_active ? 'green' : 'default'}>{r.is_active ? '启用' : '禁用'}</Tag> },
    {
      title: '操作', width: 290, valueType: 'option',
      render: (_, r) => r.approval_status ? [
        r.approval_can_edit && ['create', 'edit'].includes(r.approval_action || '')
          ? <a key="edit-request" onClick={() => editPendingRoute(r)}>{r.approval_status === 'rejected' ? '修改并重新提交' : '修改申请'}</a>
          : <span key="pending">审批中</span>,
      ] : [
        <a key="steps" onClick={() => setDrawerRoute(r)}>{r.usage_count || !access.can('route.edit') ? '查看工序' : '配置工序'}</a>,
        !access.can('route.edit') ? null : r.usage_count
          ? <a key="version" onClick={() => createNewVersion(r)}>新版本</a>
          : <a key="edit" onClick={() => { setEditRow(r); setModalOpen(true); }}>编辑</a>,
        <a key="history" onClick={() => openHistory(r)}>历史版本</a>,
        !r.is_current && access.can('route.restore') && <Popconfirm key="default"
          title={`将 V${r.version_no || 1} 设为默认版本？`}
          onConfirm={async () => {
            const res = await restoreRouteVersion({ id: r.id });
            if (res.code === 0) { message.success('设为默认版本申请已提交'); announceApprovalChange(); actionRef.current?.reload(); }
            else message.error(res.msg || '提交失败');
          }}><a>设为默认</a></Popconfirm>,
        access.can('route.toggle') && <Popconfirm key="toggle" title={r.is_active ? '确认提交禁用申请？' : '确认提交启用申请？'}
          onConfirm={async () => {
            const res = await toggleRoute({ id: r.id, is_active: r.is_active ? 0 : 1 });
            if (res.code === 0) { message.success('申请已提交'); announceApprovalChange(); actionRef.current?.reload(); }
            else message.error(res.msg || '提交失败');
          }}>
          <a>{r.is_active ? '禁用' : '启用'}</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <div ref={scrollRef}>
      <ProTable<RouteItem>
        headerTitle="工艺路线"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        params={{ keyword, showDisabled }}
        request={async ({ keyword: searchKeyword, showDisabled: includeDisabled }) => {
          const res = await getRouteList(true, true);
          const data = res.code === 0 ? res.data : [];
          setRouteList(data);
          const requested = data.find((row) => row.approval_id === requestedApprovalId);
          if (requested) {
            editPendingRoute(requested);
            history.replace('/mo/route');
          }
          const query = (searchKeyword || '').trim().toLowerCase();
          const filtered = data.filter((row) => {
            if (!includeDisabled && !row.is_active && !row.approval_status) return false;
            return [
              row.route_code, row.route_name, row.dept_code,
              depts.find((dept) => dept.code === row.dept_code)?.name,
              row.product_names, ...(row.product_codes || []),
            ].some((value) => String(value || '').toLowerCase().includes(query));
          });
          return { data: filtered, success: true };
        }}
        columns={columns}
        toolBarRender={() => [
          <Input.Search key="search" allowClear style={{ width: 320 }}
            placeholder="搜索路线名称、部门或产品类别"
            onSearch={(value) => {
              actionRef.current?.setPageInfo?.({ current: 1 });
              setKeyword(value);
            }} />,
          <label key="show-disabled" htmlFor="route-show-disabled" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch id="route-show-disabled" aria-label="显示禁用" size="small" checked={showDisabled}
              onChange={(checked) => {
                actionRef.current?.setPageInfo?.({ current: 1 });
                setShowDisabled(checked);
              }} />
            显示禁用
          </label>,
          access.can('route.add') && <Button key="add" type="primary" icon={<PlusOutlined />}
            onClick={() => { setEditRow(undefined); setDeptWarning(''); setModalOpen(true); }}>新增</Button>,
        ]}
        scroll={{ x: 1310, y: scrollHeight }}
      />
      </div>

      <ModalForm
        title={editRow?.approval_status === 'rejected' ? '修改并重新提交路线申请' : editRow?.approval_status ? '修改路线申请' : editRow ? '编辑路线申请' : '新增路线申请'}
        open={modalOpen}
        form={form}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={(v) => {
          if (!v) { setModalOpen(false); setEditRow(undefined); setDeptWarning(''); form.resetFields(); }
        }}
        initialValues={editRow ? {
          ...editRow,
          ...editRow.approval_payload,
          is_default: !!(editRow.approval_payload?.is_default ?? editRow.is_default),
        } : { is_default: false }}
        onFinishFailed={({ errorFields }) => {
          if (errorFields.some(({ name }) => name[0] === 'route_code')) {
            message.error('路线资料生成失败，请重新选择部门。');
          }
        }}
        onFinish={async (values) => {
          const { product_codes = [], ...routeValues } = values;
          const payload = { ...routeValues, is_default: values.is_default ? 1 : 0 };
          if (editRow?.approval_status) {
            const permission = editRow.approval_action === 'create' ? 'route.add' : 'route.edit';
            if (!access.can(permission) || !editRow.approval_id || !editRow.approval_revision) return false;
            const proposed = { ...editRow.approval_payload, ...payload, product_codes };
            if (editRow.approval_action === 'create') {
              setNewRouteDraft(proposed);
              setSteps(editRow.approval_payload?.steps || []);
              setEditingApproval({ id: editRow.approval_id, revision: editRow.approval_revision, resubmitting: editRow.approval_status === 'rejected' });
              setIsNewRoute(true);
              setDrawerRoute({ ...editRow, ...proposed });
              return true;
            }
            const res = await updateConfigApproval(editRow.approval_id, editRow.approval_revision, proposed);
            if (res.code === 0) {
              message.success(editRow.approval_status === 'rejected' ? '申请已重新提交' : '申请已修改');
              announceApprovalChange();
              actionRef.current?.reload();
              return true;
            }
            message.error(res.msg || '修改失败');
            return false;
          }
          if (!access.can(editRow ? 'route.edit' : 'route.add')) return false;
          if (editRow) {
            const res = await updateRoute({ ...payload, id: editRow.id, product_codes });
            if (res.code === 0) {
              message.success('申请已提交'); announceApprovalChange(); actionRef.current?.reload(); return true;
            }
            message.error(res.msg || '提交失败'); return false;
          } else {
            const draft = { ...payload, product_codes };
            setNewRouteDraft(draft);
            setEditingApproval(undefined);
            setSteps([]);
            setIsNewRoute(true);
            setDrawerRoute({
              id: 0,
              route_code: payload.route_code,
              route_name: payload.route_name,
              dept_code: payload.dept_code,
              is_active: 1,
              is_default: payload.is_default,
            });
            message.info('请配置工序后提交申请');
            return true;
          }
        }}
      >
        <Form.Item name="dept_code" label="部门代码" rules={[{ required: true, message: '请选择部门代码' }]}>
          <Select
            showSearch
            allowClear
            placeholder="选择或搜索部门"
            filterOption={(input, opt) =>
              (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase()) ||
              (opt?.value as string ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={depts.filter(d => d.code.startsWith('041')).map(d => ({ value: d.code, label: `${d.code} — ${d.name}` }))}
            onChange={async (val: string) => {
              if (!editRow) {
                form.setFieldValue('route_code', '');
                if (val) {
                  const res = await getRouteNextCode(val);
                  if (form.getFieldValue('dept_code') !== val) return;
                  if (res.code === 0) {
                    form.setFieldValue('route_code', res.data);
                    // 流水号是 001 → 该部门第一条，自动设为默认
                    const isFirst = res.data.endsWith('-001');
                    form.setFieldValue('is_default', isFirst);
                    checkDeptWarning(val, isFirst);
                    // 路线名称默认使用部门名称
                    const dept = depts.find(d => d.code === val);
                    if (dept) form.setFieldValue('route_name', dept.name);
                  }
                } else {
                  form.setFieldValue('is_default', false);
                  checkDeptWarning('', false);
                }
              } else {
                checkDeptWarning(val || '', form.getFieldValue('is_default'));
              }
            }}
          />
        </Form.Item>
        <ProFormText name="route_code" hidden rules={[{ required: true }]} />
        <ProFormText name="route_name" label="路线名称" rules={[{ required: true }]} />
        <Form.Item name="product_codes" label="适用产品类别">
          <Select
            mode="multiple"
            allowClear
            showSearch
            placeholder="选择该生产路线适用的产品类别"
            optionFilterProp="label"
            options={productCategories.map(c => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
          />
        </Form.Item>
        <ProFormSwitch
          name="is_default"
          label="部门默认路线"
          fieldProps={{
            onChange: (v) => {
              const deptCode = form.getFieldValue('dept_code');
              checkDeptWarning(deptCode || '', v);
            },
          }}
        />
        {deptWarning && (
          <Form.Item>
            <Alert type="warning" showIcon message={deptWarning} />
          </Form.Item>
        )}
        <ProFormTextArea name="description" label="描述" />
        <ProFormText name="version_note" label="版本说明" placeholder="例如：调整修补与烤漆工序" />
      </ModalForm>

      <Drawer
        title={`工序步骤 — ${drawerRoute?.route_name}`}
        width={720}
        open={!!drawerRoute}
        closable={false}
        maskClosable={false}
        onClose={() => {}}
        extra={
          <Space>
            {!drawerReadOnly && <Button onClick={() => {
              const p = processes.find(p => p.is_active);
              if (!p) return;
              setSteps(prev => [...prev, { seq: prev.length + 1, process_id: p.id, process_name: p.process_name, station_id: null, station_name: '' }]);
            }} icon={<PlusOutlined />}>添加工序</Button>}
            {!drawerReadOnly && <Button type="primary" loading={saving} onClick={() => submitSteps()}>{editingApproval ? '保存修改' : '提交申请'}</Button>}
            <Button onClick={() => {
              if (isNewRoute) {
                Modal.confirm({
                  title: editingApproval ? '放弃修改' : versionSourceId ? '放弃新版本' : '放弃新增申请',
                  content: editingApproval ? '当前修改尚未保存，确认放弃？' : '当前填写内容尚未提交，确认放弃？',
                  okText: '放弃',
                  cancelText: '继续配置',
                  onOk: () => {
                    setDrawerRoute(undefined);
                    setSteps([]);
                    setIsNewRoute(false);
                    setNewRouteDraft(undefined);
                    setVersionSourceId(undefined);
                    setVersionSourceSteps([]);
                    setEditingApproval(undefined);
                  },
                });
              } else {
                setDrawerRoute(undefined);
                setSteps([]);
                setIsNewRoute(false);
                setVersionSourceId(undefined);
                setVersionSourceSteps([]);
                setEditingApproval(undefined);
              }
            }}>关闭</Button>
          </Space>
        }
      >
        {drawerReadOnly && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={drawerRoute?.usage_count
              ? `该版本已被 ${drawerRoute.usage_count} 个工单使用，需要调整请申请新版本。`
              : '当前账号只能查看工序。'}
          />
        )}
        <Table
          dataSource={steps}
          rowKey="seq"
          pagination={false}
          size="small"
          columns={[
            { title: '序号', dataIndex: 'seq', width: 60 },
            {
              title: '工序', dataIndex: 'process_id', width: 180,
              render: (_, r, idx) => (
                <Select style={{ width: '100%' }} value={r.process_id}
                  disabled={drawerReadOnly}
                  onChange={v => {
                    const p = processes.find(p => p.id === v);
                    const next = [...steps];
                    next[idx] = { ...next[idx], process_id: v, process_name: p?.process_name || '' };
                    setSteps(next);
                  }}>
                  {processes.filter(p => p.is_active).map(p => <Select.Option key={p.id} value={p.id}>{p.process_name}</Select.Option>)}
                </Select>
              ),
            },
            {
              title: '工站', dataIndex: 'station_id', width: 180,
              render: (_, r, idx) => (
                <Select style={{ width: '100%' }} value={r.station_id} allowClear placeholder="不指定"
                  disabled={drawerReadOnly}
                  onChange={v => {
                    const s = stations.find(s => s.id === v);
                    const next = [...steps];
                    next[idx] = { ...next[idx], station_id: v ?? null, station_name: s?.station_name || '' };
                    setSteps(next);
                  }}>
                  {stations.filter(s => s.is_active).map(s => <Select.Option key={s.id} value={s.id}>{s.station_name}</Select.Option>)}
                </Select>
              ),
            },
            {
              title: '', width: 100,
              render: (_, __, idx) => (
                <Space>
                  <Button size="small" icon={<ArrowUpOutlined />} disabled={drawerReadOnly || idx === 0} onClick={() => moveStep(idx, -1)} />
                  <Button size="small" icon={<ArrowDownOutlined />} disabled={drawerReadOnly || idx === steps.length - 1} onClick={() => moveStep(idx, 1)} />
                  <Button size="small" danger disabled={drawerReadOnly} icon={<DeleteOutlined />} onClick={() => setSteps(steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, seq: i + 1 })))} />
                </Space>
              ),
            },
          ]}
        />
      </Drawer>
      <Modal
        title="是否将新版本设为默认？"
        open={defaultChoiceOpen}
        closable={!saving}
        mask={{ closable: false }}
        onCancel={() => setDefaultChoiceOpen(false)}
        footer={[
          <Button key="cancel" disabled={saving} onClick={() => setDefaultChoiceOpen(false)}>返回配置</Button>,
          defaultVersion && <Button key="keep" loading={saving} onClick={() => submitSteps(false)}>保留原默认</Button>,
          <Button key="default" type="primary" loading={saving} onClick={() => submitSteps(true)}>设为默认</Button>,
        ]}
      >
        {defaultVersion
          ? `当前默认：${defaultVersion.route_name}（V${defaultVersion.version_no || 1}）。本次选择在审批通过后生效。`
          : '该路线尚无默认版本，新版本审批通过后将设为默认。'}
      </Modal>
      <Modal
        title={`历史版本 — ${historyTarget?.route_name || ''}`}
        open={!!historyTarget}
        width={820}
        footer={null}
        onCancel={() => { setHistoryTarget(null); setHistoryRows([]); }}
      >
        <Table<RouteItem>
          rowKey="id"
          loading={historyLoading}
          dataSource={historyRows}
          pagination={false}
          size="small"
          columns={[
            { title: '版本', dataIndex: 'version_no', width: 80, render: (_, r) => <Tag color={r.is_current ? 'blue' : 'default'}>V{r.version_no || 1}</Tag> },
            { title: '路线名称', dataIndex: 'route_name' },
            { title: '产品类别', dataIndex: 'product_names', ellipsis: true },
            { title: '使用工单', dataIndex: 'usage_count', width: 90 },
            { title: '版本说明', dataIndex: 'version_note', ellipsis: true },
            {
              title: '状态', width: 90,
              render: (_, r) => r.is_current
                ? <Tag color="success">默认版本</Tag>
                : !access.can('route.restore') ? <Tag>{r.is_active ? '可选版本' : '已停用'}</Tag> : <Popconfirm
                    title={`将 V${r.version_no || 1} 设为默认版本？`}
                    onConfirm={async () => {
                      const res = await restoreRouteVersion({ id: r.id });
                      if (res.code === 0) {
                        message.success('设为默认版本申请已提交');
                        announceApprovalChange();
                        setHistoryTarget(null);
                        setHistoryRows([]);
                        actionRef.current?.reload();
                      } else message.error(res.msg || '提交失败');
                    }}
                  ><a>设为默认</a></Popconfirm>,
            },
          ]}
        />
      </Modal>
    </>
  );
};

export default RoutePage;
