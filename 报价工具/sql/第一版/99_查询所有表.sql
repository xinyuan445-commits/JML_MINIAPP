-- ============================================================
-- 报价工具 - 查询所有表
-- 数据库: MySQL (utf8mb4)
-- 说明: 逐张 SELECT，用于核对建表与初始数据
-- ============================================================

-- 工序主表
SELECT * FROM `bj_process_yx`;

-- 产品类别表
SELECT * FROM `bj_product_category_yx`;

-- 成本类别字典表
SELECT * FROM `bj_cost_type_yx`;

-- 工序成本归属对照表
SELECT * FROM `bj_process_cost_map_yx`;

-- F 管理成本部门表
SELECT * FROM `bj_management_dept_yx`;

-- 公共成本表
SELECT * FROM `bj_common_cost_yx`;

-- A 直接人工成本表
SELECT * FROM `bj_labor_cost_yx`;

-- B BOM材料成本表
SELECT * FROM `bj_material_cost_yx`;

-- C 能耗成本表
SELECT * FROM `bj_energy_cost_yx`;

-- D 一次性耗材成本表
SELECT * FROM `bj_consumable_cost_yx`;

-- E 维修成本表
SELECT * FROM `bj_repair_cost_yx`;

-- G 设备折旧成本表
SELECT * FROM `bj_depreciation_cost_yx`;

-- 工艺路线主表
SELECT * FROM `bj_route_yx`;

-- 工艺路线工序明细表
SELECT * FROM `bj_route_step_yx`;
