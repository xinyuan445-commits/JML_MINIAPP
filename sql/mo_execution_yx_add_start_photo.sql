ALTER TABLE `mo_execution_yx`
  ADD COLUMN `start_photo_url` VARCHAR(1000) DEFAULT NULL COMMENT '开工照片' AFTER `operator_name`;
