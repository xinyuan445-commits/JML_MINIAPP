import {
  Alert,
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  Select,
  Space,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import {
  getNonorderPublishOptions,
  getNonorderPublishPeople,
  type NonorderCreation,
} from './nonorderService';

const workItems: Record<string, string[]> = {
  '5s': [
    '现场整理整顿',
    '工位清扫',
    '物料归类摆放',
    '区域标识完善',
    '死角卫生清理',
    '5S问题自查整改',
    '其他',
  ],
  inventory: [
    '在线物料盘点',
    '半成品盘点',
    '备品备件盘点',
    '原辅材料盘点',
    '耗材盘点',
    '库存物料盘点',
    '其他',
  ],
  maintenance: [
    '设备清洁',
    '设备点检',
    '异常排查',
    '易损件检查',
    '设备隐患登记',
    '保养台账更新',
    '其他',
  ],
  rectification: [
    '前期质量问题整改',
    '设备问题整改',
    '现场巡检问题',
    '客诉问题跟进',
    '内审问题闭环',
    '未闭环问题跟进',
    '其他',
  ],
  training: [
    'SOP作业规范培训',
    '质量标准培训',
    '异常处理培训',
    '安全规范培训',
    '5S标准培训',
    '近期问题复盘',
    '其他',
  ],
  other: ['临时任务'],
};
type Division = {
  category_code?: string;
  work_item?: string;
  scope?: string;
  objective?: string;
  acceptance_standard?: string;
  staff_ids?: string[];
  responsibilities?: Record<string, string>;
  station_id?: number;
  planned_date?: Dayjs;
  due_at?: Dayjs;
};
type Values = {
  responsible_staff_id: string;
  content: string;
  category_code: string;
  acceptance_standard: string;
  planned_date: Dayjs;
  reviewer_staff_id?: string;
  divisions: Division[];
};
const required = [{ required: true, message: '请填写此项' }];
const requiredText = [
  { required: true, whitespace: true, message: '请填写此项' },
];

function initialForm(day: string, creation?: NonorderCreation) {
  if (!creation) return { planned_date: dayjs(day), divisions: [{}] };
  const { task } = creation;
  const category = task.category_code || task.divisions[0]?.category_code;
  return {
    ...task,
    category_code: category,
    planned_date: dayjs(task.planned_date),
    divisions: task.divisions.map((row) => ({
      ...row,
      category_code:
        row.category_code === category ? undefined : row.category_code,
      station_id: row.station_id ?? undefined,
      planned_date:
        row.planned_date === task.planned_date
          ? undefined
          : dayjs(row.planned_date),
      due_at: row.due_at ? dayjs(row.due_at) : undefined,
      staff_ids: row.members.map((person) => person.staff_id),
      responsibilities: Object.fromEntries(
        row.members.map((person) => [person.staff_id, person.responsibility]),
      ),
    })),
  };
}

export default function NonorderPublish({
  day,
  initial,
  onClose,
  onAdd,
}: {
  day: string;
  initial?: NonorderCreation;
  onClose: () => void;
  onAdd: (entry: NonorderCreation) => void;
}) {
  const [form] = Form.useForm<Values>();
  const [options, setOptions] =
    useState<Awaited<ReturnType<typeof getNonorderPublishOptions>>>();
  const [people, setPeople] =
    useState<Awaited<ReturnType<typeof getNonorderPublishPeople>>>();
  const [error, setError] = useState('');
  const [scopeError, setScopeError] = useState('');
  const [scopeRetry, setScopeRetry] = useState(0);
  const [expandedModuleKey, setExpandedModuleKey] = useState<number>();
  const ownerChanged = useRef(!initial);
  const responsible = Form.useWatch('responsible_staff_id', form);
  const category = Form.useWatch('category_code', form);
  const divisions = Form.useWatch('divisions', form) || [];
  const moduleOptions = Object.entries(options?.categories || {}).map(
    ([value, label]) => ({ value, label }),
  );
  const performers = new Set(
    divisions.flatMap((division) => division.staff_ids || []),
  );
  const needsReviewer = !!responsible && performers.has(responsible);
  const scopeLoading = !!responsible && !people && !scopeError;
  const scopePlaceholder = !responsible
    ? '请先选择任务负责人'
    : scopeError
      ? '候选读取失败'
      : '正在读取候选';

  useEffect(() => {
    let current = true;
    getNonorderPublishOptions()
      .then((value) => {
        if (current) setOptions(value);
      })
      .catch((failure: Error) => {
        if (current) setError(failure.message);
      });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    if (!responsible) return;
    let current = true;
    getNonorderPublishPeople(responsible)
      .then((value) => {
        if (!current) return;
        setPeople(value);
        if (!ownerChanged.current) return;
        ownerChanged.current = false;
        form.setFieldValue(
          'divisions',
          (form.getFieldValue('divisions') || []).map((division: Division) => ({
            ...division,
            station_id: value.default_station_id ?? undefined,
            staff_ids: [],
            responsibilities: {},
          })),
        );
      })
      .catch((failure: Error) => {
        if (current) setScopeError(failure.message);
      });
    return () => {
      current = false;
    };
  }, [form, responsible, scopeRetry]);

  const submit = (values: Values) => {
    if (!people) return;
    setError('');
    const responsibleOption = options?.responsibles.find(
      (row) => row.id === values.responsible_staff_id,
    );
    if (!responsibleOption) return setError('请选择任务负责人');
    const date = values.planned_date.format('YYYY-MM-DD');
    const body: NonorderCreation['task'] = {
      responsible_staff_id: values.responsible_staff_id,
      content: values.content.trim(),
      category_code: values.category_code,
      acceptance_standard: values.acceptance_standard.trim(),
      planned_date: date,
      reviewer_staff_id: needsReviewer ? values.reviewer_staff_id : undefined,
      divisions: values.divisions.map((division) => ({
        content: `${division.work_item} · ${division.scope?.trim()}\n工作目标：${division.objective?.trim()}`,
        category_code: division.category_code || values.category_code,
        work_item: division.work_item,
        scope: division.scope,
        objective: division.objective,
        acceptance_standard: division.acceptance_standard?.trim(),
        planned_date: division.planned_date?.format('YYYY-MM-DD') || date,
        due_at: division.due_at?.format('YYYY-MM-DDTHH:mm:ss'),
        station_id: division.station_id || null,
        station_name: people.stations.find(
          (station) => station.id === division.station_id,
        )?.name,
        members: (division.staff_ids || []).map((staff_id) => ({
          staff_id,
          staff_name:
            people.scanners.find((person) => person.id === staff_id)?.name ||
            staff_id,
          responsibility: division.responsibilities?.[staff_id]?.trim() || '',
        })),
      })),
    };
    try {
      onAdd({
        task: body,
        responsible_name: responsibleOption.name,
        request_id:
          initial?.request_id ||
          `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '暂存失败');
    }
  };

  return (
    <Drawer
      title={`${initial ? '修改无工单安排' : '新增无工单安排'} · ${day}`}
      size={720}
      open
      onClose={onClose}
      extra={
        <Button type="primary" disabled={!people} onClick={() => form.submit()}>
          {initial ? '保存草稿' : '加入安排单'}
        </Button>
      }
    >
      {error && (
        <Alert
          type="error"
          title={error}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={submit}
        initialValues={initialForm(day, initial)}
      >
        <Form.Item
          name="responsible_staff_id"
          label="任务负责人"
          rules={required}
        >
          <Select
            placeholder="选择负责线长"
            loading={!options && !error}
            showSearch={{ optionFilterProp: 'label' }}
            onChange={() => {
              ownerChanged.current = true;
              setPeople(undefined);
              setError('');
              setScopeError('');
              form.setFieldValue('reviewer_staff_id', undefined);
            }}
            options={options?.responsibles.map((person) => ({
              value: person.id,
              label: person.name,
            }))}
          />
        </Form.Item>
        {scopeError && (
          <Alert
            type="error"
            title={scopeError}
            style={{ marginBottom: 16 }}
            action={
              <Button
                size="small"
                onClick={() => {
                  setScopeError('');
                  setScopeRetry((attempt) => attempt + 1);
                }}
              >
                重试
              </Button>
            }
          />
        )}
        <Form.Item label="任务名称" required htmlFor="content">
          <Space.Compact block>
            <Form.Item name="category_code" rules={required} noStyle>
              <Select
                aria-label="工作模块"
                style={{ flex: '0 0 152px' }}
                placeholder="工作模块"
                options={moduleOptions}
                onChange={(next) => {
                  if (next === category) return;
                  divisions.forEach((division, index) => {
                    if (!division.category_code) {
                      form.setFieldValue(
                        ['divisions', index, 'work_item'],
                        undefined,
                      );
                    }
                  });
                }}
              />
            </Form.Item>
            <Form.Item name="content" rules={requiredText} noStyle>
              <Input maxLength={150} placeholder="如：仓库盘点" />
            </Form.Item>
          </Space.Compact>
        </Form.Item>
        <Form.Item
          name="acceptance_standard"
          label="总体完成标准"
          rules={requiredText}
        >
          <Input.TextArea rows={2} maxLength={5000} />
        </Form.Item>
        <Form.Item name="planned_date" label="计划日期" rules={required}>
          <DatePicker />
        </Form.Item>
        <Form.List name="divisions">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name }, index) => {
                const division = divisions[name];
                const divisionCategory = division?.category_code || category;
                const moduleExpanded = expandedModuleKey === key;
                const overrideLabel = division?.category_code
                  ? options?.categories[division.category_code]
                  : undefined;
                const staff = division?.staff_ids || [];
                return (
                  <section
                    key={key}
                    style={{
                      borderTop: '1px solid #e5e7eb',
                      paddingTop: 16,
                      marginTop: 16,
                    }}
                  >
                    <Space
                      style={{
                        justifyContent: 'space-between',
                        width: '100%',
                        marginBottom: 12,
                      }}
                    >
                      <strong>分工 {index + 1}</strong>
                      <Space size={4}>
                        {overrideLabel && <small>{overrideLabel}</small>}
                        <Button
                          type="link"
                          size="small"
                          aria-expanded={moduleExpanded}
                          onClick={() =>
                            setExpandedModuleKey(
                              moduleExpanded ? undefined : key,
                            )
                          }
                        >
                          {moduleExpanded ? '收起模块' : '更换模块'}
                        </Button>
                        {fields.length > 1 && (
                          <Button
                            type="link"
                            danger
                            onClick={() => remove(name)}
                          >
                            移除分工
                          </Button>
                        )}
                      </Space>
                    </Space>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <Form.Item
                        name={[name, 'category_code']}
                        label="分工模块"
                        hidden={!moduleExpanded}
                      >
                        <Select
                          style={{ width: 190 }}
                          allowClear
                          placeholder={
                            options?.categories[category] || '沿用任务模块'
                          }
                          onChange={(next) => {
                            if ((next || category) !== divisionCategory) {
                              form.setFieldValue(
                                ['divisions', name, 'work_item'],
                                undefined,
                              );
                            }
                          }}
                          options={moduleOptions}
                        />
                      </Form.Item>
                      <Form.Item
                        name={[name, 'work_item']}
                        label="工作项"
                        rules={required}
                      >
                        <Select
                          style={{ width: 230 }}
                          disabled={!divisionCategory}
                          options={(
                            workItems[divisionCategory || ''] || []
                          ).map((value) => ({ value }))}
                        />
                      </Form.Item>
                    </div>
                    <Form.Item
                      name={[name, 'scope']}
                      label="具体工作或对象"
                      rules={requiredText}
                    >
                      <Input.TextArea rows={2} maxLength={1800} />
                    </Form.Item>
                    <Form.Item
                      name={[name, 'objective']}
                      label="问题或目标"
                      rules={requiredText}
                    >
                      <Input.TextArea rows={2} maxLength={1800} />
                    </Form.Item>
                    <Form.Item
                      name={[name, 'acceptance_standard']}
                      label="分工验收标准"
                      rules={requiredText}
                    >
                      <Input.TextArea rows={2} maxLength={5000} />
                    </Form.Item>
                    <Space align="start" wrap>
                      <Form.Item name={[name, 'station_id']} label="关联工站">
                        <Select
                          style={{ width: 185 }}
                          disabled={!people}
                          loading={scopeLoading}
                          allowClear
                          placeholder={people ? '不关联工站' : scopePlaceholder}
                          options={
                            people && [
                              { value: 0, label: '不关联工站' },
                              ...people.stations.map((station) => ({
                                value: station.id,
                                label: station.name,
                              })),
                            ]
                          }
                        />
                      </Form.Item>
                      <Form.Item
                        name={[name, 'planned_date']}
                        label="分工计划日期"
                      >
                        <DatePicker placeholder="沿用总任务日期" />
                      </Form.Item>
                      <Form.Item name={[name, 'due_at']} label="截止时间">
                        <DatePicker showTime />
                      </Form.Item>
                    </Space>
                    <Form.Item
                      name={[name, 'staff_ids']}
                      label="执行人员"
                      rules={[
                        {
                          required: true,
                          type: 'array',
                          min: 1,
                          message: '请选择执行人员',
                        },
                      ]}
                    >
                      <Select
                        mode="multiple"
                        allowClear
                        disabled={!people}
                        loading={scopeLoading}
                        placeholder={people ? '选择执行人员' : scopePlaceholder}
                        notFoundContent="无匹配的可指派人员"
                        showSearch={{ optionFilterProp: 'label' }}
                        options={people?.scanners.map((person) => ({
                          value: person.id,
                          label: person.name,
                        }))}
                      />
                    </Form.Item>
                    {staff.length > 1 &&
                      staff.map((staffId) => (
                        <Form.Item
                          key={staffId}
                          label={`${people?.scanners.find((person) => person.id === staffId)?.name || staffId}负责内容`}
                          rules={requiredText}
                          name={[name, 'responsibilities', staffId]}
                        >
                          <Input maxLength={5000} />
                        </Form.Item>
                      ))}
                  </section>
                );
              })}
              <Button
                onClick={() =>
                  add({ station_id: people?.default_station_id ?? undefined })
                }
                disabled={fields.length >= 50}
              >
                添加分工
              </Button>
            </>
          )}
        </Form.List>
        {needsReviewer && (
          <Form.Item
            name="reviewer_staff_id"
            label="负责人本人执行的核对人"
            rules={[
              ...required,
              {
                validator: (_, value) =>
                  performers.has(value)
                    ? Promise.reject(new Error('请选择未参与执行的人员'))
                    : Promise.resolve(),
              },
            ]}
            style={{ marginTop: 16 }}
          >
            <Select
              showSearch={{ optionFilterProp: 'label' }}
              options={people?.reviewers
                .filter((person) => !performers.has(person.id))
                .map((person) => ({ value: person.id, label: person.name }))}
            />
          </Form.Item>
        )}
      </Form>
    </Drawer>
  );
}
