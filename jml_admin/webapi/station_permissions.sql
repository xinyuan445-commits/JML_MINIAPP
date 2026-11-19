CREATE TABLE IF NOT EXISTS mo_station_staff_config_yx (
    station_id INT NOT NULL PRIMARY KEY,
    leader_staff_id VARCHAR(64) NULL,
    scanner_staff_ids JSON NOT NULL,
    revision INT NOT NULL DEFAULT 1,
    updated_by VARCHAR(100) NOT NULL,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
