-- 产品类别与生产工艺路线的映射。
-- 产品类别来自 bj_product_cost_yx；生产路线来自 mo_route_yx。
CREATE TABLE IF NOT EXISTS `mo_product_route_yx` (
  `product_code` VARCHAR(8) NOT NULL COMMENT '产品类别编码',
  `route_id` INT NOT NULL COMMENT '生产工艺路线ID',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`product_code`),
  KEY `idx_route_id` (`route_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品类别与生产工艺路线映射';

