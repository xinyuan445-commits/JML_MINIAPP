-- ============================================================
-- 报价工具 - 成本类别字典表
-- 数据库: MySQL (utf8mb4)
-- 说明: 7 大成本归属类别 A~G。A/B/C/D/E/G 按工序归集，F 管理成本按部门归集
-- 表前缀 bj_ = 报价
-- ============================================================

CREATE TABLE IF NOT EXISTS `bj_cost_type_yx` (
  `code`       CHAR(1)      NOT NULL                COMMENT '成本类别代码 A~G',
  `name`       VARCHAR(50)  NOT NULL                COMMENT '成本类别名称',
  `allocate_by` VARCHAR(20) NOT NULL DEFAULT '工序' COMMENT '归集维度：工序 / 部门',
  `sort_order` INT          NOT NULL DEFAULT 0      COMMENT '排序',
  `remark`     VARCHAR(255)          DEFAULT NULL   COMMENT '备注',
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-成本类别字典表';

INSERT INTO `bj_cost_type_yx` (`code`, `name`, `allocate_by`, `sort_order`) VALUES
('A', '直接人工成本',   '工序', 1),
('B', 'BOM材料成本',    '工序', 2),
('C', '能耗成本',       '工序', 3),
('D', '一次性耗材成本', '工序', 4),
('E', '维修成本',       '工序', 5),
('F', '管理成本',       '部门', 6),
('G', '设备折旧成本',   '工序', 7);
