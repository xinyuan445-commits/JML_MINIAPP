-- ============================================================
-- 报价工具 - 报价记录表（快照）
-- 数据库: MySQL (utf8mb4)
-- 说明: 报价是历史凭证。各项成本(A~G)、三个率、最终价均为「当时算出的快照」，
--       因为 B 材料(U8实时BOM×最近入库价) 与 A/C(字典表) 都会随时间变化，
--       回看时不可重算。故全部冻结存库。
--       率字段存比率(与 bj_product_category_yx 一致)，如 91.80% -> 0.9180
-- 表前缀 bj_ = 报价
-- ============================================================

CREATE TABLE IF NOT EXISTS `bj_quote_yx` (
  `id`                INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '内部主键',
  `quote_no`          VARCHAR(32)   NOT NULL                COMMENT '报价单号',

  -- 基本信息（手填/选择）
  `customer`          VARCHAR(100)           DEFAULT NULL   COMMENT '客户',
  `staff`             VARCHAR(50)            DEFAULT NULL   COMMENT '报价员工',
  `category_code`     VARCHAR(8)    NOT NULL                COMMENT '产品类别编码',
  `category_name`     VARCHAR(50)            DEFAULT NULL   COMMENT '产品类别名称(快照)',
  `inv_code`          VARCHAR(60)            DEFAULT NULL   COMMENT '存货编码(母件)',

  -- 工艺路线（快照）
  `route_code`        VARCHAR(20)            DEFAULT NULL   COMMENT '工艺路线编码(快照)',
  `route_name`        VARCHAR(100)           DEFAULT NULL   COMMENT '工艺路线名称(快照)',

  -- 各成本类别金额（快照，F管理不计；B=材料实时查得）
  `cost_a`            DECIMAL(12,4) NOT NULL DEFAULT 0      COMMENT 'A 直接人工',
  `cost_b`            DECIMAL(12,4) NOT NULL DEFAULT 0      COMMENT 'B BOM材料',
  `cost_c`            DECIMAL(12,4) NOT NULL DEFAULT 0      COMMENT 'C 能耗',
  `cost_d`            DECIMAL(12,4) NOT NULL DEFAULT 0      COMMENT 'D 一次性耗材',
  `cost_e`            DECIMAL(12,4) NOT NULL DEFAULT 0      COMMENT 'E 维修',
  `cost_g`            DECIMAL(12,4) NOT NULL DEFAULT 0      COMMENT 'G 设备折旧',
  `direct_total`      DECIMAL(12,4) NOT NULL DEFAULT 0      COMMENT '直接成本合计',

  -- 各成本类别构成明细快照（JSON，按类别分组；合计仍走上面的 cost_* 列）
  --   B 组为子件明细：{sub_code,qty,scrap,unit_cost,amount,missing}
  --   其余组为工序/公共行：{name,amount}
  --   形如 {"A":[{"name":"裁切","amount":3.2}],
  --         "B":[{"sub_code":"X","qty":1.5,"scrap":5,"unit_cost":3,"amount":4.5,"missing":false}],
  --         "C":[...]}
  `cost_detail`       JSON                   DEFAULT NULL   COMMENT '各成本类别构成明细快照(JSON)',

  -- 三个率（快照，存比率；为空表示该步未参与计算）
  `first_pass_rate`   DECIMAL(6,4)           DEFAULT NULL   COMMENT '一次合格率(快照)',
  `gross_margin_rate` DECIMAL(6,4)           DEFAULT NULL   COMMENT '毛利率/成本加成(快照)',
  `tax_rate`          DECIMAL(6,4)           DEFAULT NULL   COMMENT '税率(快照)',

  -- 价格结果（快照，2位小数业务值）
  `cost_after_yield`  DECIMAL(12,4) NOT NULL DEFAULT 0      COMMENT '含合格率成本',
  `price_before_tax`  DECIMAL(12,4) NOT NULL DEFAULT 0      COMMENT '不含税售价',
  `price_with_tax`    DECIMAL(12,4) NOT NULL DEFAULT 0      COMMENT '含税报价参考价(最终)',

  `remark`            VARCHAR(255)           DEFAULT NULL   COMMENT '备注',
  `created_by`        VARCHAR(50)            DEFAULT NULL   COMMENT '创建人(登录用户ID)',
  `created_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP                       COMMENT '创建时间',
  `updated_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_quote_no` (`quote_no`),
  KEY `idx_customer` (`customer`),
  KEY `idx_inv_code` (`inv_code`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价-报价记录表(快照)';

-- 表已创建，补加创建人列执行这条：
-- ALTER TABLE `bj_quote_yx`
--   ADD COLUMN `created_by` VARCHAR(50) DEFAULT NULL COMMENT '创建人(登录用户ID)' AFTER `remark`;
