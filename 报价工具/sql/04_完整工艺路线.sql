-- 报价工具 v2 - 产品完整工艺路线（展示用，不参与成本计算）
ALTER TABLE `bj_product_cost_yx`
  ADD COLUMN `route_desc` VARCHAR(500) DEFAULT NULL COMMENT '完整工艺路线（展示用）' AFTER `name`;

UPDATE `bj_product_cost_yx` SET `route_desc` = CASE `code`
  WHEN '01' THEN '三胺压贴 → 倒角 → 打托入库'
  WHEN '02' THEN '泰兴工厂压贴 → 倒角 → 打托入库'
  WHEN '03' THEN '外购'
  WHEN '04' THEN '三胺压贴 → 倒角 → 修补 → 肤感烤漆（含覆膜） → 打托入库'
  WHEN '05' THEN '三胺压贴 → 倒角 → 修补 → 倒角 → 修补 → 肤感烤漆（含覆膜） → 肤感烤漆（含覆膜） → 打托入库'
  WHEN '06' THEN '泰兴工厂压贴 → 倒角 → 修补 → 肤感烤漆（含覆膜） → 打托入库'
  WHEN '07' THEN 'HPL三胺基材粘贴垫板 → 肤感烤漆（含覆膜） → 裁切修边 → 打托入库'
  WHEN '08' THEN '木皮压贴（水胶） → 倒角 → 修补 → 打托入库'
  WHEN '09' THEN '木皮压贴（PUR） → 倒角 → 修补 → 打托入库'
  WHEN '10' THEN 'HPL三胺基材粘贴垫板 → 木皮压贴（水胶） → 裁切修边 → 打托入库'
  WHEN '11' THEN '拼皮 → 拼皮 → 木皮压贴（水胶） → 拉丝 → 修补 → 拉丝 → 修补 → 打托入库'
  WHEN '12' THEN '拼皮 → 木皮压贴（水胶） → 拉丝 → 修补 → 水性 → 修色 → 木皮打印（含覆膜） → 打托入库'
  WHEN '13' THEN '拼皮 → 拼皮 → 木皮压贴（水胶） → 拉丝 → 修补 → 拉丝 → 修补 → 水性 → 修色 → 木皮打印 → 水性 → 修色 → 木皮打印（含覆膜） → 打托入库'
  WHEN '14' THEN '拼皮 → 木皮压贴（PUR） → 拉丝 → 修补 → 水性 → 修色 → 木皮打印（含覆膜） → 打托入库'
  WHEN '15' THEN '拼皮 → HPL素板粘贴垫板 → 木皮压贴（PUR） → 拉丝 → 修补 → 水性 → 修色 → 木皮打印（含覆膜） → 防火板脱胶 → 防火板砂光 → 裁切修边 → 手工覆膜 → 打托入库'
  WHEN '16' THEN '拼皮 → 木皮压贴（水胶） → 拉丝 → 修补 → 水性 → 修色 → 木皮打印（含覆膜） → 倒角 → 打托入库'
  WHEN '17' THEN '三胺压贴 → 倒角 → 修补 → 木皮打印（含覆膜） → 打托入库'
  WHEN '18' THEN '泰兴工厂压贴 → 倒角 → 修补 → 木皮打印（含覆膜） → 打托入库'
  WHEN '19' THEN 'HPL三胺基材粘贴垫板 → 木皮打印（含覆膜） → 裁切修边 → 打托入库'
  WHEN '20' THEN '外购 → 水性 → 修色 → 面漆 → 打包入库'
  WHEN '21' THEN '成品 → 裁切 → 封边 → 打包入库'
  WHEN '22' THEN '倒角 → 肤感烤漆（含覆膜） → 打托入库'
  WHEN '23' THEN '倒角 → 拉丝 → 修补 → 水性 → 修色 → 木皮打印（含覆膜） → 打托入库'
  WHEN '24' THEN '成品 → 开槽 → 打包入库'
  ELSE `route_desc`
END;

SELECT `code`, `name`, `route_desc`
FROM `bj_product_cost_yx`
ORDER BY `code`;
