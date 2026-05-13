import { PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ModalForm, ProFormSwitch, ProFormText, ProFormTextArea, ProTable } from '@ant-design/pro-components';
import { Alert, App, Button, Drawer, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { useModel } from '@umijs/max';
import React, { useEffect, useRef, useState } from 'react';
import {
  addRoute, deleteRoute, getDepartments, getProcessList, getRouteDetail, getRouteList,
  getRouteNextCode, getWorkstationList, setRouteProcesses, toggleRoute, updateRoute,
} from '../service';

type RouteItem = { id: number; route_code: string; route_name: string; dept_code: string; is_active: number; is_default: number; };
type StepItem  = { seq: number; process_id: number; process_name: string; station_id: number | null; station_name: string; };

const DELETE_PWD = 'Ks@1234!';

const RoutePage: React.FC = () => {
  const { message } = App.useApp();
  const { initialState } = useModel('@@initialState');
  const isAdmin = initialState?.currentUser?.access === 'admin';
  const actionRef = useRef<ActionType>();
  const [editRow, setEditRow] = useState<RouteItem | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [depts, setDepts] = useState<{ code: string; name: string }[]>([]);
  const [routeList, setRouteList] = useState<RouteItem[]>([]);
  const [deptWarning, setDeptWarning] = useState('');

  const [delTarget, setDelTarget] = useState<RouteItem | null>(null);
  const [delPwd, setDelPwd] = useState('');
  const [delLoading, setDelLoading] = useState(false);

  const openDelete = (r: RouteItem) => {
    if (isAdmin) {
      Modal.confirm({
        title: '确认删除',
        content: `确认删除路线「${r.route_name}」？此操作不可撤销。`,
        okText: '删除', okType: 'danger', cancelText: '取消',
        onOk: async () => {
          const res = await deleteRoute({ id: r.id });
          if (res.code === 0) { message.success('删除成功'); actionRef.current?.reload(); getRouteList().then(d => { if (d.code === 0) setRouteList(d.data); }); }
          else message.error(res.msg || '删除失败');
        },
      });
    } else {
      setDelPwd('');
      setDelTarget(r);
    }
  };

  const [drawerRoute, setDrawerRoute] = useState<RouteItem | undefined>();
  const [isNewRoute, setIsNewRoute] = useState(false);  // 新增路线强制配置工序
  const [stepsSaved, setStepsSaved] = useState(false);
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDepartments().then(r => { if (r.code === 0) setDepts(r.data); });
    getRouteList().then(r => { if (r.code === 0) setRouteList(r.data); });
  }, []);

  useEffect(() => {
    if (drawerRoute) {
      getRouteDetail(drawerRoute.id).then(r => { if (r.code === 0) setSteps(r.data.steps || []); });
      getProcessList().then(r => { if (r.code === 0) setProcesses(r.data); });
      getWorkstationList().then(r => { if (r.code === 0) setStations(r.data); });
    }
  }, [drawerRoute]);

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

  const columns: ProColumns<RouteItem>[] = [
    { title: '路线编码', dataIndex: 'route_code', width: 140 },
    { title: '路线名称', dataIndex: 'route_name', width: 160 },
    { title: '部门代码', dataIndex: 'dept_code', width: 120 },
    { title: '默认', dataIndex: 'is_default', width: 80, render: (_, r) => r.is_default ? <Tag color="blue">默认</Tag> : '-' },
    { title: '状态', dataIndex: 'is_active', width: 90, render: (_, r) => <Tag color={r.is_active ? 'green' : 'default'}>{r.is_active ? '启用' : '禁用'}</Tag> },
    {
      title: '操作', width: 260, valueType: 'option',
      render: (_, r) => [
        <a key="steps" onClick={() => setDrawerRoute(r)}>配置工序</a>,
        <a key="edit" onClick={() => { setEditRow(r); setModalOpen(true); }}>编辑</a>,
        <Popconfirm key="toggle" title={r.is_active ? '确认禁用？' : '确认启用？'}
          onConfirm={async () => {
            const res = await toggleRoute({ id: r.id, is_active: r.is_active ? 0 : 1 });
            if (res.code === 0) { message.success('操作成功'); actionRef.current?.reload(); }
            else message.error(res.msg || '操作失败');
          }}>
          <a>{r.is_active ? '禁用' : '启用'}</a>
        </Popconfirm>,
        <a key="del" style={{ color: '#ff4d4f' }} onClick={() => openDelete(r)}>删除</a>,
      ],
    },
  ];

  return (
    <>
      <ProTable<RouteItem>
        headerTitle="工艺路线"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        request={async () => {
          const res = await getRouteList();
          const data = res.code === 0 ? res.data : [];
          setRouteList(data);
          return { data, success: true };
        }}
        columns={columns}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />}
            onClick={() => { setEditRow(undefined); setDeptWarning(''); setModalOpen(true); }}>新增</Button>,
        ]}
      />

      <ModalForm
        title={editRow ? '编辑路线' : '新增路线'}
        open={modalOpen}
        form={form}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={(v) => {
          if (!v) { setModalOpen(false); setEditRow(undefined); setDeptWarning(''); form.resetFields(); }
        }}
        initialValues={editRow ? { ...editRow, is_default: !!editRow.is_default } : { is_default: false }}
        onFinish={async (values) => {
          const payload = { ...values, is_default: values.is_default ? 1 : 0 };
          if (editRow) {
            const res = await updateRoute({ ...payload, id: editRow.id });
            if (res.code === 0) { message.success('保存成功'); actionRef.current?.reload(); return true; }
            message.error(res.msg || '保存失败'); return false;
          } else {
            const res = await addRoute(payload);
            if (res.code === 0) {
              message.success('保存成功，请配置工序步骤');
              actionRef.current?.reload();
              getRouteList().then(r => { if (r.code === 0) setRouteList(r.data); });
              setIsNewRoute(true);
              setStepsSaved(false);
              setDrawerRoute(res.data);
              return true;
            }
            message.error(res.msg || '保存失败'); return false;
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
                if (val) {
                  const res = await getRouteNextCode(val);
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
                  form.setFieldValue('route_code', '');
                  form.setFieldValue('is_default', false);
                  checkDeptWarning('', false);
                }
              } else {
                checkDeptWarning(val || '', form.getFieldValue('is_default'));
              }
            }}
          />
        </Form.Item>
        <ProFormText
          name="route_code"
          label="路线编码"
          rules={[{ required: true }]}
          disabled={!editRow}
          tooltip={!editRow ? '根据部门代码自动生成' : undefined}
        />
        <ProFormText name="route_name" label="路线名称" rules={[{ required: true }]} />
        <ProFormSwitch
          name="is_default"
          label="是否默认"
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
      </ModalForm>

      <Drawer
        title={`工序步骤 — ${drawerRoute?.route_name}`}
        styles={{ body: { width: 640 } }}
        open={!!drawerRoute}
        closable={false}
        maskClosable={false}
        onClose={() => {}}
        extra={
          <Space>
            <Button onClick={() => {
              const p = processes.find(p => p.is_active);
              if (!p) return;
              setSteps(prev => [...prev, { seq: prev.length + 1, process_id: p.id, process_name: p.process_name, station_id: null, station_name: '' }]);
            }} icon={<PlusOutlined />}>添加工序</Button>
            <Button type="primary" loading={saving} onClick={async () => {
              if (steps.length === 0) { message.warning('请至少添加一道工序'); return; }
              const missing = steps.findIndex(s => !s.station_id);
              if (missing !== -1) { message.warning(`第 ${missing + 1} 道工序未指定工站，工站为必填`); return; }
              setSaving(true);
              const res = await setRouteProcesses({ route_id: drawerRoute!.id, steps });
              setSaving(false);
              if (res.code === 0) {
                message.success('保存成功');
                setStepsSaved(true);
              } else {
                message.error(res.msg || '保存失败');
              }
            }}>保存</Button>
            <Button onClick={() => {
              if (isNewRoute && !stepsSaved) {
                Modal.confirm({
                  title: '放弃配置',
                  content: '尚未保存工序，关闭将同时删除该路线，确认放弃？',
                  okText: '放弃并删除',
                  okType: 'danger',
                  cancelText: '继续配置',
                  onOk: async () => {
                    await deleteRoute({ id: drawerRoute!.id });
                    actionRef.current?.reload();
                    getRouteList().then(r => { if (r.code === 0) setRouteList(r.data); });
                    setDrawerRoute(undefined);
                    setSteps([]);
                    setIsNewRoute(false);
                  },
                });
              } else {
                setDrawerRoute(undefined);
                setSteps([]);
                setIsNewRoute(false);
              }
            }}>关闭</Button>
          </Space>
        }
      >
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
                  <Button size="small" icon={<ArrowUpOutlined />} disabled={idx === 0} onClick={() => moveStep(idx, -1)} />
                  <Button size="small" icon={<ArrowDownOutlined />} disabled={idx === steps.length - 1} onClick={() => moveStep(idx, 1)} />
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setSteps(steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, seq: i + 1 })))} />
                </Space>
              ),
            },
          ]}
        />
      </Drawer>
      <Modal
        title="删除验证"
        open={!!delTarget}
        okText="确认删除"
        okType="danger"
        cancelText="取消"
        confirmLoading={delLoading}
        onCancel={() => setDelTarget(null)}
        onOk={async () => {
          if (delPwd !== DELETE_PWD) { message.error('密码错误'); return; }
          setDelLoading(true);
          const res = await deleteRoute({ id: delTarget!.id });
          setDelLoading(false);
          if (res.code === 0) {
            message.success('删除成功');
            setDelTarget(null);
            actionRef.current?.reload();
            getRouteList().then(d => { if (d.code === 0) setRouteList(d.data); });
          } else {
            message.error(res.msg || '删除失败');
          }
        }}
      >
        <p>确认删除路线「<b>{delTarget?.route_name}</b>」？此操作不可撤销。</p>
        <Input.Password
          placeholder="请输入删除密码"
          value={delPwd}
          onChange={e => setDelPwd(e.target.value)}
          onPressEnter={() => document.querySelector<HTMLElement>('.ant-modal-confirm-btns .ant-btn-dangerous')?.click()}
        />
      </Modal>
    </>
  );
};

export default RoutePage;
