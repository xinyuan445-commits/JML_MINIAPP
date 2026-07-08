-- ============================================================
-- 报价工具 - B BOM材料成本表
-- 数据库: MySQL (utf8mb4)
-- 说明: 按工序记录单位材料成本，通过 process_code 关联 bj_process_yx
--       注: B 为 BOM 材料成本，后续可能扩展为 BOM 用量 × 材料价，先按单位成本建
-- 表前缀 bj_ = 报价
-- ============================================================

CREATE TABLE IF NOT EXISTS `bj_material_cost_yx` (
  `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '内部主键',
  `process_code` VARCHAR(8)    NOT NULL                COMMENT '工序编号，关联 bj_process_yx.code',
  `unit_cost`    DECIMAL(12,6) NOT NULL                COMMENT '单位材料成本',
  `remark`       VARCHAR(255)           DEFAULT NULL   COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP                       COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_process_code` (`process_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-B BOM材料成本表';
