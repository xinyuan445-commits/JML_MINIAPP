import { App, Button, DatePicker, Form, Modal, Select, Space } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import React, { useEffect, useState } from 'react';
import {
  getStationStaff,
  type StationProxyConfiguration,
  type StationStaff,
  saveStationProxies,
} from './service';

dayjs.extend(utc);
type ProxyForm = {
  proxies: { staff_id: string; starts_at: Dayjs; ends_at: Dayjs }[];
};

export default function StationProxyEditor({
  stationName,
  configuration,
  onClose,
  onSaved,
}: {
  stationName: string;
  configuration: StationProxyConfiguration;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<ProxyForm>();
  const [staff, setStaff] = useState<StationStaff[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadStaff = async () => {
    setLoading(true);
    setReady(false);
    try {
      const result = await getStationStaff();
      if (result.code !== 0) throw new Error(result.msg || '加载失败');
      setStaff(result.data);
      setReady(true);
    } catch {
      message.error('人员加载失败，请重试');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    form.setFieldsValue({
      proxies: configuration.proxies.map((proxy) => ({
        staff_id: proxy.staff_id,
        starts_at: dayjs(proxy.starts_at).utcOffset(480),
        ends_at: dayjs(proxy.ends_at).utcOffset(480),
      })),
    });
    void loadStaff();
  }, [configuration, form]);
  const options = new Map(
    staff.map((person) => [
      person.id,
      {
        value: person.id,
        label: `${person.name} · ${person.id.slice(-6)}`,
        disabled: false,
      },
    ]),
  );
  for (const proxy of configuration.proxies) {
    if (!options.has(proxy.staff_id))
      options.set(proxy.staff_id, {
        value: proxy.staff_id,
        label: `${proxy.person.name}（不可用）`,
        disabled: true,
      });
  }
  const save = async () => {
    if (!ready || loading || saving) return;
    let values: ProxyForm;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      await saveStationProxies({
        station_id: configuration.station_id,
        version: configuration.version,
        proxies: (values.proxies || []).map((proxy) => ({
          staff_id: proxy.staff_id,
          starts_at: `${proxy.starts_at.format('YYYY-MM-DDTHH:mm:ss')}+08:00`,
          ends_at: `${proxy.ends_at.format('YYYY-MM-DDTHH:mm:ss')}+08:00`,
        })),
      });
      message.success('代理配置已保存');
      onClose();
      await onSaved();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={`配置代理 · ${stationName}`}
      open
      width={780}
      onCancel={() => {
        if (!saving) onClose();
      }}
      onOk={() => void save()}
      okText="保存代理"
      cancelText="取消"
      confirmLoading={saving}
      okButtonProps={{ disabled: !ready || loading }}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" disabled={saving}>
        <Form.List
          name="proxies"
          rules={[
            {
              validator: async (_, proxies: ProxyForm['proxies']) => {
                if (
                  new Set(
                    (proxies || [])
                      .map((proxy) => proxy?.staff_id)
                      .filter(Boolean),
                  ).size !==
                  (proxies || []).filter((proxy) => proxy?.staff_id).length
                ) {
                  throw new Error('同一工站不能重复配置代理人');
                }
              },
            },
          ]}
        >
          {(fields, { add, remove }, { errors }) => (
            <>
              {fields.map((field) => (
                <div
                  key={field.key}
                  style={{
                    borderBottom: '1px solid #f0f0f0',
                    marginBottom: 16,
                  }}
                >
                  <Form.Item
                    label="代理人"
                    name={[field.name, 'staff_id']}
                    rules={[{ required: true, message: '请选择代理人' }]}
                  >
                    <Select
                      showSearch={{ optionFilterProp: 'label' }}
                      options={[...options.values()]}
                      loading={loading}
                      placeholder="选择代理人"
                    />
                  </Form.Item>
                  <Space wrap align="start">
                    <Form.Item
                      label="生效时间（北京时间）"
                      name={[field.name, 'starts_at']}
                      rules={[{ required: true, message: '请选择生效时间' }]}
                    >
                      <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" />
                    </Form.Item>
                    <Form.Item
                      label="到期时间（北京时间）"
                      name={[field.name, 'ends_at']}
                      dependencies={[['proxies', field.name, 'starts_at']]}
                      rules={[
                        { required: true, message: '请选择到期时间' },
                        {
                          validator: async (_, end: Dayjs) => {
                            const start = form.getFieldValue([
                              'proxies',
                              field.name,
                              'starts_at',
                            ]) as Dayjs | undefined;
                            if (
                              end &&
                              start &&
                              !end
                                .clone()
                                .utcOffset(480, true)
                                .isAfter(start.clone().utcOffset(480, true))
                            )
                              throw new Error('到期时间必须晚于生效时间');
                          },
                        },
                      ]}
                    >
                      <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" />
                    </Form.Item>
                    <Button
                      danger
                      onClick={() => remove(field.name)}
                      style={{ marginTop: 30 }}
                    >
                      移除代理
                    </Button>
                  </Space>
                </div>
              ))}
              <Space>
                <Button
                  onClick={() => add({ starts_at: dayjs().utcOffset(480) })}
                  disabled={!ready || fields.length >= 100}
                >
                  添加代理人
                </Button>
                <Button onClick={() => void loadStaff()} loading={loading}>
                  刷新人员
                </Button>
              </Space>
              <Form.ErrorList errors={errors} />
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}
