import {
  Alert,
  App,
  Button,
  DatePicker,
  Input,
  Modal,
  Select,
  Table,
  Tag,
} from 'antd';
import { useEffect, useState } from 'react';
import {
  getNonorderPeople,
  getTransferTasks,
  nonorderCommand,
  type NonorderStaff,
  type TransferTask,
} from './nonorderService';

const actions = {
  transfer: '交接任务',
  delegate: '指定代管',
  reviewer: '更换核对人',
  revoke: '撤销代管',
};
type Action = keyof typeof actions;
type Edit = { task: TransferTask; action: Action; grant_id?: number };
const rights = [
  { value: 'adjust', label: '调整任务' },
  { value: 'review', label: '成果核对' },
  { value: 'time_review', label: '时间核对' },
];

function HandoverAction({
  edit,
  close,
  saved,
}: {
  edit: Edit;
  close: () => void;
  saved: () => void;
}) {
  const { message } = App.useApp();
  const [staff, setStaff] = useState<string>();
  const [reviewer, setReviewer] = useState(edit.task.reviewer?.staff_id);
  const [people, setPeople] = useState<NonorderStaff[]>([]);
  const [reviewers, setReviewers] = useState<NonorderStaff[]>([]);
  const [stations, setStations] = useState<number[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [endsAt, setEndsAt] = useState<string>();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { task, action } = edit;
  const person = people.find((row) => row.id === staff);
  const needsReviewer =
    action === 'transfer' && (task.needs_reviewer || person?.requires_reviewer);
  useEffect(() => {
    if (action === 'revoke') return;
    let current = true;
    const getPeople =
      action === 'reviewer'
        ? Promise.resolve([])
        : getNonorderPeople(task.id, action);
    const getReviewers =
      action === 'delegate'
        ? Promise.resolve([])
        : getNonorderPeople(task.id, 'reviewer');
    Promise.all([getPeople, getReviewers])
      .then(([a, b]) => {
        if (current) {
          setPeople(a);
          setReviewers(b);
        }
      })
      .catch((e: Error) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [task.id, action]);
  const validReviewer = reviewers.some(
    (candidate) => candidate.id === reviewer && candidate.id !== staff,
  );
  const invalid =
    !reason.trim() ||
    (action === 'transfer' &&
      (!person ||
        (!person.exempt && !stations.length) ||
        (needsReviewer && !validReviewer))) ||
    (action === 'delegate' && (!staff || !endsAt || !permissions.length)) ||
    (action === 'reviewer' && !validReviewer);
  const submit = async () => {
    if (saving || invalid) return;
    setSaving(true);
    setError('');
    const common = { reason: reason.trim() };
    const body =
      action === 'transfer'
        ? {
            ...common,
            action,
            staff_id: staff,
            qualification_station_ids: stations,
            reviewer_staff_id: needsReviewer ? reviewer : undefined,
          }
        : action === 'delegate'
          ? {
              ...common,
              action: 'grant',
              staff_id: staff,
              permissions,
              ends_at: endsAt,
            }
          : action === 'reviewer'
            ? { ...common, action: 'set_reviewer', reviewer_staff_id: reviewer }
            : { ...common, action: 'revoke_grant', grant_id: edit.grant_id };
    try {
      await nonorderCommand(task, body);
      message.success('已处理');
      saved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={actions[action]}
      open
      onCancel={close}
      onOk={() => void submit()}
      okText="确认"
      cancelText="返回"
      confirmLoading={saving}
      okButtonProps={{ disabled: invalid }}
    >
      <p>{task.content}</p>
      {error && <Alert type="error" title={error} />}
      <div style={{ display: 'grid', gap: 12 }}>
        {(action === 'transfer' || action === 'delegate') && (
          <Select
            placeholder={action === 'transfer' ? '选择接管人' : '选择代管人'}
            value={staff}
            showSearch={{ optionFilterProp: 'label' }}
            onChange={(id) => {
              setStaff(id);
              setStations([]);
              if (id === reviewer) setReviewer(undefined);
            }}
            options={people.map((row) => ({ value: row.id, label: row.name }))}
          />
        )}
        {action === 'transfer' && person && !person.exempt && (
          <Select
            mode="multiple"
            placeholder="接管资格工站"
            value={stations}
            onChange={setStations}
            options={person.stations?.map((row) => ({
              value: row.id,
              label: row.name,
            }))}
          />
        )}
        {(needsReviewer || action === 'reviewer') && (
          <Select
            placeholder="选择本人执行核对人"
            value={reviewer}
            onChange={setReviewer}
            showSearch={{ optionFilterProp: 'label' }}
            options={reviewers
              .filter((row) => row.id !== staff)
              .map((row) => ({ value: row.id, label: row.name }))}
          />
        )}
        {action === 'delegate' && (
          <>
            <Select
              mode="multiple"
              placeholder="代管权限"
              value={permissions}
              options={rights}
              onChange={setPermissions}
            />
            <DatePicker
              showTime
              placeholder="代管结束时间（北京时间）"
              onChange={(value) =>
                setEndsAt(value?.format('YYYY-MM-DDTHH:mm:ss'))
              }
            />
          </>
        )}
        <Input.TextArea
          aria-label="原因"
          placeholder="原因（必填）"
          rows={3}
          value={reason}
          maxLength={5000}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
}

export default function NonorderHandover() {
  const [tasks, setTasks] = useState<TransferTask[]>([]);
  const [filter, setFilter] = useState('pending');
  const [reload, setReload] = useState(0);
  const [edit, setEdit] = useState<Edit>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    getTransferTasks()
      .then((data) => {
        if (current) setTasks(data);
      })
      .catch((e: Error) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [reload]);
  return (
    <>
      <Select
        aria-label="交接范围"
        value={filter}
        onChange={setFilter}
        style={{ width: 140, marginBottom: 12 }}
        options={[
          { value: 'pending', label: '待交接' },
          { value: 'all', label: '已发布任务' },
        ]}
      />
      <Button
        loading={loading}
        onClick={() => setReload((value) => value + 1)}
        style={{ marginLeft: 8 }}
      >
        刷新
      </Button>
      {error && <Alert type="error" title={error} />}
      <Table<TransferTask>
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={tasks.filter(
          (task) => filter === 'all' || task.needs_transfer,
        )}
        columns={[
          { title: '任务', dataIndex: 'content' },
          {
            title: '当前负责人',
            render: (_, task) => (
              <>
                {task.responsible_name}{' '}
                {task.needs_transfer && <Tag color="warning">待处理</Tag>}
              </>
            ),
          },
          {
            title: '代管',
            render: (_, task) =>
              task.delegates.map((grant) => (
                <div key={grant.id}>
                  {grant.staff_name} · 至{' '}
                  {grant.ends_at.replace('T', ' ').slice(0, 16)}
                  <Button
                    type="link"
                    size="small"
                    onClick={() =>
                      setEdit({ task, action: 'revoke', grant_id: grant.id })
                    }
                  >
                    撤销
                  </Button>
                </div>
              )),
          },
          {
            title: '操作',
            render: (_, task) => (
              <>
                <Button
                  type="link"
                  onClick={() => setEdit({ task, action: 'transfer' })}
                >
                  交接
                </Button>
                {task.status === 'active' && (
                  <Button
                    type="link"
                    onClick={() => setEdit({ task, action: 'delegate' })}
                  >
                    指定代管
                  </Button>
                )}
                {task.needs_reviewer && (
                  <Button
                    type="link"
                    onClick={() => setEdit({ task, action: 'reviewer' })}
                  >
                    {task.reviewer ? '更换核对人' : '指定核对人'}
                  </Button>
                )}
              </>
            ),
          },
        ]}
      />
      {edit && (
        <HandoverAction
          edit={edit}
          close={() => setEdit(undefined)}
          saved={() => {
            setEdit(undefined);
            setReload((value) => value + 1);
          }}
        />
      )}
    </>
  );
}
