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
import { useEffect, useState } from 'react';
import {
  type AdminAccount,
  type AdminRole,
  getAccounts,
  getRoles,
  getStaffBinding,
  saveSecurity,
} from '../service';

export default function AccountsPage() {
  const access = useAccess();
  const canManage = access.can('accounts.manage');
  const { message } = App.useApp();
  const { initialState, setInitialState } = useModel('@@initialState');
  const [rows, setRows] = useState<AdminAccount[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<AdminAccount>();
  const [open, setOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<AdminAccount>();
  const [bindingTarget, setBindingTarget] = useState<AdminAccount>();
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [accountsResult, rolesResult] = await Promise.all([
        getAccounts(),
        getRoles(),
      ]);
      if (accountsResult.code !== 0 || rolesResult.code !== 0)
        throw new Error('账号数据加载失败');
      setRows(accountsResult.data);
      setRoles(rolesResult.data);
    } catch {
      setError('账号数据加载失败，请检查后台权限表是否已初始化。');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const edit = (row?: AdminAccount) => {
    setEditing(row);
    form.resetFields();
    form.setFieldsValue(
      row
        ? { ...row, is_active: Boolean(row.is_active) }
        : { is_active: true, role_ids: [] },
    );
    setOpen(true);
  };
  const refreshIdentity = async () => {
    const currentUser = await initialState?.fetchUserInfo?.();
    await setInitialState((state) => ({ ...state, currentUser }));
  };
  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await saveSecurity('accounts/save', {
        ...values,
        ...(editing ? { id: editing.id } : {}),
      });
      setOpen(false);
      message.success('账号已保存');
      await load();
      await refreshIdentity();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer title="后台账号">
      <Alert
        type="info"
        showIcon
        title="仅管理后台登录权限，不是开工或返工人员名单。域账号通过统一平台首次进入后自动出现在这里，密码由统一平台管理。"
        style={{ marginBottom: 16 }}
      />
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          style={{ marginBottom: 16 }}
        />
      )}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          aria-label="搜索后台账号"
          placeholder="搜索账号或姓名"
          allowClear
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          style={{ width: 280 }}
        />
        <Button onClick={() => void load()}>刷新</Button>
        {canManage && (
          <Button type="primary" onClick={() => edit()}>
            新增本地账号
          </Button>
        )}
      </Space>
      <Table<AdminAccount>
        rowKey="id"
        loading={loading}
        scroll={{ x: 950 }}
        dataSource={rows.filter((row) =>
          `${row.username} ${row.display_name}`
            .toLowerCase()
            .includes(keyword.toLowerCase()),
        )}
        columns={[
          { title: '账号', dataIndex: 'username' },
          { title: '姓名', dataIndex: 'display_name' },
          {
            title: '登录方式',
            render: (_, row) =>
              row.auth_source === 'oidc' ? '统一平台' : '本地账号',
          },
          {
            title: '角色',
            render: (_, row) =>
              row.role_ids.length ? (
                row.role_ids.map((id) => (
                  <Tag key={id}>
                    {roles.find((role) => role.id === id)?.name || id}
                  </Tag>
                ))
              ) : (
                <Tag color="warning">未分配</Tag>
              ),
          },
          {
            title: '状态',
            render: (_, row) => (
              <Tag color={row.is_active ? 'success' : 'default'}>
                {row.is_active ? '启用' : '停用'}
              </Tag>
            ),
          },
          {
            title: '最近本地登录',
            dataIndex: 'last_login_time',
            render: (value) => value || '—',
          },
          {
            title: '操作',
            render: (_, row) =>
              canManage && (
                <Space>
                  <Button type="link" onClick={() => edit(row)}>
                    编辑 / 分配角色
                  </Button>
                  {row.auth_source === 'session' && (
                    <Button
                      type="link"
                      onClick={() => {
                        passwordForm.resetFields();
                        setPasswordTarget(row);
                      }}
                    >
                      重置密码
                    </Button>
                  )}
                </Space>
              ),
          },
        ]}
      />
      <Modal
        title={editing ? '编辑后台账号' : '新增本地账号'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="登录账号"
            rules={[{ required: true }, { max: 50 }]}
          >
            <Input disabled={Boolean(editing)} autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="display_name"
            label="姓名"
            rules={[{ required: true }, { max: 100 }]}
          >
            <Input disabled={editing?.auth_source === 'oidc'} />
          </Form.Item>
          {editing?.auth_source === 'oidc' && (
            <p>登录时显示统一平台提供的姓名，此处只配置生产后台权限。</p>
          )}
          {!editing && (
            <Form.Item
              name="password"
              label="初始密码"
              rules={[{ required: true }, { min: 8, max: 128 }]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          )}
          <Form.Item
            name="role_ids"
            label="角色"
            extra="可以多选；未分配角色时不能访问业务页面。"
          >
            <Select
              mode="multiple"
              showSearch={{ optionFilterProp: 'label' }}
              options={roles.map((role) => ({
                value: role.id,
                label: `${role.name}${role.is_active ? '' : '（已停用）'}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="is_active" label="账号启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          {editing && canManage && <Button onClick={() => setBindingTarget(editing)}>关联员工</Button>}
        </Form>
      </Modal>
      {bindingTarget && <StaffBinding account={bindingTarget} onClose={() => setBindingTarget(undefined)} />}
      <Modal
        title={`重置密码 — ${passwordTarget?.username || ''}`}
        open={Boolean(passwordTarget)}
        onCancel={() => setPasswordTarget(undefined)}
        confirmLoading={saving}
        onOk={async () => {
          const values = await passwordForm.validateFields();
          setSaving(true);
          try {
            await saveSecurity('accounts/password', {
              id: passwordTarget?.id,
              ...values,
            });
            message.success('密码已重置，该账号原有登录已失效');
            const resetSelf =
              passwordTarget?.id === initialState?.currentUser?.adminAccountId;
            setPasswordTarget(undefined);
            if (resetSelf) await refreshIdentity();
          } catch (error) {
            message.error(error instanceof Error ? error.message : '重置失败');
          } finally {
            setSaving(false);
          }
        }}
        destroyOnHidden
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="password"
            label="新密码"
            rules={[{ required: true }, { min: 8, max: 128 }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
        <p>保存后，该账号需要使用新密码重新登录。</p>
      </Modal>
    </PageContainer>
  );
}

function StaffBinding({ account, onClose }: { account: AdminAccount; onClose: () => void }) {
  const { message } = App.useApp();
  const [binding, setBinding] = useState<Awaited<ReturnType<typeof getStaffBinding>>['data']>();
  const [staff, setStaff] = useState<string>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let current = true;
    getStaffBinding(account.id).then((result) => {
      if (!current) return;
      if (result.code !== 0) throw new Error(result.msg || '读取失败');
      setBinding(result.data);
      setStaff(result.data.staff_id || undefined);
    }).catch((e) => {
      if (current) setError(e?.response?.data?.msg || e?.message || '员工绑定暂不可用');
    });
    return () => { current = false; };
  }, [account.id]);
  const save = async () => {
    if (!binding || saving) return;
    setSaving(true);
    setError('');
    try {
      await saveSecurity('accounts/staff-binding', { id: account.id, revision: binding.revision, staff_id: staff ?? null });
      message.success('员工绑定已保存');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };
  return <Modal title={`关联员工 · ${account.display_name}`} open onCancel={onClose} onOk={() => void save()}
    okText="保存绑定" cancelText="返回" confirmLoading={saving} okButtonProps={{ disabled: !binding || (staff ?? null) === binding.staff_id }}>
    {error && <Alert type="error" title={error} style={{ marginBottom: 12 }} />}
    <Select aria-label="关联员工" allowClear showSearch={{ optionFilterProp: 'label' }} placeholder="选择员工"
      value={staff} onChange={setStaff} style={{ width: '100%' }} loading={!binding && !error}
      options={binding?.people.map((person) => ({ value: person.id, label: person.name + (person.active ? '' : '（停用）'), disabled: !person.active }))} />
  </Modal>;
}
