CREATE TABLE IF NOT EXISTS `mo_execution_completion_yx` (
  `id`            BIGINT        NOT NULL AUTO_INCREMENT,
  `execution_id`  BIGINT        NOT NULL COMMENT 'mo_execution_yx.id',
  `qty_a`         DECIMAL(18,4) NOT NULL DEFAULT 0,
  `qty_a1`        DECIMAL(18,4) NOT NULL DEFAULT 0,
  `qty_a2`        DECIMAL(18,4) NOT NULL DEFAULT 0,
  `qty_c`         DECIMAL(18,4) NOT NULL DEFAULT 0,
  `qty_done`      DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '本次完工合计',
  `reason`        VARCHAR(200)  DEFAULT NULL,
  `photo_url`     VARCHAR(1000) DEFAULT NULL,
  `quality_report_photo_urls` TEXT DEFAULT NULL COMMENT '质量报告单照片JSON数组，最多2张',
  `operator_id`   VARCHAR(50)   DEFAULT NULL,
  `operator_name` VARCHAR(100)  DEFAULT NULL,
  `is_final`      TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '1=本次后工序结束',
  `complete_time` DATETIME      NOT NULL,
  `create_time`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_execution_time` (`execution_id`, `complete_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序分批完工记录';
