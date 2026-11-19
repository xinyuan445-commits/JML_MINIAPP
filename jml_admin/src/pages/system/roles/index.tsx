import { PageContainer } from '@ant-design/pro-components';
import { useAccess, useModel } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Collapse,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd';
import { useEffect, useState } from 'react';
import {
  type AdminRole,
  getPermissions,
  getRoles,
  type PermissionGroup,
  saveSecurity,
} from '../service';

function PermissionPicker({
  groups,
  value = [],
  onChange,
}: {
  groups: PermissionGroup[];
  value?: string[];
  onChange?: (permissions: string[]) => void;
}) {
  const sections = groups.reduce<Record<string, PermissionGroup[]>>(
    (result, group) => {
      if (!result[group.group]) result[group.group] = [];
      result[group.group].push(group);
      return result;
    },
    {},
  );

  const permissionRows = (sectionGroups: PermissionGroup[]) =>
    sectionGroups.map((group) => (
      <div
        key={group.key}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 0',
          borderBottom: '1px solid #eee',
        }}
      >
        <span style={{ width: 150, fontWeight: 600 }}>{group.name}</span>
        <Checkbox.Group
          value={value.filter((permission) =>
            permission.startsWith(`${group.key}.`),
          )}
          options={group.permissions.map((permission) => ({
            value: permission.key,
            label: permission.name,
          }))}
          onChange={(checked) => {
            const viewPermission = group.permissions.find(
              (permission) => permission.key === `${group.key}.view`,
            )?.key;
            const next = new Set([
              ...value.filter(
                (permission) => !permission.startsWith(`${group.key}.`),
              ),
              ...checked.map(String),
            ]);
            if (
              viewPermission &&
              value.includes(viewPermission) &&
              !next.has(viewPermission)
            ) {
              for (const permission of group.permissions)
                next.delete(permission.key);
            } else if (viewPermission && checked.length)
              next.add(viewPermission);
            onChange?.([...next]);
          }}
        />
      </div>
    ));

  return (
    <Collapse
      size="small"
      items={Object.entries(sections).map(([name, sectionGroups]) => ({
        key: name,
        label: `${name}（${sectionGroups.length}项）`,
        children: permissionRows(sectionGroups),
      }))}
    />
  );
}

export default function RolesPage() {
  const access = useAccess();
  const { message } = App.useApp();
  const { initialState, setInitialState } = useModel('@@initialState');
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [catalog, setCatalog] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<AdminRole>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const readOnly = !access.can('roles.manage') || Boolean(editing?.is_system);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [roleResult, catalogResult] = await Promise.all([
        getRoles(),
        getPermissions(),
      ]);
      if (roleResult.code !== 0 || catalogResult.code !== 0)
        throw new Error('加载失败');
      setRoles(roleResult.data);
      setCatalog(catalogResult.data);
    } catch {
      setError('角色数据加载失败，请检查后台权限表是否已初始化。');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const edit = (role?: AdminRole) => {
    setEditing(role);
    form.resetFields();
    form.setFieldsValue(
      role
        ? { ...role, is_active: Boolean(role.is_active) }
        : { permissions: [], is_active: true },
    );
    setOpen(true);
  };
  return (
    <PageContainer title="角色权限">
      <Alert
        type="info"
        showIcon
        title="先配置角色，再到后台账号中分配。勾选操作权限时会同时授予对应页面的查看权限。账号管理、角色管理的“管理”权限包含授权，请仅交给可信管理员。"
        style={{ marginBottom: 16 }}
      />
      {error && (
        <Alert
          type="error"
          title={error}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={() => void load()}>刷新</Button>
        {access.can('roles.manage') && (
          <Button type="primary" onClick={() => edit()}>
            新增角色
          </Button>
        )}
      </Space>
      <Table<AdminRole>
        rowKey="id"
        loading={loading}
        dataSource={roles}
        columns={[
          { title: '角色', dataIndex: 'name' },
          { title: '编码', dataIndex: 'code' },
          {
            title: '已授权功能',
            render: (_, role) =>
              catalog
                .filter((group) =>
                  role.permissions.includes(`${group.key}.view`),
                )
                .map((group) => group.name)
                .join('、') || '未授权',
          },
          {
            title: '状态',
            render: (_, role) => (
              <Tag color={role.is_active ? 'success' : 'default'}>
                {role.is_active ? '启用' : '停用'}
              </Tag>
            ),
          },
          {
            title: '操作',
            render: (_, role) => (
              <Button type="link" onClick={() => edit(role)}>
                {access.can('roles.manage') && !role.is_system
                  ? '配置权限'
                  : '查看权限'}
              </Button>
            ),
          },
        ]}
      />
      <Modal
        width={900}
        title={editing ? `角色权限 — ${editing.name}` : '新增角色'}
        open={open}
        onCancel={() => setOpen(false)}
        footer={readOnly ? null : undefined}
        confirmLoading={saving}
        destroyOnHidden
        onOk={async () => {
          const values = await form.validateFields();
          setSaving(true);
          try {
            await saveSecurity('roles/save', {
              ...values,
              ...(editing ? { id: editing.id } : {}),
            });
            setOpen(false);
            message.success('角色权限已保存');
            await load();
            const currentUser = await initialState?.fetchUserInfo?.();
            await setInitialState((state) => ({ ...state, currentUser }));
          } catch (error) {
            message.error(error instanceof Error ? error.message : '保存失败');
          } finally {
            setSaving(false);
          }
        }}
      >
        <Form form={form} layout="vertical" disabled={readOnly}>
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true }, { max: 100 }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="code"
            label="角色编码"
            rules={[
              { required: true },
              {
                pattern: /^[A-Za-z0-9_-]{1,64}$/,
                message: '请使用英文字母、数字、横线或下划线',
              },
            ]}
          >
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item name="is_active" label="角色启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="permissions" label="功能权限">
            <PermissionPicker groups={catalog} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
