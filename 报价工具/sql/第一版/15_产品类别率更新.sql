-- ============================================================
-- 报价工具 - 更新产品类别一次合格率
-- 数据库: MySQL (utf8mb4)
-- 说明: first_pass_rate 存比率，如 91.80% -> 0.9180
-- ============================================================

UPDATE `bj_product_category_yx` SET `first_pass_rate` = 0.9180 WHERE `code` = '01';  -- 木质三胺烤漆板 91.80%
UPDATE `bj_product_category_yx` SET `first_pass_rate` = 0.8920 WHERE `code` = '04';  -- 木质木皮烤漆板 89.20%
UPDATE `bj_product_category_yx` SET `first_pass_rate` = 0.8080 WHERE `code` = '05';  -- HPL木皮烤漆板 80.80%

-- 其余未设置的，一次合格率默认 96%
UPDATE `bj_product_category_yx` SET `first_pass_rate` = 0.9600 WHERE `first_pass_rate` IS NULL;

-- ============================================================
-- 统一调整：所有产品类别 合格率=96%、税率=13%
-- （覆盖上面 01/04/05 的单独合格率）
-- ============================================================
UPDATE `bj_product_category_yx` SET `first_pass_rate` = 0.9600, `tax_rate` = 0.1300;
