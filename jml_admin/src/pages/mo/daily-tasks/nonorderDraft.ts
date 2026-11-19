import type { NonorderPerson, NonorderPlan } from './nonorderService';
import type { DailyData } from './service';

export type NonorderEdit = {
  person: NonorderPerson;
  plan?: NonorderPlan;
  action: 'add' | 'update' | 'cancel' | 'reschedule' | 'append';
  target_date?: string;
  remark: string;
  sort_order: number;
  publish?: boolean;
  work_edit?: {
    request_id: string;
    content?: string;
    staff_id: string;
    staff_name: string;
    responsibility: string;
  };
};

export function planEdit(plan: NonorderPlan): NonorderEdit {
  return {
    person: plan,
    plan,
    action: 'update',
    remark: plan.remark,
    sort_order: plan.sort_order,
  };
}

export function editPayload(edit: NonorderEdit) {
  return {
    action: edit.action,
    id: edit.plan?.id,
    revision: edit.plan?.revision,
    assignment_id: edit.person.assignment.id,
    assignment_revision: edit.person.assignment.revision,
    task_revision: edit.person.task.revision,
    remark: edit.remark,
    sort_order: edit.sort_order,
    target_date: edit.target_date,
    publish: !!edit.publish,
    ...(edit.work_edit && {
      work_edit: {
        request_id: edit.work_edit.request_id,
        content: edit.work_edit.content,
        staff_id: edit.work_edit.staff_id,
        responsibility: edit.work_edit.responsibility,
      },
    }),
  };
}

export function nonorderConflict(data: DailyData, edits: NonorderEdit[] = []) {
  const { nonorder } = data;
  return edits.some((edit) => {
    const assignmentId = edit.person.assignment.id;
    const row = edit.plan
      ? nonorder?.items.find(
          (item) => item.id === edit.plan?.id && !item.cancelled_at,
        )
      : nonorder?.candidates.find(
          (person) => person.assignment.id === assignmentId && !person.occupied,
        );
    return (
      !row?.can_plan ||
      (!!edit.work_edit && !row.can_edit_work) ||
      row.task.revision !== edit.person.task.revision ||
      row.assignment.revision !== edit.person.assignment.revision ||
      (!!edit.plan && (row as NonorderPlan).revision !== edit.plan.revision)
    );
  });
}

export const editLabels: Record<string, string> = {
  add: '新增',
  update: '修改',
  cancel: '取消',
  reschedule: '改期',
  append: '追加日期',
  publish: '发布',
};

export function editsToSave(
  data: DailyData,
  edits: NonorderEdit[] = [],
  publish: boolean,
) {
  if (!publish) return edits;
  const touched = new Set(edits.map((edit) => edit.person.assignment.id));
  return [
    ...edits.map((edit) => ({
      ...edit,
      publish: edit.action !== 'cancel' && (edit.plan?.can_publish ?? true),
    })),
    ...(data.nonorder?.items || [])
      .filter(
        (plan) =>
          plan.can_plan &&
          plan.can_publish &&
          plan.status === 'draft' &&
          !touched.has(plan.assignment.id),
      )
      .map((plan) => ({ ...planEdit(plan), publish: true })),
  ];
}
