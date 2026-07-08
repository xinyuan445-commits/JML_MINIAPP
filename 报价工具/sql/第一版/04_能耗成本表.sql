-- ============================================================
-- 报价工具 - C 能耗成本表
-- 数据库: MySQL (utf8mb4)
-- 说明: 按工序记录单位能耗成本，通过 process_code 关联 bj_process_yx
-- 表前缀 bj_ = 报价
-- ============================================================

CREATE TABLE IF NOT EXISTS `bj_energy_cost_yx` (
  `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '内部主键',
  `process_code` VARCHAR(8)    NOT NULL                COMMENT '工序编号，关联 bj_process_yx.code',
  `unit_cost`    DECIMAL(12,6) NOT NULL                COMMENT '单位能耗成本',
  `remark`       VARCHAR(255)           DEFAULT NULL   COMMENT '备注',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP                       COMMENT '创建时间',
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_process_code` (`process_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-C能耗成本表';

-- ------------------------------------------------------------
-- 初始数据：各工序单位能耗成本
-- ------------------------------------------------------------
INSERT INTO `bj_energy_cost_yx` (`process_code`, `unit_cost`, `remark`) VALUES
('01', 1.27, NULL),
('02', 1.76, NULL),
('03', 1.52, NULL),
('04', 1.04, NULL),
('05', 0.00, '与安德斯未分开'),
('06', 0.00, '与安德斯未分开'),
('07', 0.00, NULL),
('08', 0.00, '与打印线未分开'),
('09', 0.00, '与打印线未分开'),
('10', 1.64, NULL),
('11', 1.07, NULL),
('12', 2.17, NULL),
('13', 0.00, '与裁切未分开'),
('14', 0.00, '与裁切未分开'),
('15', 0.00, '与裁切未分开'),
('16', 0.00, '与打印线未分开'),
('17', 0.00, '与安德斯未分开'),
('18', 6.77, NULL);
