ALTER TABLE `mo_handover_yx`
  ADD COLUMN `receive_photo_url` VARCHAR(1000) DEFAULT NULL COMMENT '领用材料照片' AFTER `receipt_reason`;

