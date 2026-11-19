import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type DataGroup,
  type DataItem,
  Timeline,
  type TimelineOptions,
} from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.min.css';
import styles from './index.less';
import {
  getSchedulePreview,
  type ScheduleDirection,
  type SchedulePreview,
  type ScheduleTask,
} from './service';

type TimelineTask = ScheduleTask & {
  chartType: 'actual' | 'planned' | 'late' | 'milestone';
  endDate: Date;
  groupId: string;
  startDate: Date;
};

type TimelineGroupSummary = {
  deviceNames: string[];
  id: string;
  lateCount: number;
  minSeq: number;
  processName: string;
  stationNames: string[];
  taskCount: number;
};

type RangeMode = '7d' | '14d' | 'all';

const labels = {
  actual: '实际已完成',
  planned: '预计排程',
  late: '预计逾期',
  milestone: '无限产能',
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const formatDateTime = (value?: string | null) =>
  value ? dayjs(value).format('MM-DD HH:mm') : '—';

const formatQuantity = (value: number) =>
  new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 4 }).format(value);

const formatDuration = (minutes?: number | null) => {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return `${Math.round(minutes)}分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return remainder ? `${hours}小时${remainder}分钟` : `${hours}小时`;
};

const taskDuration = (task: TimelineTask) =>
  task.duration_minutes ??
  dayjs(task.schedule_end).diff(dayjs(task.schedule_start), 'minute', true);

const capacitySummary = (task: TimelineTask) => {
  if (task.capacity_state === 'unlimited') return '无限产能';
  if (task.standard_quantity && task.effective_hours) {
    return `${formatQuantity(task.standard_quantity)}${task.standard_unit || task.unit_name} / ${formatQuantity(task.effective_hours)}小时`;
  }
  return task.chartType === 'actual' ? '按实际记录' : '未配置';
};

const taskTooltip = (task: TimelineTask) => {
  const lateMinutes = task.is_late && task.due_at
    ? Math.ceil(dayjs(task.schedule_end).diff(dayjs(task.due_at), 'minute', true))
    : 0;
  const timeLabel = task.chartType === 'actual' ? '实际时间' : '工序排程';
  const staffing = task.staffing
    ? `${formatQuantity(task.staffing)}人`
    : '未配置';
  const statusTag = {
    actual: 'ins',
    late: 'mark',
    milestone: 'i',
    planned: 'span',
  }[task.chartType];
  return `
    <article>
      <header>
        <div><strong>${escapeHtml(task.process_name)}</strong><small>${escapeHtml(task.mo_code)} · 第 ${escapeHtml(task.sort_seq)} 行</small></div>
        <${statusTag}>${escapeHtml(labels[task.chartType])}</${statusTag}>
      </header>
      <section>
        <h4>任务</h4>
        <div>
          <div><span>数量</span><strong>${escapeHtml(formatQuantity(task.quantity))}${escapeHtml(task.unit_name)}</strong></div>
          <div><span>工站</span><strong>${escapeHtml(task.station_name || '—')}</strong></div>
          <div><span>设备</span><strong>${escapeHtml(task.device_name || '—')}</strong></div>
          <div><span>标准配员</span><strong>${escapeHtml(staffing)}</strong></div>
        </div>
      </section>
      <section>
        <h4>时间</h4>
        <div>
          <div><span>工单计划</span><strong>${escapeHtml(task.plan_start_date ? dayjs(task.plan_start_date).format('YYYY-MM-DD') : '—')} → ${escapeHtml(task.due_date ? dayjs(task.due_date).format('YYYY-MM-DD') : '—')}</strong></div>
          <div><span>${timeLabel}</span><strong>${escapeHtml(formatDateTime(task.schedule_start))} → ${escapeHtml(formatDateTime(task.schedule_end))}</strong></div>
          ${task.handover_end || task.handover_missing ? `<div><span>上道交割</span><strong>${escapeHtml(task.handover_missing ? '未维护，按0分钟' : formatDuration(task.handover_minutes))}</strong></div>` : ''}
          ${task.handover_end ? `<div><span>交割后等待</span><strong>${escapeHtml(formatDuration(task.waiting_minutes))}</strong></div>` : ''}
          ${task.schedule_direction === 'forward-fallback' ? '<div><span>排程</span><strong>顺排补排</strong></div>' : ''}
        </div>
      </section>
      <section>
        <h4>产能</h4>
        <div>
          <div><span>标准产能</span><strong>${escapeHtml(capacitySummary(task))}</strong></div>
          <div><span>任务用时</span><strong>${escapeHtml(formatDuration(taskDuration(task)))}</strong></div>
        </div>
        <p>${escapeHtml(task.formula || '—')}</p>
      </section>
      ${lateMinutes ? `<section><h4>异常</h4><p>排程结束晚于计划完工 ${escapeHtml(formatDuration(lateMinutes))}</p></section>` : ''}
    </article>`;
};

export default function ScheduleGantt() {
  const [data, setData] = useState<SchedulePreview>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [rangeMode, setRangeMode] = useState<RangeMode>('7d');
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<Timeline | null>(null);

  const load = useCallback(async (calendarId?: number, policyId?: number, direction?: ScheduleDirection) => {
    setLoading(true);
    try {
      const result = await getSchedulePreview({
        calendar_id: calendarId,
        policy_id: policyId,
        direction,
      });
      if (result.code !== 0 || !result.data)
        throw new Error(result.msg || '试排失败');
      setData(result.data);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const timelineTasks = useMemo<TimelineTask[]>(
    () =>
      (data?.tasks || [])
        .filter((item) => item.schedule_start && item.schedule_end)
        .map((item) => {
          const start = dayjs(item.schedule_start);
          const rawEnd = dayjs(item.schedule_end);
          const end = rawEnd.isAfter(start) ? rawEnd : start.add(15, 'minute');
          return {
            ...item,
            chartType: item.is_late ? 'late' : item.type,
            endDate: end.toDate(),
            groupId: `process:${item.process_name || '未标工序'}`,
            startDate: start.toDate(),
          };
        }),
    [data],
  );

  const groupSummaries = useMemo<TimelineGroupSummary[]>(() => {
    const summaries = new Map<string, TimelineGroupSummary>();
    timelineTasks.forEach((task) => {
      const current = summaries.get(task.groupId);
      if (current) {
        current.taskCount += 1;
        if (task.chartType === 'late') current.lateCount += 1;
        current.minSeq = Math.min(current.minSeq, task.seq);
        if (
          task.station_name &&
          !current.stationNames.includes(task.station_name)
        ) {
          current.stationNames.push(task.station_name);
        }
        if (
          task.device_name &&
          !current.deviceNames.includes(task.device_name)
        ) {
          current.deviceNames.push(task.device_name);
        }
        return;
      }
      summaries.set(task.groupId, {
        deviceNames: task.device_name ? [task.device_name] : [],
        id: task.groupId,
        lateCount: task.chartType === 'late' ? 1 : 0,
        minSeq: task.seq,
        processName: task.process_name || '未标工序',
        stationNames: task.station_name ? [task.station_name] : [],
        taskCount: 1,
      });
    });
    return [...summaries.values()].sort(
      (left, right) =>
        left.minSeq - right.minSeq ||
        left.processName.localeCompare(right.processName, 'zh-CN'),
    );
  }, [timelineTasks]);

  useEffect(() => {
    if (!timelineContainerRef.current || timelineTasks.length === 0) {
      timelineRef.current?.destroy();
      timelineRef.current = null;
      return undefined;
    }

    const groups: DataGroup[] = groupSummaries.map((group, index) => ({
      id: group.id,
      order: index,
      content: `
        <div>
          <div><strong>${escapeHtml(group.processName)}</strong><span class="schedule-group-badges"><b>${group.taskCount} 项</b>${group.lateCount ? `<em>逾期 ${group.lateCount}</em>` : ''}</span></div>
          <span title="${escapeHtml([...group.stationNames, ...group.deviceNames].join(' / '))}">${escapeHtml(group.stationNames.join('、') || '未标工站')} · ${escapeHtml(group.deviceNames.join('、') || '未建设备')}</span>
        </div>`,
    }));

    const items: DataItem[] = timelineTasks.map((task) => ({
      id: task.key,
      group: task.groupId,
      start: task.startDate,
      end: task.endDate,
      type: 'range',
      className: `${styles.timelineTask} ${styles[`timelineTask${task.chartType[0].toUpperCase()}${task.chartType.slice(1)}`]}`,
      content: `<strong>${escapeHtml(task.mo_code)}-${escapeHtml(task.sort_seq)}</strong><span>${escapeHtml(formatDuration(taskDuration(task)))}</span>`,
      title: taskTooltip(task),
    }));

    const firstDate = dayjs(
      Math.min(...timelineTasks.map((task) => task.startDate.getTime())),
    );
    const lastDate = dayjs(
      Math.max(...timelineTasks.map((task) => task.endDate.getTime())),
    );
    const today = dayjs();
    const rangeAnchor =
      today.isAfter(firstDate) && today.isBefore(lastDate)
        ? today.startOf('day')
        : firstDate.startOf('day');
    const visibleStart =
      rangeMode === 'all' ? firstDate.subtract(12, 'hour') : rangeAnchor;
    const visibleEnd =
      rangeMode === 'all'
        ? lastDate.add(12, 'hour')
        : rangeAnchor.add(rangeMode === '7d' ? 7 : 14, 'day');
    let weekend = firstDate.startOf('day');
    let weekendIndex = 0;
    while (weekend.isBefore(lastDate.add(1, 'day'))) {
      if (weekend.day() === 0 || weekend.day() === 6) {
        items.push({
          id: `weekend-${weekendIndex}`,
          content: '',
          start: weekend.toDate(),
          end: weekend.add(1, 'day').toDate(),
          type: 'background',
          className: styles.timelineWeekend,
        });
        weekendIndex += 1;
      }
      weekend = weekend.add(1, 'day');
    }

    const options: TimelineOptions = {
      align: 'left',
      clickToUse: false,
      cluster: {
        fitOnDoubleClick: true,
        maxItems: 2,
        showStipes: true,
        titleTemplate: '{count} 个重叠任务，双击展开',
      },
      editable: false,
      end: visibleEnd.toDate(),
      format: {
        minorLabels: { hour: 'HH:mm', day: 'D日', week: 'D日' },
        majorLabels: { hour: 'M月D日', day: 'YYYY年M月', week: 'YYYY年M月' },
      },
      groupOrder: 'order',
      height: '100%',
      horizontalScroll: true,
      margin: { axis: 8, item: { horizontal: 2, vertical: 8 } },
      multiselect: false,
      orientation: { axis: 'top', item: 'top' },
      selectable: true,
      showCurrentTime: true,
      stack: true,
      start: visibleStart.toDate(),
      tooltip: { delay: 120, followMouse: true, overflowMethod: 'cap' },
      verticalScroll: true,
      zoomKey: 'ctrlKey',
      zoomMax: 1000 * 60 * 60 * 24 * 90,
      zoomMin: 1000 * 60 * 60 * 8,
    };

    const container = timelineContainerRef.current;
    timelineRef.current?.destroy();
    const timeline = new Timeline(container, items, groups, options);
    timelineRef.current = timeline;

    const taskById = new Map(timelineTasks.map((task) => [task.key, task]));
    const groupIndex = new Map(
      groupSummaries.map((group, index) => [group.id, index]),
    );
    const planOverlay = document.createElement('div');
    planOverlay.className = styles.timelinePlanHoverRange;
    planOverlay.setAttribute('aria-hidden', 'true');
    container.querySelector('.vis-timeline')?.append(planOverlay);
    let hoveredTask: TimelineTask | undefined;
    const hidePlanWindow = () => {
      hoveredTask = undefined;
      planOverlay.style.display = 'none';
    };
    const renderPlanWindow = (task: TimelineTask) => {
      if (!task.plan_start_date || !task.due_date) {
        hidePlanWindow();
        return;
      }
      const planStart = dayjs(task.plan_start_date).startOf('day');
      const planEnd = dayjs(task.due_date).endOf('day');
      const index = groupIndex.get(task.groupId);
      const root = container.querySelector<HTMLElement>('.vis-timeline');
      const center = container.querySelector<HTMLElement>(
        '.vis-panel.vis-center',
      );
      const groupElements = container.querySelectorAll<HTMLElement>(
        '.vis-foreground .vis-group',
      );
      const groupElement =
        index === undefined ? undefined : groupElements[index];
      if (
        !planStart.isValid() ||
        !planEnd.isValid() ||
        !root ||
        !center ||
        !groupElement
      ) {
        hidePlanWindow();
        return;
      }
      const windowRange = timeline.getWindow();
      const windowDuration =
        windowRange.end.getTime() - windowRange.start.getTime();
      if (windowDuration <= 0) {
        hidePlanWindow();
        return;
      }
      const rootRect = root.getBoundingClientRect();
      const centerRect = center.getBoundingClientRect();
      const groupRect = groupElement.getBoundingClientRect();
      const timeToLeft = (value: dayjs.Dayjs) =>
        centerRect.left -
        rootRect.left +
        ((value.valueOf() - windowRange.start.getTime()) / windowDuration) *
          centerRect.width;
      const centerLeft = centerRect.left - rootRect.left;
      const centerRight = centerRect.right - rootRect.left;
      const left = Math.max(centerLeft, timeToLeft(planStart));
      const right = Math.min(centerRight, timeToLeft(planEnd));
      if (right <= left) {
        planOverlay.style.display = 'none';
        return;
      }
      planOverlay.style.display = 'block';
      planOverlay.style.left = `${left}px`;
      planOverlay.style.top = `${groupRect.top - rootRect.top}px`;
      planOverlay.style.width = `${right - left}px`;
      planOverlay.style.height = `${groupRect.height}px`;
    };
    const showPlanWindow = (properties?: { item?: string | number }) => {
      const task = taskById.get(String(properties?.item || ''));
      if (!task) {
        hidePlanWindow();
        return;
      }
      hoveredTask = task;
      renderPlanWindow(task);
    };
    const refreshPlanWindow = () => {
      if (hoveredTask) renderPlanWindow(hoveredTask);
    };
    timeline.on('itemover', showPlanWindow);
    timeline.on('itemout', hidePlanWindow);
    timeline.on('rangechange', refreshPlanWindow);

    let disposed = false;
    let redrawFrame = 0;
    const revealTimeline = () => {
      if (!disposed && container.clientWidth && container.clientHeight) {
        const timelineElement =
          container.querySelector<HTMLElement>('.vis-timeline');
        if (timelineElement) timelineElement.style.visibility = 'visible';
      }
    };
    const queueRedraw = () => {
      if (disposed) return;
      window.cancelAnimationFrame(redrawFrame);
      redrawFrame = window.requestAnimationFrame(() => {
        if (
          timelineContainerRef.current?.clientWidth &&
          timelineContainerRef.current.clientHeight
        ) {
          timeline.redraw();
          window.dispatchEvent(new Event('resize'));
          revealTimeline();
        }
      });
    };
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(queueRedraw);
    resizeObserver?.observe(timelineContainerRef.current);
    timeline.on('changed', revealTimeline);
    queueRedraw();
    const settleTimer = window.setTimeout(queueRedraw, 120);
    void document.fonts?.ready.then(queueRedraw);

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      timeline.off('changed', revealTimeline);
      timeline.off('itemover', showPlanWindow);
      timeline.off('itemout', hidePlanWindow);
      timeline.off('rangechange', refreshPlanWindow);
      window.cancelAnimationFrame(redrawFrame);
      window.clearTimeout(settleTimer);
      planOverlay.remove();
      timeline.destroy();
      if (timelineRef.current === timeline) timelineRef.current = null;
    };
  }, [groupSummaries, rangeMode, timelineTasks]);
  const moveToToday = () =>
    timelineRef.current?.moveTo(new Date(), {
      animation: { duration: 300, easingFunction: 'easeInOutQuad' },
    });

  return (
    <section className={styles.schedulePanel} aria-label="工序进度试排">
      <div className={styles.scheduleToolbar}>
        <div>
          <label>
            生产日历
            <select
              value={data?.calendar.id || ''}
              disabled={loading || !data}
              onChange={(event) =>
                void load(Number(event.target.value), data?.policy.id, data?.direction)
              }
            >
              {(data?.calendars || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            排程策略
            <select
              value={data?.policy.id || ''}
              disabled={loading || !data}
              onChange={(event) =>
                void load(data?.calendar.id, Number(event.target.value), data?.direction)
              }
            >
              {(data?.policies || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            排程方向
            <select
              value={data?.direction || 'forward'}
              disabled={loading || !data}
              onChange={(event) => void load(data?.calendar.id, data?.policy.id, event.target.value as ScheduleDirection)}
            >
              <option value="forward">顺排</option>
              <option value="backward">逆排</option>
            </select>
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load(data?.calendar.id, data?.policy.id, data?.direction)}
          >
            {loading ? '正在试排…' : '重新试排'}
          </button>
        </div>
        <div className={styles.scheduleSummary}>
          <span>
            已排 <strong>{data?.summary.planned || 0}</strong>
          </span>
          <span>
            逾期 <strong>{data?.summary.late || 0}</strong>
          </span>
          <span>
            待补资料 <strong>{data?.summary.unscheduled || 0}</strong>
          </span>
        </div>
      </div>
      <div className={styles.scheduleSubbar}>
        <div className={styles.scheduleLegend}>
          {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => (
            <span
              key={key}
              className={`${styles.legendChip} ${styles[`legendChip${key[0].toUpperCase()}${key.slice(1)}`]}`}
            >
              <i
                className={
                  styles[`legend${key[0].toUpperCase()}${key.slice(1)}`]
                }
              />
              {labels[key]}
            </span>
          ))}
        </div>
        <div className={styles.timelineActions}>
          <fieldset className={styles.rangeSwitch} aria-label="显示范围">
            {(
              [
                ['7d', '7天'],
                ['14d', '14天'],
                ['all', '全部'],
              ] as [RangeMode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={rangeMode === value}
                onClick={() => setRangeMode(value)}
              >
                {label}
              </button>
            ))}
          </fieldset>
          <button type="button" onClick={moveToToday}>
            今天
          </button>
          <button
            type="button"
            onClick={() => timelineRef.current?.zoomIn(0.35)}
          >
            放大
          </button>
          <button
            type="button"
            onClick={() => timelineRef.current?.zoomOut(0.35)}
          >
            缩小
          </button>
        </div>
      </div>
      <div className={styles.scheduleNotice}>
        {failed
          ? '试排失败，请检查生产日历和产能资料'
          : `按“${data?.policy.name || '—'}”试排，不保存结果`}
      </div>
      {timelineTasks.length > 0 ? (
        <div className={styles.scheduleTimeline} ref={timelineContainerRef} />
      ) : (
        <div className={styles.empty}>
          {loading ? '正在计算工序排程…' : '暂无可显示的排程任务'}
        </div>
      )}
      {Boolean(data?.unscheduled.length) && (
        <div className={styles.unscheduledBar}>
          <strong>待补资料</strong>
          {data?.unscheduled.slice(0, 8).map((item) => (
            <span key={item.key}>
              {item.mo_code}-{item.sort_seq} {item.process_name}：{item.reason}
            </span>
          ))}
          {(data?.unscheduled.length || 0) > 8 && (
            <span>另有 {(data?.unscheduled.length || 0) - 8} 项</span>
          )}
        </div>
      )}
    </section>
  );
}
