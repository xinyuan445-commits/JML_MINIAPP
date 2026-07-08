CREATE TABLE IF NOT EXISTS `mo_execution_worker_yx` (
  `id`                 BIGINT       NOT NULL AUTO_INCREMENT,
  `execution_id`       BIGINT       NOT NULL COMMENT 'mo_execution_yx.id',
  `ding_user_id`       VARCHAR(100) NOT NULL COMMENT '钉钉userid',
  `user_name_snapshot` VARCHAR(100) NOT NULL,
  `mobile_snapshot`    VARCHAR(30)  DEFAULT NULL,
  `dept_id_snapshot`   BIGINT       DEFAULT NULL,
  `dept_path_snapshot` VARCHAR(1000) DEFAULT NULL,
  `create_time`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_exec_worker` (`execution_id`, `ding_user_id`),
  KEY `idx_exec_worker_user` (`ding_user_id`),
  KEY `idx_exec_worker_exec` (`execution_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序执行人员快照';

