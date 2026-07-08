-- ============================================================
-- 报价工具 v2 - 工序成本明细
-- 说明：
-- 1. 产品类别和管理分摊规则来自重建后的 bj_product_cost_yx。
-- 2. 工序人工、辅助材料、能耗分别维护。
-- 3. 管理费用、公共能耗、包装辅材按产品路线固定增加一次。
-- 4. 空白成本统一按 0 写入。
-- 5. 同类工序按人工/辅材/能耗分别选择单位成本最高的方案；路线明确指定时按指定方案。
-- ============================================================

-- 工序主表
CREATE TABLE IF NOT EXISTS `bj_process_yx` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '内部主键',
  `process_code` VARCHAR(8)   NOT NULL COMMENT '工序编码',
  `process_name` VARCHAR(100) NOT NULL COMMENT '工序名称',
  `process_group` VARCHAR(32)          DEFAULT NULL COMMENT '同类工序分组；各成本类别分别取单位成本最高方案',
  `unit`         VARCHAR(8)   NOT NULL DEFAULT '张' COMMENT '单位',
  `sort_no`      INT          NOT NULL DEFAULT 0 COMMENT '排序',
  `is_enabled`   TINYINT      NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  `remark`       VARCHAR(255)          DEFAULT NULL COMMENT '备注',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_process_code` (`process_code`),
  KEY `idx_process_group` (`process_group`, `is_enabled`),
  KEY `idx_process_sort` (`sort_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-工序主表';

-- 产品类别与工序顺序关系。
-- 路线明确工序方案时填写 process_code；仅指定同类工序时填写 process_group，
-- 后端从该组启用方案中，按人工/辅材/能耗分别选择单位成本最高者。
-- 同一工序重复执行时可写多条不同 seq_no。
CREATE TABLE IF NOT EXISTS `bj_product_process_yx` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '内部主键',
  `product_code` VARCHAR(8)   NOT NULL COMMENT '产品类别编码，对应 bj_product_cost_yx.code',
  `seq_no`       INT          NOT NULL COMMENT '工序顺序',
  `process_code` VARCHAR(8)            DEFAULT NULL COMMENT '明确工序编码',
  `process_group` VARCHAR(32)          DEFAULT NULL COMMENT '工序分组；与process_code二选一',
  `remark`       VARCHAR(255)          DEFAULT NULL COMMENT '步骤备注',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_seq` (`product_code`, `seq_no`),
  KEY `idx_product_process` (`product_code`, `process_code`),
  KEY `idx_process_code` (`process_code`),
  KEY `idx_process_group` (`process_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-产品工序关系表';

-- 工序人工单位成本（未税，直接计入成本未税）
CREATE TABLE IF NOT EXISTS `bj_process_labor_cost_yx` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `process_code` VARCHAR(8)   NOT NULL COMMENT '工序编码',
  `cost_amount`  DECIMAL(12,4) NOT NULL DEFAULT 0 COMMENT '单位人工成本',
  `is_enabled`   TINYINT      NOT NULL DEFAULT 1,
  `remark`       VARCHAR(255)          DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_process_code` (`process_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-工序人工单位成本';

-- 工序辅助材料单位成本（含税，报价计算时统一除以1.13）
CREATE TABLE IF NOT EXISTS `bj_process_aux_cost_yx` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `process_code` VARCHAR(8)   NOT NULL COMMENT '工序编码',
  `cost_amount`  DECIMAL(12,4) NOT NULL DEFAULT 0 COMMENT '单位辅助材料成本（含税）',
  `is_enabled`   TINYINT      NOT NULL DEFAULT 1,
  `remark`       VARCHAR(255)          DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_process_code` (`process_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-工序辅助材料单位成本';

-- 工序能耗单位成本（未税，直接计入成本未税）
CREATE TABLE IF NOT EXISTS `bj_process_energy_cost_yx` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `process_code` VARCHAR(8)   NOT NULL COMMENT '工序编码',
  `cost_amount`  DECIMAL(12,4) NOT NULL DEFAULT 0 COMMENT '单位能耗成本',
  `is_enabled`   TINYINT      NOT NULL DEFAULT 1,
  `remark`       VARCHAR(255)          DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_process_code` (`process_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-工序能耗单位成本';

-- 每条产品路线固定增加一次的公共费用。
-- MANAGEMENT 需再乘产品类别的管理分摊比例（无=0、1/4=0.25、1/2=0.5）。
CREATE TABLE IF NOT EXISTS `bj_common_cost_yx` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `cost_code`      VARCHAR(32)  NOT NULL COMMENT 'MANAGEMENT/COMMON_ENERGY/PACKAGING_AUX',
  `cost_name`      VARCHAR(100) NOT NULL COMMENT '费用名称',
  `cost_category`  VARCHAR(16)  NOT NULL COMMENT 'MANAGEMENT/ENERGY/AUX',
  `cost_amount`    DECIMAL(12,4) NOT NULL DEFAULT 0 COMMENT '每条路线单位金额',
  `is_tax_included` TINYINT     NOT NULL DEFAULT 0 COMMENT '1含税 0未税',
  `apply_rule`     VARCHAR(32)  NOT NULL DEFAULT 'ONCE_PER_ROUTE' COMMENT '应用规则',
  `is_enabled`     TINYINT      NOT NULL DEFAULT 1,
  `remark`         VARCHAR(255)          DEFAULT NULL,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cost_code` (`cost_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-路线公共费用';

-- ============================================================
-- 工序基础数据
-- 03W/03P 为木皮压贴的水胶/PUR两个方案；同组未明确方案时默认取总成本高者。
-- 编码20预留；21沿用原始资料中的“线条制作”编码。
-- ============================================================
INSERT INTO `bj_process_yx`
  (`process_code`,`process_name`,`process_group`,`unit`,`sort_no`,`is_enabled`,`remark`)
VALUES
('01','三胺压贴（温康纳）工序','MELAMINE_PRESS','张',1,1,NULL),
('02','三胺压贴（安德斯）工序','MELAMINE_PRESS','张',2,1,NULL),
('03W','木皮压贴工序（水胶）','VENEER_PRESS','张',3,1,NULL),
('03P','木皮压贴工序（PUR）','VENEER_PRESS','张',4,1,NULL),
('04','拼皮工序',NULL,'张',5,1,NULL),
('05','倒角工序',NULL,'张',6,1,NULL),
('06','拉丝工序',NULL,'张',7,1,NULL),
('07','修补工序',NULL,'张',8,1,NULL),
('08','水性工序',NULL,'张',9,1,NULL),
('09','修色工序',NULL,'张',10,1,NULL),
('10','木皮打印工序',NULL,'张',11,1,NULL),
('11','肤感烤漆工序',NULL,'张',12,1,NULL),
('12','裁切工序',NULL,'张',13,1,NULL),
('13','封边工序',NULL,'张',14,1,NULL),
('14','平贴工序',NULL,'张',15,1,NULL),
('15','防火板粘贴工序',NULL,'张',16,1,NULL),
('16','防火板脱胶工序',NULL,'张',17,1,NULL),
('17','防火板砂光工序',NULL,'张',18,1,NULL),
('18','泰兴工厂压贴工序',NULL,'张',19,1,NULL),
('19','防火板人工覆膜工序',NULL,'张',20,1,NULL),
('21','线条制作工序',NULL,'根',21,1,NULL)
ON DUPLICATE KEY UPDATE
  `process_name`=VALUES(`process_name`),
  `process_group`=VALUES(`process_group`),
  `unit`=VALUES(`unit`),
  `sort_no`=VALUES(`sort_no`),
  `is_enabled`=VALUES(`is_enabled`),
  `remark`=VALUES(`remark`);

-- 人工单位成本
INSERT INTO `bj_process_labor_cost_yx` (`process_code`,`cost_amount`,`is_enabled`) VALUES
('01',1.00,1),('02',2.25,1),('03W',4.00,1),('03P',4.00,1),
('04',10.00,1),('05',2.25,1),('06',1.50,1),('07',6.00,1),
('08',1.50,1),('09',3.75,1),('10',7.50,1),('11',4.31,1),
('12',6.00,1),('13',1.50,1),('14',4.67,1),('15',7.00,1),
('16',3.75,1),('17',3.75,1),('18',3.00,1),('19',2.00,1),
('21',10.00,1)
ON DUPLICATE KEY UPDATE `cost_amount`=VALUES(`cost_amount`),`is_enabled`=VALUES(`is_enabled`);

-- 辅助材料单位成本（含税）
INSERT INTO `bj_process_aux_cost_yx` (`process_code`,`cost_amount`,`is_enabled`,`remark`) VALUES
('01',2.86,1,NULL),('02',0.00,1,NULL),
('03W',5.57,1,'水胶'),('03P',8.14,1,'PUR'),
('04',3.65,1,NULL),('05',0.00,1,NULL),('06',0.71,1,NULL),('07',0.15,1,NULL),
('08',17.35,1,NULL),('09',2.24,1,NULL),('10',60.51,1,NULL),('11',32.65,1,NULL),
('12',3.98,1,NULL),('13',0.04,1,NULL),('14',5.43,1,NULL),('15',4.95,1,NULL),
('16',0.00,1,NULL),('17',4.00,1,NULL),('18',8.14,1,NULL),
('19',6.65,1,'包装材料（覆膜）'),('21',32.16,1,'线条制作')
ON DUPLICATE KEY UPDATE
  `cost_amount`=VALUES(`cost_amount`),`is_enabled`=VALUES(`is_enabled`),`remark`=VALUES(`remark`);

-- 能耗单位成本；原资料空白项按0。
INSERT INTO `bj_process_energy_cost_yx` (`process_code`,`cost_amount`,`is_enabled`) VALUES
('01',1.27,1),('02',1.76,1),('03W',1.52,1),('03P',1.52,1),
('04',1.04,1),('05',0.00,1),('06',0.00,1),('07',0.00,1),
('08',0.00,1),('09',0.00,1),('10',1.64,1),('11',1.07,1),
('12',2.17,1),('13',0.00,1),('14',0.00,1),('15',0.00,1),
('16',0.00,1),('17',0.00,1),('18',6.77,1),('19',0.00,1),
('21',0.00,1)
ON DUPLICATE KEY UPDATE `cost_amount`=VALUES(`cost_amount`),`is_enabled`=VALUES(`is_enabled`);

-- 路线公共费用
INSERT INTO `bj_common_cost_yx`
  (`cost_code`,`cost_name`,`cost_category`,`cost_amount`,`is_tax_included`,`apply_rule`,`is_enabled`,`remark`)
VALUES
('MANAGEMENT','管理费用','MANAGEMENT',40.38,0,'ONCE_PER_ROUTE',1,'按产品类别管理分摊率0/1/4/1/2计算'),
('COMMON_ENERGY','能耗公摊','ENERGY',3.43,0,'ONCE_PER_ROUTE',1,'每条产品路线固定增加一次'),
('PACKAGING_AUX','内销打托材料','AUX',3.87,1,'ONCE_PER_ROUTE',1,'当前报价公式统一使用3.87')
ON DUPLICATE KEY UPDATE
  `cost_name`=VALUES(`cost_name`),
  `cost_category`=VALUES(`cost_category`),
  `cost_amount`=VALUES(`cost_amount`),
  `is_tax_included`=VALUES(`is_tax_included`),
  `apply_rule`=VALUES(`apply_rule`),
  `is_enabled`=VALUES(`is_enabled`),
  `remark`=VALUES(`remark`);

-- 核对：每个工序应同时存在人工、辅材、能耗三类成本。
SELECT
  p.process_code,
  p.process_name,
  l.cost_amount AS labor_cost,
  a.cost_amount AS aux_cost_incl_tax,
  e.cost_amount AS energy_cost,
  (l.cost_amount + a.cost_amount + e.cost_amount) AS total_display_cost
FROM bj_process_yx p
LEFT JOIN bj_process_labor_cost_yx l ON l.process_code=p.process_code AND l.is_enabled=1
LEFT JOIN bj_process_aux_cost_yx a ON a.process_code=p.process_code AND a.is_enabled=1
LEFT JOIN bj_process_energy_cost_yx e ON e.process_code=p.process_code AND e.is_enabled=1
WHERE p.is_enabled=1
ORDER BY p.sort_no, p.process_code;
