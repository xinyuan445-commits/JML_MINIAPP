CREATE TABLE IF NOT EXISTS `mo_makeup_record_yx` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `execution_id` BIGINT NOT NULL,
  `mo_code` VARCHAR(50) NOT NULL,
  `sort_seq` INT NOT NULL,
  `seq` INT NOT NULL,
  `qty_before` DECIMAL(18,4) NOT NULL,
  `qty_add` DECIMAL(18,4) NOT NULL,
  `qty_after` DECIMAL(18,4) NOT NULL,
  `plan_qty` DECIMAL(18,4) DEFAULT NULL,
  `reason` VARCHAR(500) DEFAULT NULL,
  `operator_id` VARCHAR(50) DEFAULT NULL,
  `operator_name` VARCHAR(100) DEFAULT NULL,
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_makeup_execution` (`execution_id`, `id`),
  KEY `idx_makeup_order` (`mo_code`, `sort_seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='下线追加记录';
