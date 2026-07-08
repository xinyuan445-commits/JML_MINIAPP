-- ============================================================
-- 报价工具 v2 - 产品类别与计算规则
--
-- 本表不再保存人工/辅材/能耗固定合计。
-- 产品实际成本由以下数据实时汇总：
--   bj_product_process_yx       产品工序关系
--   bj_process_labor_cost_yx    工序人工
--   bj_process_aux_cost_yx      工序辅助材料（含税）
--   bj_process_energy_cost_yx   工序能耗
--   bj_common_cost_yx           管理/公共能耗/包装辅材
--
-- 当前尚无正式报价记录表，允许删除旧结构后重建。
-- ============================================================

DROP TABLE IF EXISTS `bj_product_cost_yx`;

CREATE TABLE `bj_product_cost_yx` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '内部主键',
  `code`        VARCHAR(8)   NOT NULL COMMENT '产品类别编码',
  `name`        VARCHAR(100) NOT NULL COMMENT '产品类别名称',
  `route_desc`  VARCHAR(500)          DEFAULT NULL COMMENT '完整工艺路线（展示用）',
  `unit`        VARCHAR(8)            DEFAULT NULL COMMENT '报价单位',
  `mgmt_rate`   DECIMAL(8,4) NOT NULL DEFAULT 0 COMMENT '管理费用分摊比例：0/0.25/0.5',
  `mgmt_method` VARCHAR(32)           DEFAULT NULL COMMENT '管理分摊文字说明',
  `is_enabled`  TINYINT      NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  `remark`      VARCHAR(255)          DEFAULT NULL COMMENT '备注',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_enabled` (`is_enabled`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-产品类别与成本计算规则';

INSERT INTO `bj_product_cost_yx`
  (`code`,`name`,`unit`,`mgmt_rate`,`mgmt_method`,`is_enabled`,`remark`)
VALUES
('01','三胺板（PB、OSB、MDF、PW）','张',0.25,'管理均摊1/4',1,NULL),
('02','三胺板（MOB）','张',0.00,'管理均摊无',1,NULL),
('03','三胺板（HPL）','张',0.25,'管理均摊1/4',1,NULL),
('04','三胺单面肤感板（PB、OSB、MDF、PW）','张',0.50,'管理均摊1/2',1,NULL),
('05','三胺双面肤感板（PB、OSB、MDF、PW）','张',0.50,'管理均摊1/2',1,NULL),
('06','三胺单面肤感板（MOB）','张',0.50,'管理均摊1/2',1,NULL),
('07','HPL单面肤感板（HPL）','张',0.50,'管理均摊1/2',1,NULL),
('08','仿生木皮双贴三胺板（PB、OSB、MDF、PW）','张',0.25,'管理均摊1/4',1,NULL),
('09','仿生木皮单贴三胺板（MOB）','张',0.25,'管理均摊1/4',1,NULL),
('10','仿生木皮单贴三胺板（HPL）','张',0.25,'管理均摊1/4',1,NULL),
('11','实木双贴半成品（PB、OSB、MDF、PW）','张',0.25,'管理均摊1/4',1,NULL),
('12','实木单贴肤感板（PB、OSB、MDF、PW）','张',0.50,'管理均摊1/2',1,NULL),
('13','实木双贴肤感板（PB、OSB、MDF、PW）','张',0.50,'管理均摊1/2',1,NULL),
('14','实木单贴肤感板（MOB）','张',0.50,'管理均摊1/2',1,NULL),
('15','实木单贴肤感板（HPL）','张',0.50,'管理均摊1/2',1,NULL),
('16','实木单贴+仿生木皮肤感板（PB、OSB、MDF、PW）','张',0.50,'管理均摊1/2',1,NULL),
('17','创意背板（PB、OSB、MDF、PW）','张',0.50,'管理均摊1/2',1,NULL),
('18','创意背板（MOB）','张',0.50,'管理均摊1/2',1,NULL),
('19','创意背板（HPL）','张',0.50,'管理均摊1/2',1,NULL),
('20','包敷线条（非标）','根',0.00,'管理均摊无',1,NULL),
('21','销售样块（非标）',NULL,0.00,NULL,1,'管理分摊未配置，按0'),
('22','OEM加工-三胺单面肤感（压贴好来料）',NULL,0.25,'管理均摊1/4',1,NULL),
('23','OEM加工-木皮单面肤感（压贴好来料）',NULL,0.25,'管理均摊1/4',1,NULL),
('24','附加要求-产品开槽',NULL,0.00,NULL,1,'管理分摊未配置，按0');

SELECT code, name, unit, mgmt_rate, mgmt_method, is_enabled
FROM bj_product_cost_yx
ORDER BY code;
