-- ============================================================
-- MO 工序流转系统 v2  (DB2: wecom-db)
-- ============================================================

-- 1. 工序定义
-- ------------------------------------------------------------
CREATE TABLE `mo_process_yx` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `process_code` VARCHAR(50)  NOT NULL                    COMMENT '工序编码',
  `process_name` VARCHAR(100) NOT NULL                    COMMENT '工序名称',
  `description`  VARCHAR(200) DEFAULT NULL,
  `sort`         INT          NOT NULL DEFAULT 0,
  `is_active`    TINYINT      NOT NULL DEFAULT 1,
  `create_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_process_code` (`process_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序定义';


-- 2. 工站定义
-- ------------------------------------------------------------
CREATE TABLE `mo_workstation_yx` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `station_code` VARCHAR(50)  NOT NULL                    COMMENT '工站编码',
  `station_name` VARCHAR(100) NOT NULL                    COMMENT '工站名称',
  `description`  VARCHAR(200) DEFAULT NULL,
  `is_active`    TINYINT      NOT NULL DEFAULT 1,
  `create_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_station_code` (`station_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工站定义';


-- 3. 工艺路线
-- is_default：同一 dept_code 下只能有一条为 1，Web后台保存时互斥
-- ------------------------------------------------------------
CREATE TABLE `mo_route_yx` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `route_code`  VARCHAR(50)  NOT NULL                    COMMENT '路线编码',
  `route_name`  VARCHAR(100) NOT NULL                    COMMENT '路线名称',
  `dept_code`   VARCHAR(50)  DEFAULT NULL                COMMENT '匹配部门编码（来自U8）',
  `dept_name`   VARCHAR(100) DEFAULT NULL,
  `is_default`  TINYINT      NOT NULL DEFAULT 0          COMMENT '是否为该部门的默认路线',
  `description` VARCHAR(200) DEFAULT NULL,
  `is_active`   TINYINT      NOT NULL DEFAULT 1,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_route_code` (`route_code`),
  KEY `idx_dept_default` (`dept_code`, `is_default`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工艺路线';


-- 4. 路线步骤（有序工序，不再绑定工站，工站由步骤工站表维护）
-- ------------------------------------------------------------
CREATE TABLE `mo_route_step_yx` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `route_id`   INT NOT NULL                              COMMENT '所属路线',
  `seq`        INT NOT NULL                              COMMENT '步骤顺序，从1开始',
  `process_id` INT NOT NULL                              COMMENT '工序',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_route_seq` (`route_id`, `seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='路线步骤';


-- 4b. 步骤允许工站（一个步骤可对应多个工站，由PMC维护）
-- ------------------------------------------------------------
CREATE TABLE `mo_step_station_yx` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `step_id`    INT NOT NULL                              COMMENT '路线步骤ID',
  `station_id` INT NOT NULL                              COMMENT '允许的工站ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_step_station` (`step_id`, `station_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='步骤允许工站';


-- 5. 工单路线绑定（显式绑定优先于部门默认）
-- ------------------------------------------------------------
CREATE TABLE `mo_wo_route_yx` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `mo_code`     VARCHAR(50)  NOT NULL                    COMMENT '工单号',
  `sort_seq`    INT          NOT NULL                    COMMENT '工单行号',
  `route_id`    INT          NOT NULL                    COMMENT '指定路线',
  `remark`      VARCHAR(200) DEFAULT NULL,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wo` (`mo_code`, `sort_seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工单路线绑定';


-- 6. 工单当前执行状态（小程序实时显示进度）
-- 每个工单行一条，current_seq 随完工自动推进
-- ------------------------------------------------------------
CREATE TABLE `mo_wo_state_yx` (
  `mo_code`     VARCHAR(50)  NOT NULL                    COMMENT '工单号',
  `sort_seq`    INT          NOT NULL                    COMMENT '工单行号',
  `route_id`    INT          NOT NULL                    COMMENT '工艺路线ID',
  `current_seq` INT          NOT NULL DEFAULT 1          COMMENT '当前步骤序号',
  `status`      VARCHAR(20)  NOT NULL DEFAULT 'pending'  COMMENT 'pending|processing|done',
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`mo_code`, `sort_seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工单当前执行状态';


-- 7. 执行记录
-- 唯一键：工单号 + 工单行号 + 路线ID + 步骤序号
-- process_name / station_name 做快照，路线改版后历史仍可读
-- ------------------------------------------------------------
CREATE TABLE `mo_execution_yx` (
  `id`               INT           NOT NULL AUTO_INCREMENT,
  `mo_code`          VARCHAR(50)   NOT NULL                COMMENT '工单号',
  `sort_seq`         INT           NOT NULL                COMMENT '工单行号',
  `route_id`         INT           NOT NULL                COMMENT '工艺路线ID',
  `seq`              INT           NOT NULL                COMMENT '步骤序号',
  `process_id`       INT           NOT NULL                COMMENT '工序ID',
  `station_id`       INT           DEFAULT NULL            COMMENT '实际执行工站ID',
  `process_name`     VARCHAR(100)  DEFAULT NULL            COMMENT '工序名快照',
  `station_name`     VARCHAR(100)  DEFAULT NULL            COMMENT '工站名快照',
  `operator_id`      VARCHAR(50)   DEFAULT NULL,
  `operator_name`    VARCHAR(100)  DEFAULT NULL,
  `qty_done`         DECIMAL(18,4) NOT NULL DEFAULT 0      COMMENT '完成数量',
  `qty_defect`       DECIMAL(18,4) NOT NULL DEFAULT 0      COMMENT '不良数量',
  `defect_reason`    VARCHAR(200)  DEFAULT NULL,
  `start_time`       DATETIME      DEFAULT NULL,
  `end_time`         DATETIME      DEFAULT NULL,
  `status`           VARCHAR(20)   NOT NULL DEFAULT 'processing'
                                                           COMMENT 'processing|done|interrupted',
  `interrupt_reason` VARCHAR(100)  DEFAULT NULL,
  `interrupt_time`   DATETIME      DEFAULT NULL,
  `create_time`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_exec`    (`mo_code`, `sort_seq`, `route_id`, `seq`),
  KEY `idx_mo`            (`mo_code`, `sort_seq`),
  KEY `idx_station_status`(`station_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='执行记录';


-- 8. 工站交接记录
-- ------------------------------------------------------------
CREATE TABLE `mo_handover_yx` (
  `id`              INT           NOT NULL AUTO_INCREMENT,
  `mo_code`         VARCHAR(50)   NOT NULL                COMMENT '工单号',
  `sort_seq`        INT           NOT NULL                COMMENT '工单行号',
  `route_id`        INT           NOT NULL,
  `from_seq`        INT           NOT NULL                COMMENT '交出步骤序号',
  `to_seq`          INT           NOT NULL                COMMENT '接收步骤序号',
  `from_station_id` INT           DEFAULT NULL,
  `to_station_id`   INT           DEFAULT NULL,
  `qty_out`         DECIMAL(18,4) NOT NULL DEFAULT 0      COMMENT '交出数量',
  `qty_in`          DECIMAL(18,4) NOT NULL DEFAULT 0      COMMENT '接收数量',
  `operator_out`    VARCHAR(100)  DEFAULT NULL            COMMENT '交出操作人',
  `operator_in`     VARCHAR(100)  DEFAULT NULL            COMMENT '接收操作人',
  `status`          VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT 'pending|confirmed',
  `create_time`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `confirm_time`    DATETIME      DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mo_status` (`mo_code`, `sort_seq`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工站交接记录';
