CREATE TABLE IF NOT EXISTS mo_quantity_rule_setting_yx (
  id TINYINT NOT NULL PRIMARY KEY,
  completion_not_exceed_received TINYINT(1) NOT NULL DEFAULT 0,
  receive_not_exceed_previous_completed TINYINT(1) NOT NULL DEFAULT 0,
  completion_not_exceed_previous_completed TINYINT(1) NOT NULL DEFAULT 0,
  revision INT NOT NULL DEFAULT 1,
  updated_by VARCHAR(100) NULL,
  update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO mo_quantity_rule_setting_yx (id) VALUES (1);
