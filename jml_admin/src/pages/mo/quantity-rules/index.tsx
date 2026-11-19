import { PageContainer } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { Alert, App, Card, Space, Switch } from 'antd';
import { useEffect, useState } from 'react';
import {
  getQuantityRules,
  type QuantityRulesData,
  saveQuantityRuleSetting,
} from './service';

type SettingField =
  | 'completion_not_exceed_received'
  | 'receive_not_exceed_previous_completed'
  | 'completion_not_exceed_previous_completed';

export default function QuantityRulesPage() {
  const canManage = useAccess().can('quantity-rules.manage');
  const { message } = App.useApp();
  const [data, setData] = useState<QuantityRulesData>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getQuantityRules());
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const setting = data?.setting;
  const allOff =
    setting &&
    !setting.completion_not_exceed_received &&
    !setting.receive_not_exceed_previous_completed &&
    !setting.completion_not_exceed_previous_completed;

  const saveSetting = async (field: SettingField, checked: boolean) => {
    if (!setting) return;
    setSaving(true);
    try {
      await saveQuantityRuleSetting({ ...setting, [field]: checked });
      message.success('规则已保存');
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer title="报工数量规则">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {allOff && (
          <Alert
            showIcon
            type="info"
            message="规则尚未启用，不影响当前报工。"
          />
        )}
        <Alert
          showIcon
          type="info"
          message="适用于生产部门（041及下级），不按工站区分；第一道工序可直接完工。"
        />
        <Card title="规则开关" loading={loading}>
          <Space direction="vertical" size={20}>
            {[
              ['completion_not_exceed_received', '完工不超过本工序接收'],
              [
                'receive_not_exceed_previous_completed',
                '接收不超过上一工序完工',
              ],
              [
                'completion_not_exceed_previous_completed',
                '完工不超过上一工序完工',
              ],
            ].map(([field, label]) => (
              <Space key={field}>
                <Switch
                  checked={Boolean(setting?.[field as SettingField])}
                  disabled={!canManage || saving}
                  onChange={(checked) =>
                    void saveSetting(field as SettingField, checked)
                  }
                />
                <span>{label}</span>
              </Space>
            ))}
          </Space>
        </Card>
      </Space>
    </PageContainer>
  );
}
