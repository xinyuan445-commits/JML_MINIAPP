-- ============================================================
-- 报价工具 - 工序主表
-- 数据库: MySQL (utf8mb4)
-- 说明: 工序字典主表，工艺路线 / 各类成本表均通过 code 引用本表
-- 表前缀 bj_ = 报价，所有报价工具相关表统一使用该前缀
-- ============================================================

CREATE TABLE IF NOT EXISTS `bj_process_yx` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '内部主键',
  `code`       VARCHAR(8)   NOT NULL                COMMENT '工序编号，保留前导零，如 01',
  `name`       VARCHAR(50)  NOT NULL                COMMENT '工序名称',
  `sort_order` INT          NOT NULL DEFAULT 0      COMMENT '排序',
  `is_enabled` TINYINT      NOT NULL DEFAULT 1      COMMENT '是否启用：1启用 0停用',
  `remark`     VARCHAR(255)          DEFAULT NULL   COMMENT '备注',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP                       COMMENT '创建时间',
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-工序主表';

-- ------------------------------------------------------------
-- 初始数据：18 道工序
-- ------------------------------------------------------------
INSERT INTO `bj_process_yx` (`code`, `name`, `sort_order`) VALUES
('01', '三胺压贴（温康纳）工序', 1),
('02', '三胺压贴（安德斯）工序', 2),
('03', '木皮压贴工序',           3),
('04', '拼皮工序',               4),
('05', '倒角工序',               5),
('06', '拉丝工序',               6),
('07', '修补工序',               7),
('08', '水性工序',               8),
('09', '修色',                   9),
('10', '木皮打印工序',           10),
('11', '肤感烤漆工序',           11),
('12', '裁切工序',               12),
('13', '封边工序',               13),
('14', '平贴工序',               14),
('15', '防火板粘贴工序',         15),
('16', '防火板脱胶',             16),
('17', '防火板砂光',             17),
('18', '泰兴工厂压贴',           18),
('19', '防火板人工覆膜',         19);
