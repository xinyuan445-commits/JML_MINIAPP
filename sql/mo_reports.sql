-- ============================================================
-- MO 工序流转系统 — 报表查询集
-- 数据库: DB2 (wecom-db)
-- 说明: 查询前可按需修改下方日期变量
-- ============================================================

-- 日期范围（按需修改，默认最近30天）
SET @start_date = DATE_SUB(CURDATE(), INTERVAL 30 DAY);
SET @end_date   = CURDATE();


-- ============================================================
-- 报表1: 工单进度报表
-- 每张工单当前走到哪道工序、已完成几步、当前完工数量
-- ============================================================
SELECT
    ws.mo_code                              AS '工单号',
    ws.sort_seq                             AS '行号',
    r.route_name                            AS '工艺路线',
    CASE ws.status
        WHEN 'pending'    THEN '待开工'
        WHEN 'processing' THEN '进行中'
        WHEN 'done'       THEN '已完成'
        ELSE ws.status
    END                                     AS '工单状态',
    CONCAT(ws.current_seq, ' / ', ts.total) AS '当前步骤/总步数',
    p.process_name                          AS '当前工序',
    COALESCE(ce.operator_name, '')          AS '当前操作人',
    COALESCE(ce.qty_done, 0)               AS '当前工序完工数量',
    COALESCE(ds.done_count, 0)             AS '已完成步骤数',
    ws.update_time                          AS '最后更新时间'
FROM mo_wo_state_yx ws
JOIN mo_route_yx r
    ON r.id = ws.route_id
JOIN mo_route_step_yx rs
    ON rs.route_id = ws.route_id AND rs.seq = ws.current_seq
JOIN mo_process_yx p
    ON p.id = rs.process_id
-- 总步骤数
JOIN (
    SELECT route_id, COUNT(*) AS total
    FROM mo_route_step_yx
    GROUP BY route_id
) ts ON ts.route_id = ws.route_id
-- 已完成步骤数
LEFT JOIN (
    SELECT mo_code, sort_seq, route_id, COUNT(*) AS done_count
    FROM mo_execution_yx
    WHERE status = 'done'
    GROUP BY mo_code, sort_seq, route_id
) ds ON ds.mo_code  = ws.mo_code
     AND ds.sort_seq = ws.sort_seq
     AND ds.route_id = ws.route_id
-- 当前步骤执行记录
LEFT JOIN mo_execution_yx ce
    ON  ce.mo_code  = ws.mo_code
    AND ce.sort_seq = ws.sort_seq
    AND ce.route_id = ws.route_id
    AND ce.seq      = ws.current_seq
ORDER BY ws.update_time DESC;


-- ============================================================
-- 报表2: 工序产能报表
-- 按日期 × 工序汇总完工数量（基于 end_time 落在日期范围内）
-- ============================================================
SELECT
    DATE(e.end_time)    AS '完工日期',
    e.process_name      AS '工序',
    COUNT(DISTINCT CONCAT(e.mo_code, '-', e.sort_seq))
                        AS '涉及工单数',
    COUNT(*)            AS '执行记录数',
    SUM(e.qty_done)     AS '合计完工数量',
    AVG(e.qty_done)     AS '平均每次完工数量',
    -- 有效工时：分钟
    ROUND(AVG(TIMESTAMPDIFF(MINUTE, e.start_time, e.end_time)), 0)
                        AS '平均耗时(分钟)'
FROM mo_execution_yx e
WHERE e.status   = 'done'
  AND e.end_time IS NOT NULL
  AND DATE(e.end_time) BETWEEN @start_date AND @end_date
GROUP BY DATE(e.end_time), e.process_name
ORDER BY 完工日期 DESC, 合计完工数量 DESC;


-- ============================================================
-- 报表2b: 工序产能周汇总（同期对比用）
-- ============================================================
SELECT
    YEARWEEK(e.end_time, 1)  AS '年周',
    MIN(DATE(e.end_time))    AS '周开始日',
    e.process_name           AS '工序',
    SUM(e.qty_done)          AS '周合计完工数量',
    COUNT(DISTINCT DATE(e.end_time))
                             AS '有效工作天数'
FROM mo_execution_yx e
WHERE e.status   = 'done'
  AND e.end_time IS NOT NULL
  AND DATE(e.end_time) BETWEEN @start_date AND @end_date
GROUP BY YEARWEEK(e.end_time, 1), e.process_name
ORDER BY YEARWEEK(e.end_time, 1) DESC, 周合计完工数量 DESC;


-- ============================================================
-- 报表3: 在制品报表
-- 当前未完成的工单，含当前工序和进度
-- ============================================================
SELECT
    ws.mo_code                              AS '工单号',
    ws.sort_seq                             AS '行号',
    r.route_name                            AS '工艺路线',
    CONCAT(ws.current_seq, ' / ', ts.total) AS '当前步骤/总步数',
    p.process_name                          AS '当前工序',
    CASE ws.status
        WHEN 'pending'    THEN '待开工'
        WHEN 'processing' THEN '进行中'
        ELSE ws.status
    END                                     AS '状态',
    COALESCE(ce.operator_name, '—')         AS '开工人',
    COALESCE(ce.qty_done, 0)               AS '已完工数量',
    ce.start_time                           AS '开工时间',
    -- 在制时长（小时）
    CASE WHEN ce.start_time IS NOT NULL
         THEN ROUND(TIMESTAMPDIFF(MINUTE, ce.start_time, NOW()) / 60.0, 1)
         ELSE NULL
    END                                     AS '在制时长(小时)',
    -- 等待接收的交接记录
    (
        SELECT COUNT(*) FROM mo_handover_yx h
        WHERE h.mo_code  = ws.mo_code
          AND h.sort_seq = ws.sort_seq
          AND h.status   = 'pending'
    )                                       AS '待接收交接数'
FROM mo_wo_state_yx ws
JOIN mo_route_yx r
    ON r.id = ws.route_id
JOIN mo_route_step_yx rs
    ON rs.route_id = ws.route_id AND rs.seq = ws.current_seq
JOIN mo_process_yx p
    ON p.id = rs.process_id
JOIN (
    SELECT route_id, COUNT(*) AS total
    FROM mo_route_step_yx
    GROUP BY route_id
) ts ON ts.route_id = ws.route_id
LEFT JOIN mo_execution_yx ce
    ON  ce.mo_code  = ws.mo_code
    AND ce.sort_seq = ws.sort_seq
    AND ce.route_id = ws.route_id
    AND ce.seq      = ws.current_seq
WHERE ws.status != 'done'
ORDER BY ce.start_time ASC;


-- ============================================================
-- 报表4: 接收差异报表
-- 交接确认后 qty_in < qty_out 的记录及原因
-- ============================================================
SELECT
    h.mo_code                                        AS '工单号',
    h.sort_seq                                       AS '行号',
    fp.process_name                                  AS '交出工序',
    tp.process_name                                  AS '接收工序',
    h.qty_out                                        AS '交出数量',
    h.qty_in                                         AS '接收数量',
    h.qty_out - h.qty_in                             AS '差异数量',
    CONCAT(
        ROUND((h.qty_out - h.qty_in) / h.qty_out * 100, 1),
        '%'
    )                                                AS '差异率',
    h.operator_out                                   AS '交出人',
    h.operator_in                                    AS '接收人',
    COALESCE(h.receipt_reason, '—')                  AS '接收原因',
    h.confirm_time                                   AS '确认时间'
FROM mo_handover_yx h
JOIN mo_route_step_yx frs
    ON frs.route_id = h.route_id AND frs.seq = h.from_seq
JOIN mo_process_yx fp ON fp.id = frs.process_id
JOIN mo_route_step_yx trs
    ON trs.route_id = h.route_id AND trs.seq = h.to_seq
JOIN mo_process_yx tp ON tp.id = trs.process_id
WHERE h.status  = 'confirmed'
  AND h.qty_in  < h.qty_out
  AND DATE(h.confirm_time) BETWEEN @start_date AND @end_date
ORDER BY h.confirm_time DESC;


-- ============================================================
-- 报表4b: 交接汇总（不限差异，全部交接记录统计）
-- ============================================================
SELECT
    fp.process_name                          AS '交出工序',
    tp.process_name                          AS '接收工序',
    COUNT(*)                                 AS '交接次数',
    SUM(h.qty_out)                           AS '合计交出数量',
    SUM(h.qty_in)                            AS '合计接收数量',
    SUM(h.qty_out - h.qty_in)               AS '合计差异数量',
    COUNT(CASE WHEN h.qty_in < h.qty_out THEN 1 END)
                                             AS '有差异次数',
    CONCAT(
        ROUND(
            COUNT(CASE WHEN h.qty_in < h.qty_out THEN 1 END) * 100.0 / COUNT(*),
            1
        ), '%'
    )                                        AS '差异率'
FROM mo_handover_yx h
JOIN mo_route_step_yx frs
    ON frs.route_id = h.route_id AND frs.seq = h.from_seq
JOIN mo_process_yx fp ON fp.id = frs.process_id
JOIN mo_route_step_yx trs
    ON trs.route_id = h.route_id AND trs.seq = h.to_seq
JOIN mo_process_yx tp ON tp.id = trs.process_id
WHERE h.status = 'confirmed'
  AND DATE(h.confirm_time) BETWEEN @start_date AND @end_date
GROUP BY fp.process_name, tp.process_name
ORDER BY 有差异次数 DESC;


-- ============================================================
-- 报表5: 完工异常报表
-- 完工时填写了原因（表示 qty_done 低于子件阈值）的记录
-- ============================================================
SELECT
    e.mo_code                               AS '工单号',
    e.sort_seq                              AS '行号',
    e.seq                                   AS '步骤序号',
    e.process_name                          AS '工序',
    e.operator_name                         AS '操作人',
    e.qty_done                              AS '完工数量',
    e.complete_reason                       AS '未达阈值原因',
    e.end_time                              AS '完工时间'
FROM mo_execution_yx e
WHERE e.status           = 'done'
  AND e.complete_reason  IS NOT NULL
  AND e.complete_reason  != ''
  AND DATE(e.end_time)   BETWEEN @start_date AND @end_date
ORDER BY e.end_time DESC;


-- ============================================================
-- 报表5b: 完工异常汇总（按工序统计异常频次）
-- ============================================================
SELECT
    e.process_name                          AS '工序',
    COUNT(*)                                AS '异常完工次数',
    SUM(e.qty_done)                         AS '合计完工数量'
FROM mo_execution_yx e
WHERE e.status           = 'done'
  AND e.complete_reason  IS NOT NULL
  AND e.complete_reason  != ''
  AND DATE(e.end_time)   BETWEEN @start_date AND @end_date
GROUP BY e.process_name
ORDER BY 异常完工次数 DESC;


-- ============================================================
-- 报表6: 工时明细报表
-- 每条执行记录：操作人、工序、开工/完工时间、工时（分钟/小时）、完工数量
-- ============================================================
SELECT
    e.mo_code                                                       AS '工单号',
    e.sort_seq                                                      AS '行号',
    e.seq                                                           AS '步骤',
    e.process_name                                                  AS '工序',
    e.operator_name                                                 AS '操作人',
    e.start_time                                                    AS '开工时间',
    e.end_time                                                      AS '完工时间',
    TIMESTAMPDIFF(MINUTE, e.start_time, e.end_time)                AS '工时(分钟)',
    ROUND(TIMESTAMPDIFF(MINUTE, e.start_time, e.end_time) / 60.0, 2)
                                                                    AS '工时(小时)',
    e.qty_done                                                      AS '完工数量',
    -- 单件工时（分钟/件），qty_done=0 时显示 NULL
    CASE WHEN e.qty_done > 0
         THEN ROUND(TIMESTAMPDIFF(MINUTE, e.start_time, e.end_time) / e.qty_done, 2)
         ELSE NULL
    END                                                             AS '单件工时(分/件)',
    CASE e.status
        WHEN 'done'        THEN '已完工'
        WHEN 'processing'  THEN '进行中'
        WHEN 'interrupted' THEN '已中断'
        ELSE e.status
    END                                                             AS '状态'
FROM mo_execution_yx e
WHERE e.start_time IS NOT NULL
  AND DATE(COALESCE(e.end_time, e.start_time)) BETWEEN @start_date AND @end_date
ORDER BY e.start_time DESC;


-- ============================================================
-- 报表6b: 工时明细（每工单每工序一行）
-- ============================================================
SELECT
    e.mo_code                                                       AS '工单号',
    e.sort_seq                                                      AS '行号',
    e.seq                                                           AS '步骤',
    e.process_name                                                  AS '工序',
    COALESCE(e.operator_name, '—')                                  AS '操作人',
    e.start_time                                                    AS '开工时间',
    e.end_time                                                      AS '完工时间',
    ROUND(TIMESTAMPDIFF(MINUTE, e.start_time, e.end_time) / 60.0, 2)
                                                                    AS '工时(小时)',
    e.qty_done                                                      AS '完工数量'
FROM mo_execution_yx e
WHERE e.start_time IS NOT NULL
  AND DATE(COALESCE(e.end_time, e.start_time)) BETWEEN @start_date AND @end_date
ORDER BY e.mo_code, e.sort_seq, e.seq;
