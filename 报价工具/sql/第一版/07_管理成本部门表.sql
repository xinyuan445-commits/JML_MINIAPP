-- ============================================================
-- 报价工具 - F 管理成本部门表
-- 数据库: MySQL (utf8mb4)
-- 说明: F 管理成本按部门归集，先把部门字典放上（结构后续按分摊口径再补）
-- 表前缀 bj_ = 报价
-- ============================================================

CREATE TABLE IF NOT EXISTS `bj_management_dept_yx` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '内部主键',
  `code`       VARCHAR(8)   NOT NULL                COMMENT '部门编号',
  `name`       VARCHAR(50)  NOT NULL                COMMENT '部门名称',
  `sort_order` INT          NOT NULL DEFAULT 0      COMMENT '排序',
  `is_enabled` TINYINT      NOT NULL DEFAULT 1      COMMENT '是否启用：1启用 0停用',
  `remark`     VARCHAR(255)          DEFAULT NULL   COMMENT '备注',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-F管理成本部门表';

INSERT INTO `bj_management_dept_yx` (`code`, `name`, `sort_order`) VALUES
('01', '生产部门', 1),
('02', '质量部门', 2),
('03', '运营部门', 3),
('04', '行政部门', 4);
