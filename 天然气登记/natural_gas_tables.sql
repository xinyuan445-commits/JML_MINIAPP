-- 天然气多工厂改造
-- 保留原表 jml_natural_gas_log，不修改、不迁移历史数据。

-- 这两张表是尚未正式使用的新表，允许删除后重新创建。
-- 必须先删除关联表，再删除设备表。
DROP TABLE IF EXISTS `jml_natural_gas_log_rel`;
DROP TABLE IF EXISTS `jml_natural_gas_device`;

CREATE TABLE `jml_natural_gas_device` (
  `id` varchar(32) NOT NULL COMMENT '主键Id',
  `device_code` varchar(50) NOT NULL COMMENT '设备编号',
  `device_name` varchar(100) NOT NULL COMMENT '设备名称',
  `factory_code` varchar(20) NOT NULL COMMENT '工厂代码',
  `factory_name` varchar(100) NOT NULL COMMENT '工厂名称',
  `is_enable` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1启用 0停用',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序号',
  `created_staff_id` varchar(20) DEFAULT NULL COMMENT '创建员工Id',
  `update_staff_id` varchar(20) DEFAULT NULL COMMENT '修改员工Id',
  `created_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_code` (`device_code`),
  KEY `idx_factory_enable` (`factory_code`, `is_enable`),
  KEY `idx_sort_no` (`sort_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='天然气设备表';

CREATE TABLE `jml_natural_gas_log_rel` (
  `id` varchar(32) NOT NULL COMMENT '主键Id',
  `log_id` varchar(32) NOT NULL COMMENT '登记表Id，对应 jml_natural_gas_log.id',
  `device_id` varchar(32) NOT NULL COMMENT '设备Id，对应 jml_natural_gas_device.id',
  `factory_code` varchar(20) NOT NULL COMMENT '工厂代码快照',
  `factory_name` varchar(100) NOT NULL COMMENT '工厂名称快照',
  `device_code` varchar(50) NOT NULL COMMENT '设备编号快照',
  `device_name` varchar(100) NOT NULL COMMENT '设备名称快照',
  `created_staff_id` varchar(20) DEFAULT NULL COMMENT '创建员工Id',
  `created_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_log_id` (`log_id`),
  KEY `idx_device_time` (`device_id`, `created_time`),
  KEY `idx_factory_time` (`factory_code`, `created_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='天然气登记设备关联表';

INSERT INTO `jml_natural_gas_device`
  (`id`, `device_code`, `device_name`, `factory_code`, `factory_name`, `sort_no`)
VALUES
  ('ng_device_kml_01', 'NG-KML-01', '天然气表1_KML', 'KML', '科米龙', 1),
  ('ng_device_jp_01',  'NG-JP-01',  '天然气表1_JP',  'JP',  '金鹏',   2)
ON DUPLICATE KEY UPDATE
  `device_name` = VALUES(`device_name`),
  `factory_code` = VALUES(`factory_code`),
  `factory_name` = VALUES(`factory_name`),
  `sort_no` = VALUES(`sort_no`);
