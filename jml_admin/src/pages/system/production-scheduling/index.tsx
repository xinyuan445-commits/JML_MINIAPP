import {
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import {
  App,
  Button,
  Card,
  DatePicker,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import {
  type CalendarException,
  type CalendarPeriod,
  getSchedulingConfiguration,
  importHolidays,
  saveCalendar,
  saveHandover,
  savePolicy,
  type ScheduleHandover,
  type SchedulePolicy,
  type SchedulingConfiguration,
  type WorkCalendar,
  type WorkInterval,
} from './service';

const weekdays = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const intervalText = (intervals: WorkInterval[]) =>
  intervals.map(([start, end]) => `${start}-${end}`).join(',');
const parseIntervals = (value: string): WorkInterval[] =>
  value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [start, end] = item.split('-').map((part) => part.trim());
      return [start, end] as WorkInterval;
    });

function PeriodEditor({
  period,
  onChange,
}: {
  period: CalendarPeriod;
  onChange: (next: CalendarPeriod) => void;
}) {
  const workingWeeks = period.weeks.filter((item) => item.intervals.length > 0);
  const workdays = workingWeeks.map((item) => item.weekday);
  const intervals = workingWeeks[0]?.intervals || [];
  const updateDays = (days: number[]) =>
    onChange({
      ...period,
      weeks: weekdays.map(({ value }) => ({
        weekday: value,
        intervals: days.includes(value) ? intervals : [],
      })),
    });
  const updateIntervals = (text: string) => {
    const nextIntervals = parseIntervals(text);
    onChange({
      ...period,
      weeks: weekdays.map(({ value }) => ({
        weekday: value,
        intervals: workdays.includes(value) ? nextIntervals : [],
      })),
    });
  };
  return (
    <Card size="small" title={period.period_name}>
      <Space wrap size={12}>
        <Input
          aria-label="作息名称"
          value={period.period_name}
          style={{ width: 150 }}
          onChange={(event) => onChange({ ...period, period_name: event.target.value })}
        />
        <Input
          addonBefore="开始"
          value={period.start_month_day}
          style={{ width: 145 }}
          onChange={(event) => onChange({ ...period, start_month_day: event.target.value })}
        />
        <Input
          addonBefore="结束"
          value={period.end_month_day}
          style={{ width: 145 }}
          onChange={(event) => onChange({ ...period, end_month_day: event.target.value })}
        />
        <Select
          mode="multiple"
          value={workdays}
          options={weekdays}
          style={{ minWidth: 300 }}
          onChange={updateDays}
        />
        <Input
          addonBefore="时段"
          defaultValue={intervalText(intervals)}
          style={{ width: 300 }}
          placeholder="08:00-12:00,13:00-17:00"
          onBlur={(event) => updateIntervals(event.target.value)}
        />
      </Space>
    </Card>
  );
}

export default function ProductionSchedulingPage() {
  const canManage = useAccess().can('production-scheduling.manage');
  const { message } = App.useApp();
  const [data, setData] = useState<SchedulingConfiguration>();
  const [calendar, setCalendar] = useState<WorkCalendar>();
  const [policy, setPolicy] = useState<SchedulePolicy>();
  const [handover, setHandover] = useState<Partial<ScheduleHandover>>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async (calendarId?: number, policyId?: number) => {
    setLoading(true);
    try {
      const next = await getSchedulingConfiguration();
      setData(next);
      const selectedCalendar = next.calendars.find((item) => item.id === calendarId)
        || next.calendars.find((item) => item.is_default)
        || next.calendars[0];
      const selectedPolicy = next.policies.find((item) => item.id === policyId)
        || next.policies.find((item) => item.is_default)
        || next.policies[0];
      setCalendar(selectedCalendar ? clone(selectedCalendar) : undefined);
      setPolicy(selectedPolicy ? clone(selectedPolicy) : undefined);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const manualExceptions = calendar?.exceptions.filter((item) => item.source === 'manual') || [];
  const importedExceptions = calendar?.exceptions.filter((item) => item.source !== 'manual') || [];
  const calendarOptions = data?.calendars.map((item) => ({ value: item.id, label: item.calendar_name })) || [];
  const policyOptions = data?.policies.map((item) => ({ value: item.id, label: item.policy_name })) || [];
  const processOptions = (data?.processes || []).map((item) => ({ value: item.id, label: item.process_name }));
  const routeOptions = [{ value: 0, label: '通用' }, ...(data?.routes || []).map((item) => ({
    value: item.id, label: `${item.route_name} · ${item.route_code}`,
  }))];

  const updateManualException = (index: number, next: CalendarException) => {
    if (!calendar) return;
    const imported = calendar.exceptions.filter((item) => item.source !== 'manual');
    const manual = [...manualExceptions];
    manual[index] = next;
    setCalendar({ ...calendar, exceptions: [...imported, ...manual] });
  };

  const saveCurrentCalendar = async () => {
    if (!calendar) return;
    setSaving(true);
    try {
      await saveCalendar(calendar);
      message.success('生产日历已保存');
      await load(calendar.id, policy?.id);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const importCurrentYear = async () => {
    if (!calendar) return;
    setSaving(true);
    try {
      const result = await importHolidays(calendar.id, dayjs().year());
      message.success(`已导入 ${result.imported} 条，保留人工配置 ${result.skipped} 条`);
      await load(calendar.id, policy?.id);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '导入失败');
    } finally {
      setSaving(false);
    }
  };

  const saveCurrentPolicy = async () => {
    if (!policy) return;
    setSaving(true);
    try {
      await savePolicy({ ...policy, is_default: true });
      message.success('默认策略已保存');
      await load(calendar?.id, policy.id);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const saveCurrentHandover = async () => {
    if (!handover) return;
    setSaving(true);
    try {
      await saveHandover(handover);
      message.success('交割时间已保存');
      setHandover(undefined);
      await load(calendar?.id, policy?.id);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const calendarTab = calendar ? (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card loading={loading}>
        <Space wrap size={12}>
          <Select
            value={calendar.id}
            options={calendarOptions}
            style={{ width: 220 }}
            onChange={(id) => {
              const selected = data?.calendars.find((item) => item.id === id);
              if (selected) setCalendar(clone(selected));
            }}
          />
          <Input
            value={calendar.calendar_name}
            style={{ width: 220 }}
            onChange={(event) => setCalendar({ ...calendar, calendar_name: event.target.value })}
          />
          <Space><Switch checked={calendar.is_default} onChange={(value) => setCalendar({ ...calendar, is_default: value })} />默认</Space>
          <Space><Switch checked={calendar.is_active} onChange={(value) => setCalendar({ ...calendar, is_active: value })} />启用</Space>
          <Tag>{calendar.timezone}</Tag>
          <Button disabled={!canManage || saving} onClick={() => void importCurrentYear()}>
            导入 {dayjs().year()} 节假日
          </Button>
          <Button type="primary" disabled={!canManage} loading={saving} onClick={() => void saveCurrentCalendar()}>
            保存日历
          </Button>
        </Space>
      </Card>
      {calendar.periods.map((item, index) => (
        <PeriodEditor
          key={item.id || `${item.period_name}-${item.start_month_day}-${item.end_month_day}`}
          period={item}
          onChange={(next) => {
            const periods = [...calendar.periods];
            periods[index] = next;
            setCalendar({ ...calendar, periods });
          }}
        />
      ))}
      <Card
        title="特殊日期"
        extra={
          <Button
            icon={<PlusOutlined />}
            disabled={!canManage}
            onClick={() => setCalendar({
              ...calendar,
              exceptions: [...calendar.exceptions, {
                work_date: dayjs().format('YYYY-MM-DD'),
                exception_type: 'rest',
                intervals: [],
                reason: '',
                source: 'manual',
              }],
            })}
          >
            新增
          </Button>
        }
      >
        <Table
          rowKey={(row) => `${row.source}-${row.work_date}-${row.id || 'new'}`}
          pagination={false}
          size="small"
          dataSource={manualExceptions}
          columns={[
            {
              title: '日期',
              width: 160,
              render: (_, row, index) => (
                <DatePicker
                  value={dayjs(row.work_date)}
                  onChange={(value) => updateManualException(index, { ...row, work_date: value?.format('YYYY-MM-DD') || row.work_date })}
                />
              ),
            },
            {
              title: '类型',
              width: 130,
              render: (_, row, index) => (
                <Select
                  value={row.exception_type}
                  options={[{ value: 'rest', label: '休息' }, { value: 'work', label: '上班' }]}
                  onChange={(value) => updateManualException(index, { ...row, exception_type: value, intervals: value === 'work' ? row.intervals : [] })}
                />
              ),
            },
            {
              title: '工作时段',
              render: (_, row, index) => (
                <Input
                  disabled={row.exception_type === 'rest'}
                  defaultValue={intervalText(row.intervals)}
                  placeholder="08:00-12:00,13:00-17:00"
                  onBlur={(event) => updateManualException(index, { ...row, intervals: parseIntervals(event.target.value) })}
                />
              ),
            },
            {
              title: '原因',
              render: (_, row, index) => (
                <Input value={row.reason} onChange={(event) => updateManualException(index, { ...row, reason: event.target.value })} />
              ),
            },
            {
              title: '',
              width: 54,
              render: (_, _row, index) => (
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => setCalendar({
                    ...calendar,
                    exceptions: calendar.exceptions.filter((item) => item.source !== 'manual' || item !== manualExceptions[index]),
                  })}
                />
              ),
            },
          ]}
        />
        {importedExceptions.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Tag color="blue">已导入 {importedExceptions.length} 个法定节假日/调休日</Tag>
          </div>
        )}
      </Card>
    </Space>
  ) : <Card loading={loading}>请先初始化生产日历</Card>;


  const policyTab = policy ? (
    <Card loading={loading}>
      <Space wrap size={12}>
        <Select
          aria-label="排程策略"
          value={policy.id}
          options={policyOptions}
          style={{ width: 160 }}
          onChange={(id) => {
            const selected = data?.policies.find((item) => item.id === id);
            if (selected) setPolicy(clone(selected));
          }}
        />
        <span>{policy.description}</span>
        {policy.is_default ? <Tag color="blue">默认策略</Tag> : (
          <Button type="primary" disabled={!canManage} loading={saving} onClick={() => void saveCurrentPolicy()}>
            设为默认
          </Button>
        )}
      </Space>
    </Card>
  ) : <Card loading={loading}>请先初始化排程策略</Card>;

  const handoverTab = (
    <Card
      loading={loading}
      extra={canManage && (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setHandover({ route_id: 0, is_active: true })}>
          新增交割
        </Button>
      )}
    >
      {handover && (
        <Space wrap style={{ marginBottom: 16 }}>
          <Select aria-label="适用路线" style={{ width: 220 }} options={routeOptions}
            showSearch={{ optionFilterProp: 'label' }} value={handover.route_id}
            onChange={(route_id) => setHandover({ ...handover, route_id })} />
          <Select aria-label="上道工序" placeholder="上道工序" style={{ width: 160 }} options={processOptions}
            showSearch={{ optionFilterProp: 'label' }} value={handover.from_process_id}
            onChange={(from_process_id) => setHandover({ ...handover, from_process_id })} />
          <Select aria-label="下道工序" placeholder="下道工序" style={{ width: 160 }} options={processOptions}
            showSearch={{ optionFilterProp: 'label' }} value={handover.to_process_id}
            onChange={(to_process_id) => setHandover({ ...handover, to_process_id })} />
          <InputNumber aria-label="交割分钟" placeholder="交割分钟" min={0} max={525600} precision={0}
            value={handover.minutes} onChange={(minutes) => setHandover({ ...handover, minutes: minutes ?? undefined })} />
          <Space>
            <Switch checked={handover.is_active} onChange={(is_active) => setHandover({ ...handover, is_active })} />
            启用
          </Space>
          <Button type="primary" loading={saving}
            disabled={!handover.from_process_id || !handover.to_process_id || handover.minutes == null}
            onClick={() => void saveCurrentHandover()}>保存</Button>
          <Button disabled={saving} onClick={() => setHandover(undefined)}>取消</Button>
        </Space>
      )}
      <Table<ScheduleHandover>
        rowKey="id"
        dataSource={data?.handovers || []}
        pagination={false}
        columns={[
          { title: '适用路线', dataIndex: 'route_id', render: (id) => routeOptions.find((item) => item.value === id)?.label || '—' },
          { title: '上道工序', dataIndex: 'from_process_id', render: (id) => processOptions.find((item) => item.value === id)?.label || '—' },
          { title: '下道工序', dataIndex: 'to_process_id', render: (id) => processOptions.find((item) => item.value === id)?.label || '—' },
          { title: '交割分钟', dataIndex: 'minutes' },
          { title: '状态', dataIndex: 'is_active', render: (active) => active ? '启用' : '停用' },
          ...(canManage ? [{
            title: '操作',
            render: (_: unknown, row: ScheduleHandover) => <Button type="link" onClick={() => setHandover({ ...row })}>编辑</Button>,
          }] : []),
        ]}
      />
    </Card>
  );


  return (
    <PageContainer title="生产排程">
      <Tabs items={[
        { key: 'calendar', label: '生产日历', children: calendarTab },
        { key: 'policy', label: '排程策略', children: policyTab },
        { key: 'handover', label: '工序交割', children: handoverTab },
      ]} />
    </PageContainer>
  );
}
