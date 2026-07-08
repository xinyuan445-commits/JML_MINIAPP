ALTER TABLE `mo_receive_work_yx`
  ADD COLUMN `qty_a` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '接收A级数量' AFTER `qty_input`,
  ADD COLUMN `qty_c` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '接收C级数量' AFTER `qty_a`;
