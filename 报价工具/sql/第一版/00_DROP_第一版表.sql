-- ============================================================
-- 报价工具 - 第一版表 DROP 脚本
-- 数据库: MySQL (db2)
-- 说明: 删除第一版全部 bj_*_yx 表，为重建新模型清场。
--       表之间为代码关联(无真实外键)，仍关闭外键检查以防万一。
--       执行前请确认这些表已不再需要！
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `bj_process_yx`;             -- 工序主表
DROP TABLE IF EXISTS `bj_product_category_yx`;    -- 产品类别表
DROP TABLE IF EXISTS `bj_cost_type_yx`;           -- 成本类别字典表
DROP TABLE IF EXISTS `bj_process_cost_map_yx`;    -- 工序成本归属对照表
DROP TABLE IF EXISTS `bj_management_dept_yx`;     -- 管理成本部门表

DROP TABLE IF EXISTS `bj_labor_cost_yx`;          -- A 人工成本表
DROP TABLE IF EXISTS `bj_material_cost_yx`;       -- B 材料成本表
DROP TABLE IF EXISTS `bj_energy_cost_yx`;         -- C 能耗成本表
DROP TABLE IF EXISTS `bj_consumable_cost_yx`;     -- D 耗材成本表
DROP TABLE IF EXISTS `bj_repair_cost_yx`;         -- E 维修成本表
DROP TABLE IF EXISTS `bj_depreciation_cost_yx`;   -- G 折旧成本表
DROP TABLE IF EXISTS `bj_common_cost_yx`;         -- 公共成本表

DROP TABLE IF EXISTS `bj_route_step_yx`;          -- 工艺路线-步骤表
DROP TABLE IF EXISTS `bj_route_yx`;               -- 工艺路线表

DROP TABLE IF EXISTS `bj_quote_yx`;               -- 报价记录表

SET FOREIGN_KEY_CHECKS = 1;
