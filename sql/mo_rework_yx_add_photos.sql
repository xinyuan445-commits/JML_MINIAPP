ALTER TABLE `mo_rework_yx`
  ADD COLUMN `photo_url` VARCHAR(1000) DEFAULT NULL COMMENT '返工开工照片' AFTER `reason`,
  ADD COLUMN `complete_photo_url` VARCHAR(1000) DEFAULT NULL COMMENT '返工完工照片' AFTER `complete_remark`;
