import { Alert, App, Button, Card, Modal, Select, Space, Tag } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import {
  getStationExemptions,
  getStationStaff,
  type StationExemptions,
  type StationStaff,
  saveStationExemptions,
} from './service';

const personLabel = (person: StationStaff) =>
  `${person.name}${person.position ? ` · ${person.position}` : ''} · ${person.id.slice(-6)}`;

export default function ExemptStaffCard({ canManage }: { canManage: boolean }) {
  const { message } = App.useApp();
  const [configuration, setConfiguration] = useState<StationExemptions>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<StationExemptions>();
  const [selected, setSelected] = useState<string[]>([]);
  const [staff, setStaff] = useState<StationStaff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffReady, setStaffReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getStationExemptions();
      if (result.code !== 0) throw new Error(result.msg || '加载失败');
      setConfiguration(result.data);
    } catch {
      setError('豁免人员加载失败，请检查后台连接及配置表是否已升级。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  const options = new Map(
    staff.map((person) => [
      person.id,
      { value: person.id, label: personLabel(person), disabled: false },
    ]),
  );
  const unavailable = new Set<string>();
  for (const person of editing?.staff || []) {
    if (!options.has(person.id)) {
      if (staffReady) unavailable.add(person.id);
      options.set(person.id, {
        value: person.id,
        label: `${personLabel(person)}（当前不可选）`,
        disabled: true,
      });
    }
  }

  const save = async () => {
    if (!editing || !canManage || !staffReady || staffLoading || saving) return;
    setSaving(true);
    try {
      await saveStationExemptions({
        staff_ids: selected,
        revision: editing.revision,
      });
      message.success('豁免人员已保存');
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

  return (
    <>
      <Card
        title="工站豁免人员"
        size="small"
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button onClick={() => void load()} loading={loading}>
              刷新名单
            </Button>
            {canManage && (
              <Button
                disabled={loading || Boolean(error) || !configuration}
                onClick={() => {
                  if (!configuration) return;
                  setSelected([...configuration.staff_ids]);
                  setEditing(configuration);
                  void loadStaff();
                }}
              >
                设置豁免人员
              </Button>
            )}
          </Space>
        }
      >
        {error ? (
          <Alert type="error" showIcon title={error} />
        ) : loading ? (
          <span>正在加载豁免人员…</span>
        ) : configuration?.staff.length ? (
          <Space wrap>
            {configuration.staff.map((person) => (
              <Tag
                key={person.id}
                color={person.status === '1' ? 'purple' : 'warning'}
              >
                {person.name}
                {person.status !== '1' ? '（不可用）' : ''}
              </Tag>
            ))}
          </Space>
        ) : (
          <span>尚未设置豁免人员</span>
        )}
      </Card>
      <Modal
        title="设置工站豁免人员"
        open={Boolean(editing)}
        onCancel={() => {
          if (!saving) setEditing(undefined);
        }}
        onOk={() => void save()}
        okText="保存名单"
        cancelText="取消"
        confirmLoading={saving}
        okButtonProps={{ disabled: !canManage || staffLoading || !staffReady }}
        destroyOnHidden
      >
        <Select
          aria-label="工站豁免人员"
          mode="multiple"
          allowClear
          showSearch={{ optionFilterProp: 'label' }}
          options={[...options.values()]}
          value={selected}
          onChange={setSelected}
          loading={staffLoading}
          disabled={saving || staffLoading || !staffReady}
          maxCount={100}
          placeholder="选择员工，可留空"
          style={{ width: '100%', marginBottom: 16 }}
        />
        <Space wrap>
          <Button
            onClick={() => void loadStaff()}
            loading={staffLoading}
            disabled={saving}
          >
            刷新人员
          </Button>
          {unavailable.size > 0 && (
            <Button
              disabled={saving || staffLoading}
              onClick={() =>
                setSelected(selected.filter((id) => !unavailable.has(id)))
              }
            >
              移除不可用人员
            </Button>
          )}
        </Space>
      </Modal>
    </>
  );
}
