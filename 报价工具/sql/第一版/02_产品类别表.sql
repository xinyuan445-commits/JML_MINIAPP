-- ============================================================
-- 报价工具 - 产品类别表
-- 数据库: MySQL (utf8mb4)
-- 说明: 产品类别字典，工艺路线按 产品类别 + 单/双面 区分
-- 表前缀 bj_ = 报价
-- ============================================================

CREATE TABLE IF NOT EXISTS `bj_product_category_yx` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '内部主键',
  `code`       VARCHAR(8)   NOT NULL                COMMENT '类别编号，保留前导零',
  `name`       VARCHAR(50)  NOT NULL                COMMENT '类别名称',
  `first_pass_rate`  DECIMAL(6,4)  DEFAULT NULL     COMMENT '一次合格率(实际值)，如 0.9800 表示 98%',
  `gross_margin_rate` DECIMAL(6,4) DEFAULT NULL     COMMENT '毛利率默认值，如 0.3000 表示 30%',
  `tax_rate`         DECIMAL(6,4)  DEFAULT NULL     COMMENT '税率默认值，如 0.1300 表示 13%',
  `sort_order` INT          NOT NULL DEFAULT 0      COMMENT '排序',
  `is_enabled` TINYINT      NOT NULL DEFAULT 1      COMMENT '是否启用：1启用 0停用',
  `remark`     VARCHAR(255)          DEFAULT NULL   COMMENT '备注',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP                       COMMENT '创建时间',
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-产品类别表';

-- ------------------------------------------------------------
-- 初始数据：11 个产品类别
-- ------------------------------------------------------------
INSERT INTO `bj_product_category_yx` (`code`, `name`, `sort_order`) VALUES
('01', '木质三胺烤漆板',   1),
('02', 'HPL三胺烤漆板',    2),
('03', '玻镁三胺烤漆板',   3),
('04', '木质木皮烤漆板',   4),
('05', 'HPL木皮烤漆板',    5),
('06', '玻镁木皮烤漆板',   6),
('07', '木质创意背板',     7),
('08', '玻镁创意背板',     8),
('09', '包敷线条',         9),
('10', '销售样块',         10),
('11', 'OEM加工',          11);
