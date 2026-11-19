-- 钉钉通讯录镜像（DB2 / MySQL 5.7）

CREATE TABLE IF NOT EXISTS `ding_department_yx` (
  `dept_id`          BIGINT       NOT NULL COMMENT '钉钉部门ID',
  `parent_dept_id`   BIGINT       DEFAULT NULL COMMENT '上级部门ID',
  `dept_name`        VARCHAR(200) NOT NULL,
  `dept_level`       INT          NOT NULL DEFAULT 1,
  `dept_path`        VARCHAR(1000) NOT NULL DEFAULT '',
  `sort_order`       BIGINT       NOT NULL DEFAULT 0,
  `is_active`        TINYINT      NOT NULL DEFAULT 1,
  `last_seen_sync`   VARCHAR(36)  DEFAULT NULL,
  `create_time`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`dept_id`),
  KEY `idx_ding_dept_parent` (`parent_dept_id`),
  KEY `idx_ding_dept_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='钉钉部门镜像';

CREATE TABLE IF NOT EXISTS `ding_user_yx` (
  `user_id`          VARCHAR(100) NOT NULL COMMENT '钉钉userid',
  `union_id`         VARCHAR(100) DEFAULT NULL,
  `user_name`        VARCHAR(100) NOT NULL,
  `mobile`           VARCHAR(30)  DEFAULT NULL,
  `job_number`       VARCHAR(100) DEFAULT NULL,
  `title`            VARCHAR(100) DEFAULT NULL,
  `main_dept_id`     BIGINT       DEFAULT NULL,
  `is_admin`         TINYINT      NOT NULL DEFAULT 0,
  `is_boss`          TINYINT      NOT NULL DEFAULT 0,
  `is_active`        TINYINT      NOT NULL DEFAULT 1,
  `last_seen_sync`   VARCHAR(36)  DEFAULT NULL,
  `create_time`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  KEY `idx_ding_user_mobile` (`mobile`),
  KEY `idx_ding_user_main_dept` (`main_dept_id`),
  KEY `idx_ding_user_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='钉钉用户镜像';

CREATE TABLE IF NOT EXISTS `ding_user_department_yx` (
  `user_id`          VARCHAR(100) NOT NULL,
  `dept_id`          BIGINT       NOT NULL,
  `is_leader`        TINYINT      NOT NULL DEFAULT 0,
  `create_time`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `dept_id`),
  KEY `idx_ding_user_dept_dept` (`dept_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='钉钉用户部门关系';

CREATE TABLE IF NOT EXISTS `ding_sync_log_yx` (
  `id`                BIGINT       NOT NULL AUTO_INCREMENT,
  `sync_id`           VARCHAR(36)  NOT NULL,
  `trigger_type`      VARCHAR(20)  NOT NULL COMMENT 'cron|manual',
  `status`            VARCHAR(20)  NOT NULL COMMENT 'running|success|failed',
  `department_count`  INT          NOT NULL DEFAULT 0,
  `user_count`        INT          NOT NULL DEFAULT 0,
  `disabled_depts`    INT          NOT NULL DEFAULT 0,
  `disabled_users`    INT          NOT NULL DEFAULT 0,
  `error_message`     VARCHAR(1000) DEFAULT NULL,
  `start_time`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time`          DATETIME     DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ding_sync_id` (`sync_id`),
  KEY `idx_ding_sync_start` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='钉钉通讯录同步日志';

CREATE TABLE IF NOT EXISTS `mo_worker_department_scope_yx` (
  `dept_id`          BIGINT       NOT NULL COMMENT '允许参与报工的钉钉部门ID',
  `updated_by`       VARCHAR(100) DEFAULT NULL,
  `create_time`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`dept_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序报工人员部门范围';

