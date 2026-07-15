CREATE TABLE IF NOT EXISTS `mo_execution_print_log_yx` (
  `id`                BIGINT       NOT NULL AUTO_INCREMENT,
  `execution_id`      INT          NOT NULL COMMENT '工序执行记录ID',
  `client_job_id`     VARCHAR(64)  NOT NULL COMMENT '客户端打印任务ID，防止重复记数',
  `printer_device_id` VARCHAR(200) DEFAULT NULL COMMENT '蓝牙设备ID',
  `printer_name`      VARCHAR(100) DEFAULT NULL COMMENT '打印机名称',
  `operator_id`       VARCHAR(50)  DEFAULT NULL COMMENT '打印操作人ID',
  `operator_name`     VARCHAR(100) DEFAULT NULL COMMENT '打印操作人姓名',
  `print_time`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_client_job` (`client_job_id`),
  KEY `idx_execution_time` (`execution_id`, `print_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序流转标签打印流水，每条记录固定一张';
