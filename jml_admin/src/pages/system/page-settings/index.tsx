import { PageContainer } from '@ant-design/pro-components';
import { useAccess, useModel } from '@umijs/max';
import { Alert, App, Button, Space, Switch, Table, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useViewportScrollHeight } from '@/hooks/useViewportScrollHeight';
import { getPageSettings, type PageSetting, savePageSetting } from '../service';

export default function PageSettingsPage() {
  const { scrollRef, scrollHeight } = useViewportScrollHeight(48);
  const access = useAccess();
  const { message } = App.useApp();
  const { initialState, setInitialState } = useModel('@@initialState');
  const [rows, setRows] = useState<PageSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');
  const canManage = access.can('page-settings.manage');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getPageSettings();
      if (result.code !== 0) throw new Error(result.msg || '加载失败');
      setRows(result.data);
    } catch {
      setError('页面状态加载失败，请检查后台权限表是否已初始化。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggle = async (row: PageSetting, enabled: boolean) => {
    setSavingKey(row.key);
    try {
      await savePageSetting({
        page_key: row.key,
        is_enabled: enabled,
        revision: row.revision,
      });
      setRows((current) =>
        current.map((item) =>
          item.key === row.key
            ? {
                ...item,
                is_enabled: Number(enabled),
                revision: item.revision + 1,
                updated_by: initialState?.currentUser?.name,
              }
            : item,
        ),
      );
      const currentUser = await initialState?.fetchUserInfo?.();
      await setInitialState((state) => ({ ...state, currentUser }));
      message.success(enabled ? '页面已启用' : '页面已停用');
    } catch (saveError) {
      message.error(
        saveError instanceof Error ? saveError.message : '页面状态保存失败',
      );
    } finally {
      setSavingKey('');
    }
  };

  return (
    <PageContainer title="页面开关">
      <Alert
        type="warning"
        showIcon
        title="停用后，所有账号都无法进入该页面，原有角色权限会保留。重新启用后继续按角色权限控制。"
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
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={() => void load()}>刷新</Button>
      </Space>
      <div ref={scrollRef}>
        <Table<PageSetting>
          rowKey="key"
          loading={loading}
          dataSource={rows}
          pagination={false}
          scroll={{ y: scrollHeight }}
          columns={[
            { title: '分组', dataIndex: 'group', width: 130 },
            { title: '页面', dataIndex: 'name', width: 180 },
            { title: '地址', dataIndex: 'path' },
            {
              title: '状态',
              width: 110,
              render: (_, row) =>
                row.locked ? (
                  <Tag color="blue">固定启用</Tag>
                ) : (
                  <Tag color={row.is_enabled ? 'success' : 'default'}>
                    {row.is_enabled ? '启用' : '停用'}
                  </Tag>
                ),
            },
            {
              title: '操作',
              width: 110,
              render: (_, row) => (
                <Switch
                  checked={Boolean(row.is_enabled)}
                  checkedChildren="启用"
                  unCheckedChildren="停用"
                  loading={savingKey === row.key}
                  disabled={!canManage || row.locked || Boolean(savingKey)}
                  onChange={(enabled) => void toggle(row, enabled)}
                />
              ),
            },
            {
              title: '最后修改人',
              dataIndex: 'updated_by',
              width: 140,
              render: (value) => value || '—',
            },
          ]}
        />
      </div>
    </PageContainer>
  );
}
