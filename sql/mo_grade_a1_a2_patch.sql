ALTER TABLE `mo_execution_yx`
  ADD COLUMN `qty_a1` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT 'A1级数量' AFTER `qty_a`,
  ADD COLUMN `qty_a2` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT 'A2级数量' AFTER `qty_a1`;

ALTER TABLE `mo_handover_yx`
  ADD COLUMN `qty_out_a` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '交出A级数量' AFTER `qty_out`,
  ADD COLUMN `qty_out_a1` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '交出A1级数量' AFTER `qty_out_a`,
  ADD COLUMN `qty_out_a2` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '交出A2级数量' AFTER `qty_out_a1`,
  ADD COLUMN `qty_in_a` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '接收A级数量' AFTER `qty_in`,
  ADD COLUMN `qty_in_a1` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '接收A1级数量' AFTER `qty_in_a`,
  ADD COLUMN `qty_in_a2` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '接收A2级数量' AFTER `qty_in_a1`;

UPDATE `mo_handover_yx`
SET `qty_out_a` = `qty_out`
WHERE `qty_out_a` = 0 AND `qty_out` > 0;

UPDATE `mo_handover_yx`
SET `qty_in_a` = `qty_in`
WHERE `qty_in_a` = 0 AND `qty_in` > 0;

ALTER TABLE `mo_receive_work_yx`
  ADD COLUMN `qty_input_a` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '接收投入A级数量' AFTER `qty_input`,
  ADD COLUMN `qty_input_a1` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '接收投入A1级数量' AFTER `qty_input_a`,
  ADD COLUMN `qty_input_a2` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '接收投入A2级数量' AFTER `qty_input_a1`,
  ADD COLUMN `qty_a1` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '接收完工A1级数量' AFTER `qty_a`,
  ADD COLUMN `qty_a2` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '接收完工A2级数量' AFTER `qty_a1`;

UPDATE `mo_receive_work_yx`
SET `qty_input_a` = `qty_input`
WHERE `qty_input_a` = 0 AND `qty_input` > 0;

ALTER TABLE `mo_rework_yx`
  ADD COLUMN `qty_a1` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '返工后A1级数量' AFTER `qty_a`,
  ADD COLUMN `qty_a2` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '返工后A2级数量' AFTER `qty_a1`;
