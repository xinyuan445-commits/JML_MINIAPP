import { request } from '@umijs/max';

export type NonorderTask = {
  id: number;
  task_no: string;
  content: string;
  status: string;
  revision: number;
  creator_name: string;
  responsible_name: string;
  responsible_staff_id: string;
  acceptance_standard: string;
};

export type NonorderDivision = {
  id: number;
  content: string;
  planned_date: string | null;
  due_at: string | null;
  station_id: number | null;
  station_name: string | null;
  acceptance_standard: string;
  can_confirm?: boolean;
};

export type NonorderAssignment = {
  id: number;
  division_id: number;
  revision: number;
  staff_id: string;
  staff_name: string;
  responsibility: string;
  status: string;
  revoked_at: string | null;
  requirement_snapshot: {
    content?: string;
    acceptance_standard?: string;
    responsibility?: string;
  };
};

export type NonorderPerson = {
  key: string;
  task: NonorderTask;
  division: NonorderDivision;
  assignment: NonorderAssignment;
  group: { type: 'station' | 'leader'; id: number | string; name: string };
  can_plan: boolean;
  can_edit_work?: boolean;
};

export type NonorderCandidate = NonorderPerson & {
  occupied: boolean;
  arranged_dates: string[];
  started: boolean;
};

export type NonorderPlan = NonorderPerson & {
  id: number;
  sheet_id: number;
  work_date: string;
  revision: number;
  sort_order: number;
  remark: string;
  status: 'draft' | 'published' | 'cancelled';
  can_publish: boolean;
  can_replan: boolean;
  station_changed: boolean;
  cancelled_at?: string | null;
  created_at: string;
  published_at?: string | null;
  snapshot?: { division: NonorderDivision };
};
export type NonorderHistory = {
  key: string;
  occurred_at: string;
  actor: string;
  work: string;
  staff_name: string;
  action: string;
  work_date: string;
  old_date: string;
  remark?: string | null;
};

export const groupKey = ({ group }: NonorderPerson) =>
  `${group.type}:${group.id}`;

export type NonorderInterval = {
  id: number;
  started_at: string;
  ended_at: string;
  day_started_at?: string;
  day_ended_at?: string;
};
export type NonorderRecord = {
  id: number;
  assignment_id: number;
  record_type: 'completion' | 'feedback' | 'time_correction';
  content: string;
  status: string;
  submitted_at: string;
  reviewed_at?: string | null;
  review_note?: string | null;
  return_kind?: string | null;
  can_review: boolean;
  history_close: boolean;
  attachments: { key: string; name: string }[];
  requirement_snapshot: NonorderAssignment['requirement_snapshot'];
  payload: {
    work_submitted_at?: string;
    before_segments?: NonorderInterval[];
    proposed_segments?: NonorderInterval[];
  };
};
export type ExecutionRow = {
  task: NonorderTask;
  division: NonorderDivision;
  assignment: NonorderAssignment;
  seconds: number;
  segments: NonorderInterval[];
  events: {
    id: number;
    event_type: string;
    occurred_at: string;
    record_id?: number;
  }[];
  records: NonorderRecord[];
  arrangement: 'planned' | 'unplanned' | 'cancelled_with_work';
  activity_only?: boolean;
  daily_item: NonorderPlan | null;
  cancelled_items: NonorderPlan[];
  has_draft: boolean;
  other_dates?: string[];
  can_supplement?: boolean;
};
export type NonorderResult = {
  frozen: boolean;
  locked?: boolean;
  original: { items: ExecutionRow[] };
  later_changes: {
    event_id: number;
    effective_at: string;
    staff_name?: string | null;
    work?: string;
    record: NonorderRecord;
  }[];
};
export type NonorderDetail = {
  task: NonorderTask;
  assignment: NonorderAssignment[];
  division: NonorderDivision[];
  work_record: NonorderRecord[];
  rights: { owner: boolean };
  needs_reviewer: boolean;
  reviewer: { staff_id: string; name: string } | null;
};
export type TransferTask = Pick<
  NonorderTask,
  | 'id'
  | 'revision'
  | 'content'
  | 'responsible_name'
  | 'responsible_staff_id'
  | 'status'
> & {
  needs_transfer: boolean;
  needs_reviewer: boolean;
  reviewer: { staff_id: string; name: string } | null;
  delegates: {
    id: number;
    staff_name: string;
    ends_at: string;
    permissions: string[];
  }[];
};
export type NonorderStaff = {
  id: string;
  name: string;
  exempt?: boolean;
  requires_reviewer?: boolean;
  stations?: { id: number; name: string }[];
};

export async function getSheetWorkPeople(assignmentId: number) {
  const result = await request<{ data: NonorderStaff[] }>('/api/nonorder/sheet-work-people', {
    params: { assignment_id: assignmentId },
  });
  return result.data;
}

export type NonorderCreation = {
  request_id: string;
  responsible_name: string;
  task: {
    responsible_staff_id: string;
    content: string;
    category_code?: string;
    acceptance_standard: string;
    planned_date: string;
    reviewer_staff_id?: string;
    divisions: {
      content: string;
      work_item?: string;
      scope?: string;
      objective?: string;
      category_code?: string;
      acceptance_standard?: string;
      planned_date: string;
      due_at?: string;
      station_id: number | null;
      station_name?: string;
      members: {
        staff_id: string;
        staff_name: string;
        responsibility: string;
      }[];
    }[];
  };
};

async function call<T>(path: string, params?: object, data?: object) {
  try {
    const result = await request<{ code: number; msg?: string; data: T }>(
      `/api/nonorder/${path}`,
      {
        params,
        data,
        method: data ? 'POST' : 'GET',
        skipErrorHandler: true,
      },
    );
    if (result.code !== 0) throw new Error(result.msg || '操作失败');
    return result.data;
  } catch (error) {
    const message = (error as { response?: { data?: { msg?: string } } })
      .response?.data?.msg;
    throw new Error(
      message || (error instanceof Error ? error.message : '操作失败'),
    );
  }
}

export const getNonorderResult = (date: string) =>
  call<NonorderResult>('daily-result', { date });
export const getNonorderDetail = (id: number) =>
  call<NonorderDetail>('detail', { id });
export const getNonorderPublishOptions = () =>
  call<{ responsibles: NonorderStaff[]; categories: Record<string, string> }>(
    'publish-options',
  );
export const getNonorderPublishPeople = (responsible_staff_id: string) =>
  call<{
    stations: { id: number; name: string }[];
    default_station_id: number | null;
    scanners: NonorderStaff[];
    reviewers: NonorderStaff[];
  }>('publish-options', { responsible_staff_id });
export const getNonorderPending = () =>
  call<
    (NonorderRecord & {
      task_id: number;
      task_content: string;
      staff_name?: string;
    })[]
  >('tasks', { tab: 'pending' });
export const getTransferTasks = () =>
  call<TransferTask[]>('tasks', { tab: 'transfer' });
export const getNonorderPeople = (task_id: number, purpose?: string) =>
  call<NonorderStaff[]>('people', { task_id, purpose });
export const nonorderCommand = (
  task: Pick<NonorderTask, 'id' | 'revision'>,
  data: object,
) =>
  call('command', undefined, {
    task_id: task.id,
    revision: task.revision,
    request_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ...data,
  });

export async function downloadNonorderAttachment(file: {
  key: string;
  name: string;
}) {
  const blob = await request<Blob>('/api/nonorder/attachment', {
    params: { key: file.key },
    responseType: 'blob',
  });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
