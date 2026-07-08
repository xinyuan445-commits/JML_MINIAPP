CREATE TABLE IF NOT EXISTS `mo_rework_yx` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `source_execution_id` BIGINT NOT NULL COMMENT '原完工执行记录ID',
  `mo_code` VARCHAR(50) NOT NULL,
  `sort_seq` INT NOT NULL,
  `route_id` INT NOT NULL,
  `seq` INT NOT NULL,
  `process_name` VARCHAR(100) DEFAULT NULL,
  `qty_input` DECIMAL(18,4) NOT NULL COMMENT '投入返工的C级数量',
  `qty_a` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `qty_c` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `reason` VARCHAR(500) NOT NULL,
  `complete_remark` VARCHAR(500) DEFAULT NULL,
  `operator_id` VARCHAR(50) DEFAULT NULL,
  `operator_name` VARCHAR(100) DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'processing',
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME DEFAULT NULL,
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rework_source_status` (`source_execution_id`, `status`),
  KEY `idx_rework_order` (`mo_code`, `sort_seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='C级品返工记录';

CREATE TABLE IF NOT EXISTS `mo_rework_worker_yx` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `rework_id` BIGINT NOT NULL,
  `ding_user_id` VARCHAR(100) NOT NULL,
  `user_name_snapshot` VARCHAR(100) NOT NULL,
  `mobile_snapshot` VARCHAR(30) DEFAULT NULL,
  `dept_id_snapshot` BIGINT DEFAULT NULL,
  `dept_path_snapshot` VARCHAR(1000) DEFAULT NULL,
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rework_worker` (`rework_id`, `ding_user_id`),
  KEY `idx_rework_worker` (`rework_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='返工人员快照';
