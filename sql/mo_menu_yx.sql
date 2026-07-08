-- 现场管理子菜单表 (DB2: wecom-db)
-- 说明：is_active 控制菜单是否显示，sort 控制排列顺序

CREATE TABLE `mo_menu_yx` (
  `id`          int           NOT NULL AUTO_INCREMENT,
  `menu_name`   varchar(50)   NOT NULL COMMENT '菜单名称',
  `menu_key`    varchar(50)   NOT NULL COMMENT '菜单唯一标识',
  `path`        varchar(200)  NOT NULL COMMENT '小程序页面路径',
  `emoji`       varchar(200)  DEFAULT NULL COMMENT '图标URL',
  `description` varchar(200)  DEFAULT NULL COMMENT '功能描述',
  `sort`        int           NOT NULL DEFAULT 0 COMMENT '排序权重，越小越靠前',
  `is_active`   tinyint       NOT NULL DEFAULT 1 COMMENT '是否启用：1启用 0禁用',
  `create_time` datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_menu_key` (`menu_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='现场管理子菜单表';

-- 初始菜单数据
INSERT INTO `mo_menu_yx` (`menu_name`, `menu_key`, `path`, `emoji`, `description`, `sort`, `is_active`) VALUES
('工序管理', 'process_mgmt', '/Mo/ProcessMgmt/Index', 'https://wxapp-crm.chameleon-artec.com/jml/assets/toolss.png', '现场生产工序流程管理', 1, 1);

-- 若表已存在，执行以下语句扩展 emoji 字段长度
-- ALTER TABLE `mo_menu_yx` MODIFY COLUMN `emoji` varchar(200) DEFAULT NULL COMMENT '图标URL';
-- UPDATE `mo_menu_yx` SET emoji = 'https://wxapp-crm.chameleon-artec.com/jml/assets/toolss.png' WHERE menu_key = 'process_mgmt';
