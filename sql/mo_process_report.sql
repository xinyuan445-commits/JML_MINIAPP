-- 所有发生过报工的生产工单：列出完整工艺路线及流转标签打印状态。
-- 工序用时公式：结束工序取 end_time - start_time；未结束工序取当前时间 - start_time，并转换为天、小时、分钟。
-- 客户及产品资料取自 mo_workorder_context_yx 同步结果。
SELECT
    ro.mo_code AS `生产订单号`,
    ro.sort_seq AS `生产订单行号`,
    ctx.customer_name AS `客户名称`,
    ctx.inv_code AS `产品编码`,
    ctx.inv_name AS `产品名称`,
    ctx.inv_std AS `规格型号`,
    route.route_name AS `工艺路线`,
    step.seq AS `工序序号`,
    process.process_name AS `工序名称`,
    execution.station_name AS `工站`,
    CASE
        WHEN execution.id IS NULL THEN '未开始'
        WHEN execution.status = 'done' THEN '已完成'
        WHEN execution.status = 'processing' THEN '进行中'
        ELSE execution.status
    END AS `工序状态`,
    workers.worker_names AS `开工人员`,
    execution.start_time AS `开工时间`,
    execution.end_time AS `完工时间`,
    CASE
        WHEN execution.start_time IS NULL THEN NULL
        ELSE CONCAT(
            CASE
                WHEN TIMESTAMPDIFF(
                    SECOND, execution.start_time, COALESCE(execution.end_time, NOW())
                ) >= 86400
                THEN CONCAT(
                    FLOOR(
                        TIMESTAMPDIFF(
                            SECOND, execution.start_time, COALESCE(execution.end_time, NOW())
                        ) / 86400
                    ),
                    '天'
                )
                ELSE ''
            END,
            CASE
                WHEN MOD(
                    TIMESTAMPDIFF(
                        SECOND, execution.start_time, COALESCE(execution.end_time, NOW())
                    ),
                    86400
                ) >= 3600
                THEN CONCAT(
                    FLOOR(
                        MOD(
                            TIMESTAMPDIFF(
                                SECOND, execution.start_time, COALESCE(execution.end_time, NOW())
                            ),
                            86400
                        ) / 3600
                    ),
                    '小时'
                )
                ELSE ''
            END,
            FLOOR(
                MOD(
                    TIMESTAMPDIFF(
                        SECOND, execution.start_time, COALESCE(execution.end_time, NOW())
                    ),
                    3600
                ) / 60
            ),
            '分钟'
        )
    END AS `工序用时`,
    ctx.plan_qty AS `计划生产数量`,
    execution.qty_done AS `累计完工数量`,
    execution.qty_a AS `A级数量`,
    execution.qty_a1 AS `A1级数量`,
    execution.qty_a2 AS `A2级数量`,
    execution.qty_c AS `C级数量`,
    CASE WHEN COALESCE(prints.print_count, 0) > 0 THEN '是' ELSE '否' END
        AS `是否打印流转标签`,
    COALESCE(prints.print_count, 0) AS `标签打印次数`,
    COALESCE((
        SELECT GROUP_CONCAT(
            CASE
                WHEN remaining_execution.id IS NULL
                  OR remaining_execution.status <> 'done'
                THEN remaining_process.process_name
            END
            ORDER BY remaining_step.seq SEPARATOR ' → '
        )
        FROM mo_route_step_yx remaining_step
        JOIN mo_process_yx remaining_process
          ON remaining_process.id = remaining_step.process_id
        LEFT JOIN mo_execution_yx remaining_execution
          ON remaining_execution.mo_code = ro.mo_code
         AND remaining_execution.sort_seq = ro.sort_seq
         AND remaining_execution.route_id = ro.route_id
         AND remaining_execution.seq = remaining_step.seq
        WHERE remaining_step.route_id = ro.route_id
    ), '无') AS `剩余未完成工序`
FROM (
    SELECT DISTINCT mo_code, sort_seq, route_id
    FROM mo_execution_yx
) ro
JOIN mo_route_yx route ON route.id = ro.route_id
JOIN mo_route_step_yx step ON step.route_id = ro.route_id
JOIN mo_process_yx process ON process.id = step.process_id
LEFT JOIN mo_execution_yx execution
  ON execution.mo_code = ro.mo_code
 AND execution.sort_seq = ro.sort_seq
 AND execution.route_id = ro.route_id
 AND execution.seq = step.seq
LEFT JOIN (
    SELECT execution_id,
           GROUP_CONCAT(
               DISTINCT user_name_snapshot ORDER BY id SEPARATOR '、'
           ) AS worker_names
    FROM mo_execution_worker_yx
    GROUP BY execution_id
) workers ON workers.execution_id = execution.id
LEFT JOIN (
    SELECT execution_id, COUNT(*) AS print_count
    FROM mo_execution_print_log_yx
    GROUP BY execution_id
) prints ON prints.execution_id = execution.id
LEFT JOIN mo_workorder_context_yx ctx
  ON ctx.mo_code = ro.mo_code
 AND ctx.sort_seq = ro.sort_seq
ORDER BY ro.mo_code DESC, ro.sort_seq, step.seq;
