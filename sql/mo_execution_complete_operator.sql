ALTER TABLE `mo_execution_yx`
  ADD COLUMN `complete_operator_id` VARCHAR(50) DEFAULT NULL COMMENT '完工操作人ID'
    AFTER `operator_name`,
  ADD COLUMN `complete_operator_name` VARCHAR(100) DEFAULT NULL COMMENT '完工操作人姓名'
    AFTER `complete_operator_id`;

UPDATE `mo_execution_yx` execution
JOIN `mo_handover_yx` handover
  ON handover.mo_code=execution.mo_code
 AND handover.sort_seq=execution.sort_seq
 AND handover.route_id=execution.route_id
 AND handover.from_seq=execution.seq
SET execution.complete_operator_name=handover.operator_out
WHERE execution.complete_operator_name IS NULL
  AND handover.operator_out IS NOT NULL
  AND handover.operator_out!='';
