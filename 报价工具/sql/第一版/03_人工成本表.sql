-- ============================================================
-- 报价工具 - A 直接人工成本表
-- 数据库: MySQL (utf8mb4)
-- 说明: 按工序记录单位人工成本，通过 process_code 关联 bj_process_yx
-- 表前缀 bj_ = 报价
-- ============================================================

CREATE TABLE IF NOT EXISTS `bj_labor_cost_yx` (
  `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '内部主键',
  `process_code` VARCHAR(8)    NOT NULL                COMMENT '工序编号，关联 bj_process_yx.code',
  `unit_cost`    DECIMAL(12,6) NOT NULL                COMMENT '单位人工成本',
  `remark`       VARCHAR(255)           DEFAULT NULL   COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP                       COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_process_code` (`process_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-A直接人工成本表';

-- ------------------------------------------------------------
-- 初始数据：各工序单位人工成本
-- ------------------------------------------------------------
INSERT INTO `bj_labor_cost_yx` (`process_code`, `unit_cost`) VALUES
('01', 1),
('02', 2.25),
('03', 4),
('04', 10),
('05', 2.25),
('06', 1.5),
('07', 6),
('08', 1.5),
('09', 3.75),
('10', 7.5),
('11', 4.307692),
('12', 6),
('13', 1.5),
('14', 4.666667),
('15', 7),
('16', 3.75),
('17', 3.75),
('18', 3),
('19', 2);
