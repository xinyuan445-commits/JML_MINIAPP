-- mo_v2 补丁：在已有表基础上追加变更

-- 1. mo_route_yx 加 is_default 字段
ALTER TABLE mo_route_yx
  ADD COLUMN `is_default` TINYINT NOT NULL DEFAULT 0
    COMMENT '是否为该部门的默认路线（同一dept_code下只能有一条为1）'
    AFTER `dept_name`,
  ADD KEY `idx_dept_default` (`dept_code`, `is_default`, `is_active`);

-- 2. mo_route_step_yx 去掉 station_id（工站改由 mo_step_station_yx 维护）
ALTER TABLE mo_route_step_yx
  DROP COLUMN `station_id`;

-- 3. 新建步骤允许工站表
CREATE TABLE `mo_step_station_yx` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `step_id`    INT NOT NULL  COMMENT '路线步骤ID，关联 mo_route_step_yx.id',
  `station_id` INT NOT NULL  COMMENT '允许的工站ID，关联 mo_workstation_yx.id',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_step_station` (`step_id`, `station_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='步骤允许工站（一步可对多站）';


-- 4. 补充索引
-- mo_wo_state_yx：按状态查所有进行中工单
ALTER TABLE mo_wo_state_yx
  ADD KEY `idx_status` (`status`);

-- mo_execution_yx：按工单+状态查进行中步骤（比 idx_mo 更精确）
ALTER TABLE mo_execution_yx
  ADD KEY `idx_mo_status` (`mo_code`, `sort_seq`, `status`);

-- mo_handover_yx：按接收工站查待确认交接
ALTER TABLE mo_handover_yx
  ADD KEY `idx_to_station` (`to_station_id`, `status`);
