-- mo_v2_patch2.sql — 完工 / 接收 / 补工功能字段
-- 在已执行 mo_v2.sql 的库上执行

ALTER TABLE mo_execution_yx
  ADD COLUMN complete_reason VARCHAR(200) DEFAULT NULL COMMENT '完工数量不足原因' AFTER qty_done;

ALTER TABLE mo_handover_yx
  ADD COLUMN receipt_reason VARCHAR(200) DEFAULT NULL COMMENT '接收数量不足原因' AFTER qty_in,
  ADD UNIQUE KEY uk_handover_step (mo_code, sort_seq, from_seq, to_seq);
