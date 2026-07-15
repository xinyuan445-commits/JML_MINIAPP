ALTER TABLE `mo_receive_work_yx`
  ADD COLUMN `photo_url` VARCHAR(1000) DEFAULT NULL COMMENT '领用材料照片' AFTER `reason`;
