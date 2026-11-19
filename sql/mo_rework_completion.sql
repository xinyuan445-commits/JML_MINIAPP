CREATE TABLE IF NOT EXISTS `mo_rework_completion_yx` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `rework_id` BIGINT NOT NULL,
  `qty_a` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `qty_a1` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `qty_a2` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `qty_c` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `qty_done` DECIMAL(18,4) NOT NULL,
  `remark` VARCHAR(500) DEFAULT NULL,
  `photo_url` VARCHAR(2000) DEFAULT NULL,
  `quality_report_photo_urls` TEXT DEFAULT NULL COMMENT '质量报告单照片JSON数组，最多2张',
  `operator_id` VARCHAR(50) DEFAULT NULL,
  `operator_name` VARCHAR(100) DEFAULT NULL,
  `is_final` TINYINT(1) NOT NULL DEFAULT 0,
  `complete_time` DATETIME NOT NULL,
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rework_completion` (`rework_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='返工分批完工明细';
