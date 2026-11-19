-- 完工质量报告单照片：执行前确认当前数据库尚未包含同名字段。
ALTER TABLE `mo_execution_completion_yx`
  ADD COLUMN `quality_report_photo_urls` TEXT DEFAULT NULL
  COMMENT '质量报告单照片JSON数组，最多2张' AFTER `photo_url`;

ALTER TABLE `mo_rework_completion_yx`
  ADD COLUMN `quality_report_photo_urls` TEXT DEFAULT NULL
  COMMENT '质量报告单照片JSON数组，最多2张' AFTER `photo_url`;
