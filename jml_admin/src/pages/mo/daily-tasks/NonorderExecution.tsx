import { useAccess } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  DatePicker,
  Drawer,
  Input,
  Modal,
  Table,
  Tag,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { businessTime } from './lifecycle';
import {
  downloadNonorderAttachment,
  type ExecutionRow,
  getNonorderDetail,
  getNonorderPending,
  getNonorderResult,
  nonorderCommand,
  type NonorderDetail,
  type NonorderInterval,
  type NonorderRecord,
  type NonorderResult,
} from './nonorderService';
import NonorderHandover from './NonorderHandover';

const groups = {
  planned: '已安排',
  unplanned: '未安排但有执行',
  cancelled_with_work: '安排已取消但有执行',
  activity: '当天提交与核对',
};
const states: Record<string, string> = {
  unreceived: '待接收',
  ready: '待开工',
  running: '进行中',
  paused: '已暂停',
  pending: '待核对',
  done: '已完成',
  returned: '已退回',
  materials: '待补材料',
  rework: '待补做',
  cancelled: '已取消',
  revoked: '已撤销',
  approved: '已通过',
  rejected: '未通过',
  unmet: '未达标',
  replied: '已回复',
  confirmed: '已确认',
};
const recordTypes = {
  completion: '完成提交',
  time_correction: '时间修正',
  feedback: '问题反馈',
};
const eventLabels: Record<string, string> = {
  submit: '提交完成',
  review: '核对',
  correct_time: '申请修正',
};
const dateTime = (value?: string | null) =>
  value ? value.replace('T', ' ').slice(0, 16) : '—';
function duration(value: number) {
  const minutes = Math.floor(value / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}小时${minutes % 60}分`
    : minutes
      ? `${minutes}分钟`
      : `${Math.floor(value)}秒`;
}
function intervals(rows: NonorderInterval[] = []) {
  return (
    rows
      .map(
        (row) =>
          `${dateTime(row.day_started_at || row.started_at)} 至 ${dateTime(row.day_ended_at || row.ended_at)}`,
      )
      .join('；') || '—'
  );
}

function intervalSeconds(rows: NonorderInterval[] = []) {
  return rows.reduce(
    (total, row) =>
      total +
      (businessTime(row.ended_at) - businessTime(row.started_at)) / 1000,
    0,
  );
}

function ReviewDetail({
  target,
  date,
  onClose,
  onChange,
}: {
  target: {
    taskId: number;
    assignmentId: number;
    row?: ExecutionRow;
    recordId?: number;
  };
  date: string;
  onClose: () => void;
  onChange: () => void;
}) {
  const { message, modal } = App.useApp();
  const [detail, setDetail] = useState<NonorderDetail>();
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<{
    record: NonorderRecord;
    decision: string;
    label: string;
  }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    let current = true;
    setError('');
    getNonorderDetail(target.taskId)
      .then((data) => {
        if (current) setDetail(data);
      })
      .catch((e: Error) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [target.taskId]);
  useEffect(load, [load]);
  const assignment = detail?.assignment.find(
    (row) => row.id === target.assignmentId,
  );
  const division = detail?.division.find(
    (row) => row.id === assignment?.division_id,
  );
  const records =
    detail?.work_record.filter(
      (row) => row.assignment_id === target.assignmentId,
    ) || [];
  if (target.recordId)
    records.sort(
      (a, b) =>
        Number(b.id === target.recordId) - Number(a.id === target.recordId),
    );
  const closed =
    !!assignment?.revoked_at || detail?.task.status === 'cancelled';
  const run = async (body: object) => {
    if (!detail || busy) return;
    setBusy(true);
    try {
      await nonorderCommand(detail.task, body);
      setAction(undefined);
      message.success('已处理');
      onChange();
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
      load();
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Drawer
        title={target.row?.division.content || division?.content || '执行详情'}
        size={680}
        open
        onClose={onClose}
      >
        {error && <Alert type="error" title={error} />}
        {!detail && !error && <p>正在读取执行详情…</p>}
        {target.row && (
          <section style={{ marginBottom: 16 }}>
            <strong>
              {target.row.assignment.staff_name} · {date}
            </strong>
            <p>
              任务负责人 {target.row.task.responsible_name} · 发布人{' '}
              {target.row.task.creator_name}
            </p>
            <p>负责内容 {target.row.assignment.responsibility}</p>
            <p>
              当天用时 {duration(target.row.seconds)} ·{' '}
              {intervals(target.row.segments)}
            </p>
            {target.row.daily_item && (
              <p>
                安排发布 {dateTime(target.row.daily_item.published_at)}
                {target.row.daily_item.snapshot?.division.station_name &&
                  ` · ${target.row.daily_item.snapshot.division.station_name}`}
                {target.row.daily_item.remark &&
                  ` · ${target.row.daily_item.remark}`}
              </p>
            )}
            {target.row.cancelled_items.map((plan) => (
              <p key={plan.id}>安排取消 {dateTime(plan.cancelled_at)}</p>
            ))}
            {!!target.row.events.length && (
              <p>
                当天提交与核对{' '}
                {target.row.events
                  .map(
                    (row) =>
                      `${eventLabels[row.event_type] || row.event_type} ${dateTime(row.occurred_at)}`,
                  )
                  .join('、')}
              </p>
            )}
          </section>
        )}
        {target.row && !!records.length && <h3>当前提交记录</h3>}
        {records.map((record) => {
          const timeDelta =
            intervalSeconds(record.payload.proposed_segments) -
            intervalSeconds(record.payload.before_segments);
          const decisions: [string, string][] = record.history_close
            ? [['unmet', '确认未达标']]
            : record.record_type === 'time_correction'
              ? [
                  ['approve', '确认修正'],
                  ['reject', '退回申请'],
                ]
              : record.record_type === 'feedback'
                ? [['reply', '回复']]
                : [
                    ['approve', '确认通过'],
                    ['materials', '退回补材料'],
                    closed ? ['unmet', '确认未达标'] : ['rework', '退回补做'],
                  ];
          return (
            <section
              key={record.id}
              style={{ borderTop: '1px solid #e5e7eb', padding: '14px 0' }}
            >
              <strong>{recordTypes[record.record_type]}</strong>{' '}
              <Tag>{states[record.status] || record.status}</Tag>
              <small>{dateTime(record.submitted_at)}</small>
              {record.record_type === 'completion' && (
                <>
                  <p>
                    提交时职责{' '}
                    {record.requirement_snapshot.responsibility || '—'}
                  </p>
                  <p>
                    验收要求{' '}
                    {record.requirement_snapshot.acceptance_standard || '—'}
                  </p>
                </>
              )}
              <p style={{ whiteSpace: 'pre-wrap' }}>{record.content}</p>
              {record.record_type === 'time_correction' && (
                <>
                  <p>原时段 {intervals(record.payload.before_segments)}</p>
                  <p>申请时段 {intervals(record.payload.proposed_segments)}</p>
                  {Number.isFinite(timeDelta) && (
                    <p>
                      用时变化 {timeDelta < 0 ? '−' : '+'}
                      {duration(Math.abs(timeDelta))}
                    </p>
                  )}
                </>
              )}
              {record.attachments.map((file) => (
                <Button
                  type="link"
                  key={file.key}
                  onClick={() =>
                    void downloadNonorderAttachment(file).catch(() =>
                      message.error('附件读取失败'),
                    )
                  }
                >
                  {file.name}
                </Button>
              ))}
              {record.reviewed_at && (
                <p>
                  核对时间 {dateTime(record.reviewed_at)}
                  {record.review_note && ` · ${record.review_note}`}
                </p>
              )}
              {record.can_review &&
                (record.status === 'pending' || record.history_close) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {decisions.map(([decision, label]) => (
                      <Button
                        key={decision}
                        type={decision === 'approve' ? 'primary' : 'default'}
                        onClick={() => {
                          setReason('');
                          setAction({ record, decision, label });
                        }}
                        disabled={busy}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                )}
            </section>
          );
        })}
        {detail && !records.length && <p>暂无提交记录</p>}
        {division?.can_confirm && (
          <Button
            type="primary"
            disabled={busy}
            onClick={() =>
              modal.confirm({
                title: '确认整条分工完成？',
                onOk: () =>
                  run({ action: 'confirm_division', division_id: division.id }),
              })
            }
          >
            确认分工完成
          </Button>
        )}
      </Drawer>
      <Modal
        title={action?.label}
        open={!!action}
        onCancel={() => setAction(undefined)}
        confirmLoading={busy}
        okText="确认"
        cancelText="返回"
        okButtonProps={{
          disabled: !!action && action.decision !== 'approve' && !reason.trim(),
        }}
        onOk={() =>
          action &&
          run({
            action: 'review',
            record_id: action.record.id,
            decision: action.decision,
            reason: reason.trim(),
          })
        }
      >
        <Input.TextArea
          aria-label="处理意见"
          placeholder={
            action?.decision === 'approve'
              ? '处理意见（选填）'
              : '处理意见（必填）'
          }
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={5000}
          rows={3}
        />
      </Modal>
    </>
  );
}

export default function NonorderExecution({
  initialDate,
  onSupplement,
}: {
  initialDate: string;
  onSupplement?: (date: string, assignment: number) => void;
}) {
  const access = useAccess();
  const allowView = access.can('nonorder.view');
  const canReview = allowView && access.can('nonorder.review');
  const canTransfer = access.can('nonorder.transfer');
  const [date, setDate] = useState(initialDate);
  const [mode, setMode] = useState(allowView ? 'result' : 'transfer');
  const [result, setResult] = useState<NonorderResult>();
  const [pending, setPending] = useState<
    Awaited<ReturnType<typeof getNonorderPending>>
  >([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [target, setTarget] =
    useState<React.ComponentProps<typeof ReviewDetail>['target']>();
  useEffect(() => {
    if (mode === 'transfer') return;
    let current = true;
    setLoading(true);
    setError('');
    setResult(undefined);
    setPending([]);
    const operation =
      mode === 'pending'
        ? getNonorderPending().then((data) => {
            if (current) setPending(data);
          })
        : getNonorderResult(date).then((data) => {
            if (current) setResult(data);
          });
    operation
      .catch((e: Error) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [date, mode, reload]);
  const items = result?.original.items || [];
  return (
    <section>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        {allowView && (
          <Button
            type={mode === 'result' ? 'primary' : 'default'}
            onClick={() => setMode('result')}
          >
            按执行日期
          </Button>
        )}
        {canReview && (
          <Button
            type={mode === 'pending' ? 'primary' : 'default'}
            onClick={() => setMode('pending')}
          >
            待我核对
          </Button>
        )}
        {canTransfer && (
          <Button
            type={mode === 'transfer' ? 'primary' : 'default'}
            onClick={() => setMode('transfer')}
          >
            待交接
          </Button>
        )}
        {mode === 'result' && (
          <DatePicker
            value={dayjs(date)}
            allowClear={false}
            aria-label="执行日期"
            onChange={(value) => value && setDate(value.format('YYYY-MM-DD'))}
          />
        )}
        {mode !== 'transfer' && (
          <Button
            loading={loading}
            onClick={() => setReload((value) => value + 1)}
          >
            刷新
          </Button>
        )}
        {mode === 'result' && result?.locked && (
          <Tag>
            {result.frozen || !items.length ? '结果已锁定' : '结果快照待保存'}
          </Tag>
        )}
      </div>
      {mode !== 'transfer' && error && <Alert type="error" title={error} />}
      {mode === 'transfer' && <NonorderHandover />}
      {mode === 'pending' && (
        <Table
          rowKey="id"
          loading={loading}
          dataSource={pending}
          size="small"
          columns={[
            { title: '任务', dataIndex: 'task_content' },
            { title: '执行人员', dataIndex: 'staff_name' },
            { title: '事项', render: (_, row) => recordTypes[row.record_type] },
            {
              title: '提交时间',
              render: (_, row) => dateTime(row.submitted_at),
            },
            {
              title: '操作',
              render: (_, row) => (
                <Button
                  type="link"
                  onClick={() =>
                    setTarget({
                      taskId: row.task_id,
                      assignmentId: row.assignment_id,
                      recordId: row.id,
                    })
                  }
                >
                  核对
                </Button>
              ),
            },
          ]}
        />
      )}
      {mode === 'result' && !error && (
        <>
          {loading && <p>正在读取执行记录…</p>}
          {result &&
            (Object.keys(groups) as (keyof typeof groups)[]).map((group) => {
              const rows = items.filter((row) => {
                const activityOnly =
                  row.activity_only ??
                  (row.arrangement !== 'planned' &&
                    !row.seconds &&
                    !row.events.some((event) => event.event_type === 'submit'));
                return (activityOnly ? 'activity' : row.arrangement) === group;
              });
              if (group === 'activity' && !rows.length) return null;
              return (
                <section key={group} style={{ marginBottom: 20 }}>
                  <h3>
                    {groups[group]} <small>· {rows.length} 人</small>
                  </h3>
                  {!!rows.length && (
                    <Table<ExecutionRow>
                      size="small"
                      pagination={false}
                      rowKey={(row) =>
                        `nonorder:execution:${row.assignment.id}`
                      }
                      dataSource={rows}
                      columns={[
                        {
                          title: '工作项 / 任务',
                          render: (_, row) => (
                            <>
                              <strong>{row.division.content}</strong>
                              <br />
                              <small>{row.task.content}</small>
                            </>
                          ),
                        },
                        {
                          title: '执行人员',
                          render: (_, row) => row.assignment.staff_name,
                        },
                        {
                          title: '工站 / 负责人',
                          render: (_, row) =>
                            row.division.station_name ||
                            `无工站 · ${row.task.responsible_name}`,
                        },
                        {
                          title: '当日用时',
                          render: (_, row) => duration(row.seconds),
                        },
                        {
                          title: '执行 / 核对',
                          render: (_, row) => {
                            const latest = row.records
                              .filter(
                                (record) => record.record_type === 'completion',
                              )
                              .at(-1);
                            return (
                              <>
                                {states[row.assignment.status] ||
                                  row.assignment.status}
                                {latest &&
                                  states[latest.status] !==
                                    states[row.assignment.status] && (
                                    <Tag>
                                      {states[latest.status] || latest.status}
                                    </Tag>
                                  )}
                                {row.has_draft && <Tag>当天计划未发布</Tag>}
                                {!!row.other_dates?.length && (
                                  <small>
                                    另已安排 {row.other_dates.join('、')}
                                  </small>
                                )}
                              </>
                            );
                          },
                        },
                        {
                          title: '操作',
                          render: (_, row) => (
                            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                              <Button
                                type="link"
                                onClick={() =>
                                  setTarget({
                                    taskId: row.task.id,
                                    assignmentId: row.assignment.id,
                                    row,
                                  })
                                }
                              >
                                {row.records.some(
                                  (record) =>
                                    record.can_review &&
                                    (record.status === 'pending' ||
                                      record.history_close),
                                )
                                  ? '核对'
                                  : '详情'}
                              </Button>
                              {row.can_supplement && onSupplement && (
                                <Button
                                  type="link"
                                  onClick={() =>
                                    onSupplement(date, row.assignment.id)
                                  }
                                >
                                  补充安排
                                </Button>
                              )}
                            </div>
                          ),
                        },
                      ]}
                    />
                  )}
                </section>
              );
            })}
          {!!result?.later_changes.length && (
            <section>
              <h3>跨日后续记录</h3>
              {result.later_changes.map(
                ({ event_id, effective_at, record, staff_name, work }) => (
                  <p key={event_id}>
                    {dateTime(effective_at)}
                    {staff_name && ` · ${staff_name}`}
                    {work && ` · ${work}`} · {recordTypes[record.record_type]} ·{' '}
                    {states[record.status] || record.status}
                    {record.review_note && ` · ${record.review_note}`}
                    {record.record_type === 'time_correction' && (
                      <>
                        {' '}
                        · 原时段 {intervals(record.payload.before_segments)} ·
                        修正时段 {intervals(record.payload.proposed_segments)}
                      </>
                    )}
                  </p>
                ),
              )}
            </section>
          )}
        </>
      )}
      {target && (
        <ReviewDetail
          target={target}
          date={date}
          onClose={() => setTarget(undefined)}
          onChange={() => setReload((value) => value + 1)}
        />
      )}
    </section>
  );
}
