-- 创建字典表
CREATE TABLE `quality_conversion_dict_yx` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dict_type` varchar(50) NOT NULL COMMENT '字典类型: conversion_type, quality_level, duty_department',
  `dict_value` varchar(100) NOT NULL COMMENT '字典值',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序',
  `enabled` tinyint(1) DEFAULT '1' COMMENT '是否启用: 1是 0否',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='形态转换数据字典表';

-- 插入默认数据（就是您之前硬编码在前端的数据）
INSERT INTO `quality_conversion_dict_yx` (`dict_type`, `dict_value`, `sort_order`) VALUES
('conversion_type', '成品下线不良', 1),
('conversion_type', '制程异常围堵', 2),
('conversion_type', '出货检验不良', 3),
('conversion_type', '客诉围堵不良', 4),
('quality_level', 'A1类', 1),
('quality_level', 'A2类', 2),
('quality_level', 'B类', 3),
('quality_level', 'C类', 4),
('duty_department', '供应商', 1),
('duty_department', '仓库', 2),
('duty_department', '计划', 3),
('duty_department', '设备', 4),
('duty_department', '质量', 5),
('duty_department', '拼皮', 6),
('duty_department', '木皮压贴', 7),
('duty_department', '木皮修补', 8),
('duty_department', '木皮拉丝', 9),
('duty_department', '水性着色', 10),
('duty_department', '修色', 11),
('duty_department', '打印', 12),
('duty_department', '三胺压贴', 13),
('duty_department', '三胺烤漆', 14),
('duty_department', '三胺倒角', 15),
('duty_department', '三胺修补', 16),
('duty_department', '防火板粘胶', 17),
('duty_department', '撕防火板', 18),
('duty_department', '防火板砂光', 19),
('duty_department', '防火板裁切', 20);

-- 新增：形态转换单号字段，用于仓库审批通过时回填
ALTER TABLE `quality_conversion_log_yx` ADD COLUMN `warehouse_conversion_no` VARCHAR(100) DEFAULT '' COMMENT '仓库回填的形态转换单号';