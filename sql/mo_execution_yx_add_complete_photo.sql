ALTER TABLE `mo_execution_yx`
  ADD COLUMN `complete_photo_url` VARCHAR(1000) DEFAULT NULL COMMENT '完工产品照片' AFTER `start_photo_url`;

