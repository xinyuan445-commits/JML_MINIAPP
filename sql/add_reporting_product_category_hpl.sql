-- 报工产品类别：实木单贴半成品（HPL）
-- 后台后续新增类别会自动生成下一编号；本脚本可重复执行。
INSERT INTO bj_product_cost_yx
    (code,name,unit,mgmt_rate,mgmt_method,is_enabled,remark)
SELECT '25','实木单贴半成品（HPL）',NULL,0,NULL,1,'报工产品类别'
WHERE NOT EXISTS (
    SELECT 1 FROM bj_product_cost_yx WHERE name='实木单贴半成品（HPL）'
);
