-- ============================================================
-- 报价工具 - 公共成本表
-- 数据库: MySQL (utf8mb4)
-- 说明: 不挂具体工序、每次报价都参与计算的公共成本，按 cost_type 归属到 A~G
--       每条就是一个单位成本，无明细拆分
-- 表前缀 bj_ = 报价
-- ============================================================

CREATE TABLE IF NOT EXISTS `bj_common_cost_yx` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '内部主键',
  `cost_type`  CHAR(1)       NOT NULL                COMMENT '成本类别，关联 bj_cost_type_yx.code（A~G）',
  `name`       VARCHAR(100)  NOT NULL                COMMENT '公共成本名称',
  `unit_cost`  DECIMAL(12,6) NOT NULL                COMMENT '单位成本',
  `is_enabled` TINYINT       NOT NULL DEFAULT 1      COMMENT '是否启用：1启用 0停用',
  `remark`     VARCHAR(255)           DEFAULT NULL   COMMENT '备注',
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP                       COMMENT '创建时间',
  `updated_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_cost_type` (`cost_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-公共成本表';

-- ------------------------------------------------------------
-- 初始数据：辅助人员（属于 A 直接人工，单位成本 40.38）
-- ------------------------------------------------------------
INSERT INTO `bj_common_cost_yx` (`cost_type`, `name`, `unit_cost`) VALUES
('A', '辅助人员（设备5、仓库5、计划1、采购2、行政5、质量4、生产管理6）', 40.38),
('C', '公摊电费', 3.43);
