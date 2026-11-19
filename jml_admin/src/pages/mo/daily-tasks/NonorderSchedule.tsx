import { Button, Checkbox, Tag } from 'antd';
import { createStyles } from 'antd-style';
import { type ComponentPropsWithoutRef, useState } from 'react';
import { editLabels, type NonorderEdit, planEdit } from './nonorderDraft';
import {
  groupKey,
  type NonorderCandidate,
  type NonorderPerson,
  type NonorderPlan,
} from './nonorderService';

export const PERSON_DRAG = 'application/x-jml-nonorder-person';
export const PLAN_DRAG = 'application/x-jml-nonorder-plan';
export const isNonorderDrag = (transfer?: DataTransfer) =>
  [PERSON_DRAG, PLAN_DRAG].some((type) => transfer?.types?.includes(type));

const useStyles = createStyles(({ css, token }) => ({
  group: css`padding: 8px 0; border-top: 1px solid ${token.colorBorderSecondary};
    summary { cursor: pointer; font-weight: 600; }
    details { padding: 8px 0 0 12px; }
  `,
  card: css`display: grid; gap: 5px; padding: 10px; margin: 6px 0; border: 1px solid ${token.colorBorderSecondary};
    border-radius: 8px; background: ${token.colorBgContainer};
    &[draggable="true"] { cursor: grab; }
    small { color: ${token.colorTextSecondary}; }
  `,
  scheduledCard: css`
    background: ${token.colorBgContainer};
    border-inline-start: 3px solid ${token.purple5};
    overflow-wrap: anywhere;
  `,
  typeTag: css`margin-inline-end: 0;`,
  line: css`display: flex; align-items: center; flex-wrap: wrap; gap: 8px;`,
}));

export function NonorderCard({
  workItem,
  children,
  ...props
}: ComponentPropsWithoutRef<'article'> & { workItem: string }) {
  const { styles, cx } = useStyles();
  return (
    <article {...props} className={cx(styles.card, styles.scheduledCard)}>
      <div className={styles.line}>
        <Tag className={styles.typeTag} color="purple">无工单</Tag>
        <strong title={workItem}>{workItem.split('\n', 1)[0]}</strong>
      </div>
      {children}
    </article>
  );
}

export function NonorderPool({
  candidates,
  canEdit,
  onAdd,
  locate,
}: {
  candidates: NonorderCandidate[];
  canEdit: boolean;
  onAdd: (rows: NonorderCandidate[]) => void;
  locate: (id: number) => void;
}) {
  const { styles } = useStyles();
  const [selected, setSelected] = useState<number[]>([]);
  const selectable = candidates.filter(
    (row) => canEdit && row.can_plan && !row.occupied,
  );
  const checked = selectable.filter((row) =>
    selected.includes(row.assignment.id),
  );
  const tasks = new Map<number, Map<number, NonorderCandidate[]>>();
  for (const row of candidates) {
    const divisions =
      tasks.get(row.task.id) || new Map<number, NonorderCandidate[]>();
    const rows = divisions.get(row.division.id) || [];
    rows.push(row);
    divisions.set(row.division.id, rows);
    tasks.set(row.task.id, divisions);
  }
  return (
    <div className={styles.group}>
      {checked.length > 0 && (
        <div
          className={styles.line}
          style={{ marginBottom: 8 }}
        >
            <Button
              size="small"
              onClick={() => {
                onAdd(checked);
                setSelected([]);
              }}
            >
              安排所选（{checked.length}）
            </Button>
        </div>
      )}
      {[...tasks].map(([taskId, divisions]) => {
        const task = [...divisions.values()][0][0].task;
        return (
          <details key={taskId} className={styles.group}>
            <summary>
              {task.content} <small>· {task.responsible_name}</small>
            </summary>
            {[...divisions].map(([divisionId, rows]) => (
              <details
                key={divisionId}
                open={divisions.size === 1 ? true : undefined}
              >
                <summary>{rows[0].division.content}</summary>
                {rows.map((row) => {
                  const id = row.assignment.id;
                  const allowed = selectable.includes(row);
                  return (
                    <div
                      key={row.key}
                      className={styles.card}
                      draggable={allowed}
                      onDragStart={(event) => {
                        if (!allowed) return;
                        const group = selected.includes(id)
                          ? checked.filter(
                              (other) => groupKey(other) === groupKey(row),
                            )
                          : [row];
                        event.dataTransfer.setData(
                          PERSON_DRAG,
                          JSON.stringify(
                            group.map((person) => person.assignment.id),
                          ),
                        );
                        event.dataTransfer.effectAllowed = 'copy';
                      }}
                    >
                      <div className={styles.line}>
                        {allowed ? (
                          <Checkbox
                            checked={selected.includes(id)}
                            onChange={(event) =>
                              setSelected((old) =>
                                event.target.checked
                                  ? [...old, id]
                                  : old.filter((item) => item !== id),
                              )
                            }
                          >
                            {row.assignment.staff_name}
                          </Checkbox>
                        ) : (
                          <strong>{row.assignment.staff_name}</strong>
                        )}
                        {row.occupied && <Tag>当天已安排或暂存</Tag>}
                      </div>
                      <div>{row.assignment.responsibility}</div>
                      <small>
                        {row.group.type === 'station'
                          ? row.group.name
                          : `无工站 · ${row.group.name}`}
                        {row.division.planned_date &&
                          ` · 原计划 ${row.division.planned_date}`}
                      </small>
                      {!!row.arranged_dates.length && (
                        <small>已安排 {row.arranged_dates.join('、')}</small>
                      )}
                      {row.group.type === 'station' && (
                        <Button
                          type="link"
                          size="small"
                          style={{ justifySelf: 'start', padding: 0 }}
                          onClick={() => locate(Number(row.group.id))}
                        >
                          定位工站
                        </Button>
                      )}
                    </div>
                  );
                })}
              </details>
            ))}
          </details>
        );
      })}
      {!tasks.size && <small>暂无待安排人员</small>}
    </div>
  );
}

export function arrangementRows(
  items: NonorderPlan[] = [],
  edits: NonorderEdit[] = [],
  candidates: NonorderCandidate[] = [],
) {
  const changedPlans = new Map(
    edits.filter((edit) => edit.plan).map((edit) => [edit.plan?.id, edit]),
  );
  const candidatesById = new Map(candidates.map((row) => [row.assignment.id, row]));
  const withCurrentAccess = (edit: NonorderEdit, current?: NonorderPerson): NonorderEdit => ({
    ...edit,
    person: {
      ...edit.person,
      can_plan: current?.can_plan ?? edit.person.can_plan,
      can_edit_work: current?.can_edit_work,
      assignment: {
        ...edit.person.assignment,
        status: current?.assignment.status ?? edit.person.assignment.status,
      },
    },
  });
  return [
    ...items.map((item) => {
      const edit = changedPlans.get(item.id);
      return edit ? withCurrentAccess(edit, item) : planEdit(item);
    }),
    ...edits.filter((edit) => !edit.plan).map((edit) =>
      withCurrentAccess(edit, candidatesById.get(edit.person.assignment.id))),
  ].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      a.person.assignment.id - b.person.assignment.id,
  );
}

export function NonorderLane({
  rows,
  group,
  canEdit,
  save,
  move,
  drop,
  undo,
  empty,
  onEdit,
}: {
  rows: NonorderEdit[];
  group: string;
  canEdit: boolean;
  save: (edits: NonorderEdit[]) => void;
  move: (key: string, id: number, before: number) => void;
  drop: (event: React.DragEvent, key: string) => void;
  undo: (id: number) => void;
  empty: boolean;
  onEdit: (row: NonorderEdit) => void;
}) {
  const { styles } = useStyles();
  const active = rows.filter(
    (row) =>
      row.action !== 'cancel' &&
      row.action !== 'reschedule' &&
      row.plan?.status !== 'cancelled',
  );
  const receive = (event: React.DragEvent) => {
    if (!canEdit || !isNonorderDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    drop(event, group);
  };
  return (
    <section
      className={styles.group}
      onDragOver={(event) => {
        if (
          canEdit &&
          isNonorderDrag(event.dataTransfer) &&
          event.dataTransfer.types.includes(PERSON_DRAG)
        )
          event.preventDefault();
      }}
      onDrop={receive}
    >
      {rows.map((row) => {
        const { person, plan } = row;
        const id = person.assignment.id;
        const cancelled =
          row.action === 'cancel' || plan?.status === 'cancelled';
        const dateChange =
          row.action === 'append' || row.action === 'reschedule';
        const allowed = canEdit && person.can_plan && !cancelled && !dateChange;
        const work = row.work_edit;
        const canEditWork = allowed && person.can_edit_work;
        return (
          <NonorderCard
            key={plan?.key || person.key}
            workItem={work?.content ?? person.division.content}
            draggable={allowed}
            onDoubleClick={allowed ? (event) => {
              if (!(event.target as HTMLElement).closest('button')) onEdit(row);
            } : undefined}
            onDragStart={(event) => {
              event.stopPropagation();
              if (allowed) event.dataTransfer.setData(PLAN_DRAG, String(id));
            }}
            onDragOver={(event) => {
              if (allowed && event.dataTransfer.types.includes(PLAN_DRAG))
                event.preventDefault();
            }}
            onDrop={(event) => {
              if (!allowed || !event.dataTransfer.types.includes(PLAN_DRAG))
                return;
              event.preventDefault();
              event.stopPropagation();
              move(group, Number(event.dataTransfer.getData(PLAN_DRAG)), id);
            }}
          >
            <div>
              {work?.staff_name ?? person.assignment.staff_name} ·{' '}
              {work?.responsibility ?? person.assignment.responsibility}
            </div>
            <div className={styles.line}>
              <Tag
                color={
                  cancelled
                    ? 'default'
                    : plan?.status === 'published'
                      ? 'green'
                      : 'blue'
                }
              >
                {row.action === 'cancel'
                  ? '待取消'
                  : cancelled
                    ? '已取消'
                    : plan?.status === 'published'
                      ? '已发布'
                      : plan
                        ? '服务器草稿'
                        : '本地草稿'}
              </Tag>
              {!cancelled && person.assignment.status === 'done' && <Tag>已完成核对</Tag>}
              {work && <Tag color="blue">待保存修改</Tag>}
            </div>
            <small>{person.task.content}</small>
            {dateChange && (
              <Tag color="processing">
                待{editLabels[row.action]} · {row.target_date}
              </Tag>
            )}
            {plan?.station_changed && <Tag color="warning">关联工站已调整</Tag>}
            {person.division.due_at &&
              plan?.work_date &&
              person.division.due_at.slice(0, 10) < plan.work_date && (
                <Tag color="warning">晚于任务截止日</Tag>
              )}
            {allowed && (
              <div className={styles.line}>
                {canEditWork && <Button size="small" onClick={() => onEdit(row)}>修改</Button>}
                {active.indexOf(row) > 0 && (plan?.can_publish ?? true) && (
                  <Button
                    size="small"
                    onClick={() =>
                      move(
                        group,
                        id,
                        active[active.indexOf(row) - 1].person.assignment.id,
                      )
                    }
                  >
                    上移
                  </Button>
                )}
                <Button
                  size="small"
                  onClick={() =>
                    plan ? save([{ ...row, action: 'cancel', work_edit: undefined }]) : undo(id)
                  }
                >
                  {plan ? '取消安排' : '移出草稿'}
                </Button>
              </div>
            )}
            {canEdit && (dateChange || row.action === 'cancel') && (
              <Button
                size="small"
                style={{ justifySelf: 'start' }}
                onClick={() => undo(id)}
              >
                撤销本地{editLabels[row.action]}
              </Button>
            )}
          </NonorderCard>
        );
      })}
      {!rows.length && empty && <small>拖入待安排人员</small>}
    </section>
  );
}

export function laneGroups(rows: NonorderEdit[], candidates: NonorderPerson[]) {
  const groups = new Map<string, NonorderPerson['group']>();
  for (const row of [...candidates, ...rows.map((edit) => edit.person)]) {
    groups.set(groupKey(row), row.group);
  }
  return groups;
}
