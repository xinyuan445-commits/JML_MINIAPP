ALTER TABLE `mo_receive_work_yx`
  ADD COLUMN `complete_photo_url` VARCHAR(1000) DEFAULT NULL COMMENT '接收完工照片' AFTER `photo_url`;

