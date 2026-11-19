-- MySQL 8.0+，在现场报工库执行。
-- 全部历史至本次查询时点；不限制ERP审核、关闭状态。
-- 正常/追加接收完工合并在正常批次中，返工单独列出，不能相加作为新增产品产量。
-- 只有查询及当前连接的参数设置，不创建表、不修改业务数据。
-- DATETIME按原系统北京时间记录；会话时区仅用于NOW()等当前时间函数。
USE wecom_db;
SET time_zone = '+08:00';
SET SESSION group_concat_max_len = 65535;
SET @report_as_of = NOW();

WITH
jobs AS (
    SELECT 'normal' AS kind, e.id AS job_id, e.id AS execution_id,
           e.mo_code, e.sort_seq, e.route_id, e.seq,
           e.process_name, e.station_name, e.status,
           e.start_time, e.end_time,
           e.qty_done, e.qty_a, e.qty_a1, e.qty_a2, e.qty_c
    FROM mo_execution_yx e
    WHERE e.create_time <= @report_as_of

    UNION ALL

    SELECT 'rework', r.id, r.source_execution_id,
           r.mo_code, r.sort_seq, r.route_id, r.seq,
           COALESCE(r.process_name, e.process_name), e.station_name, r.status,
           r.start_time, r.end_time,
           COALESCE(r.qty_a,0) + COALESCE(r.qty_a1,0)
               + COALESCE(r.qty_a2,0) + COALESCE(r.qty_c,0),
           r.qty_a, r.qty_a1, r.qty_a2, r.qty_c
    FROM mo_rework_yx r
    LEFT JOIN mo_execution_yx e ON e.id = r.source_execution_id
    WHERE r.create_time <= @report_as_of
),
batches AS (
    SELECT 'normal' AS kind, c.execution_id AS job_id,
           c.id AS batch_id, CONCAT('completion:', c.id) AS event_key,
           c.complete_time, c.qty_done, c.qty_a, c.qty_a1, c.qty_a2, c.qty_c
    FROM mo_execution_completion_yx c
    WHERE c.complete_time <= @report_as_of

    UNION ALL

    SELECT 'rework', c.rework_id,
           c.id, CONCAT('rework_completion:', c.id),
           c.complete_time, c.qty_done, c.qty_a, c.qty_a1, c.qty_a2, c.qty_c
    FROM mo_rework_completion_yx c
    WHERE c.complete_time <= @report_as_of
),
-- 正常作业关联开工人员、追加接收人员；按人员ID去重。
-- 这是作业级关联名单，仅在缺少本批日志人员快照时作为参考。
worker_rows AS (
    SELECT 'normal' AS kind, execution_id AS job_id,
           ding_user_id, user_name_snapshot AS worker_name
    FROM mo_execution_worker_yx

    UNION ALL

    SELECT 'normal', rw.execution_id, w.ding_user_id, w.user_name_snapshot
    FROM mo_receive_work_yx rw
    JOIN mo_receive_worker_yx w ON w.receive_id = rw.id
    WHERE rw.start_time <= @report_as_of

    UNION ALL

    SELECT 'rework', rework_id, ding_user_id, user_name_snapshot
    FROM mo_rework_worker_yx
),
workers AS (
    SELECT kind, job_id, COUNT(DISTINCT ding_user_id) AS worker_count,
           GROUP_CONCAT(DISTINCT worker_name ORDER BY worker_name SEPARATOR '、') AS worker_names
    FROM worker_rows
    GROUP BY kind, job_id
),
rows_with_previous AS (
    SELECT j.*,
           b.batch_id, b.event_key, b.complete_time,
           b.qty_done AS batch_qty,
           b.qty_a AS batch_a, b.qty_a1 AS batch_a1,
           b.qty_a2 AS batch_a2, b.qty_c AS batch_c,
           ROW_NUMBER() OVER (
               PARTITION BY j.kind, j.job_id
               ORDER BY b.complete_time, b.batch_id
           ) AS batch_no,
           LAG(b.complete_time) OVER (
               PARTITION BY j.kind, j.job_id
               ORDER BY b.complete_time, b.batch_id
           ) AS previous_complete_time,
           SUM(b.qty_done) OVER (
               PARTITION BY j.kind, j.job_id
           ) AS detail_total
    FROM jobs j
    LEFT JOIN batches b ON b.kind = j.kind AND b.job_id = j.job_id
),
timed AS (
    SELECT x.*,
           COALESCE(x.complete_time, x.end_time) AS reported_time,
           COALESCE(x.complete_time, x.end_time, @report_as_of) AS observe_until,
           CASE
               WHEN x.batch_id IS NOT NULL
               THEN COALESCE(x.previous_complete_time, x.start_time)
           END AS interval_start,
           CASE
               WHEN x.start_time IS NOT NULL
                AND COALESCE(x.complete_time, x.end_time, @report_as_of) >= x.start_time
               THEN TIMESTAMPDIFF(SECOND, x.start_time,
                        COALESCE(x.complete_time, x.end_time, @report_as_of))
           END AS elapsed_seconds,
           CASE
               WHEN x.batch_id IS NOT NULL
                AND COALESCE(x.previous_complete_time, x.start_time) IS NOT NULL
                AND x.complete_time >= COALESCE(x.previous_complete_time, x.start_time)
               THEN TIMESTAMPDIFF(SECOND,
                        COALESCE(x.previous_complete_time, x.start_time), x.complete_time)
           END AS interval_seconds
    FROM rows_with_previous x
)
SELECT
    t.mo_code AS `工单号`,
    t.sort_seq AS `行号`,
    ctx.customer_name AS `客户`,
    ctx.inv_code AS `产品料号`,
    ctx.inv_name AS `产品名称`,
    ctx.inv_std AS `规格`,
    t.seq AS `工序序号`,
    t.process_name AS `工序`,
    t.station_name AS `工站`,
    CASE t.kind WHEN 'normal' THEN '正常' ELSE '返工' END AS `作业类型`,
    t.job_id AS `作业ID`,
    CASE WHEN t.batch_id IS NOT NULL THEN t.batch_no END AS `完工批次`,
    t.batch_id AS `完工记录ID`,
    CASE
        WHEN t.batch_id IS NOT NULL THEN '真实分批完工'
        WHEN COALESCE(t.qty_done,0) > 0 THEN '仅历史累计，无批次明细'
        ELSE '尚无完工数量'
    END AS `数量来源`,
    ctx.plan_qty AS `工单行计划数量`,
    COALESCE(t.batch_qty, t.qty_done, 0) AS `本批数量或历史累计`,
    COALESCE(t.batch_a, t.qty_a, 0) AS `A数量`,
    COALESCE(t.batch_a1, t.qty_a1, 0) AS `A1数量`,
    COALESCE(t.batch_a2, t.qty_a2, 0) AS `A2数量`,
    COALESCE(t.batch_c, t.qty_c, 0) AS `C数量`,
    CASE WHEN t.batch_id IS NOT NULL
         THEN t.qty_done - t.detail_total END AS `主表与批次合计差额`,
    CASE
        WHEN NULLIF(log.worker_names,'') IS NOT NULL THEN log.worker_names
        ELSE COALESCE(NULLIF(w.worker_names,''), '未记录')
    END AS `参与人员`,
    CASE
        WHEN NULLIF(log.worker_names,'') IS NOT NULL
        THEN CASE WHEN JSON_TYPE(log.worker_details) = 'ARRAY'
                       AND JSON_LENGTH(log.worker_details) > 0
                  THEN JSON_LENGTH(log.worker_details) END
        ELSE w.worker_count
    END AS `参与人数`,
    CASE
        WHEN NULLIF(log.worker_names,'') IS NOT NULL THEN '本批操作日志快照'
        WHEN w.worker_count IS NOT NULL THEN '作业关联名单，非逐批配员'
        ELSE '未记录'
    END AS `人员来源`,
    t.status AS `作业当前状态`,
    t.start_time AS `作业开工时间`,
    t.reported_time AS `本批完工或历史末次报工时间`,
    t.interval_start AS `本批间隔起点`,
    ROUND(t.interval_seconds / 60.0, 2) AS `本批报工间隔分钟`,
    t.observe_until AS `累计用时观察截止`,
    ROUND(t.elapsed_seconds / 60.0, 2) AS `开工至观察截止分钟`,
    CASE WHEN t.elapsed_seconds IS NOT NULL THEN CONCAT(
        FLOOR(t.elapsed_seconds / 86400), '天',
        FLOOR(MOD(t.elapsed_seconds,86400) / 3600), '小时',
        FLOOR(MOD(t.elapsed_seconds,3600) / 60), '分钟'
    ) END AS `开工至观察截止用时`
FROM timed t
LEFT JOIN workers w ON w.kind = t.kind AND w.job_id = t.job_id
LEFT JOIN mo_operation_log_yx log ON log.event_key = t.event_key
LEFT JOIN mo_workorder_context_yx ctx
       ON ctx.mo_code = t.mo_code AND ctx.sort_seq = t.sort_seq
ORDER BY t.process_name, t.station_name, t.mo_code, t.sort_seq,
         t.seq, t.kind, t.job_id, t.batch_no;

-- 读数说明：
-- 1. 第一批间隔 = 第一批完工时间 - 作业开工时间。
--    后续批间隔 = 本批完工时间 - 上一批完工时间。
--    这是提交间隔，不是这批材料独占的加工工时，可能存在并行作业。
-- 2. 累计用时 = 本批完工时间 - 作业开工时间。
--    历史无批次时用末次报工时间；尚无结束时间时观察到本次查询时点。
--    不累计相加各批的“开工至观察截止”字段，否则重复计算。
-- 3. 时间包含跨夜、休息、停机、等待、补报；系统没有足够记录还原净加工工时。
-- 4. 参与人员优先采用本批操作日志快照，否则用作业关联名单参考；
--    未把操作人当成作业人员，未将总时间机械乘人数作为真实人工工时。
-- 5. 计划数量为工单行缓存资料，每批重复展示，不要跨行直接求和。
-- 6. 有批次记录时只展示真实批次；主表与批次合计差额不为0表示需核对，
--    不把缺失差额虚构成一笔带有开始/结束时间的完工。
-- 7. 旧记录没有缓存的客户/产品会为空，未据此排除；未过滤已关闭工单。
