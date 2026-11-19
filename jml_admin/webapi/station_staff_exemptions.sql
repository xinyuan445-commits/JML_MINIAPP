CREATE TABLE IF NOT EXISTS mo_station_staff_exemption_yx (
    id TINYINT NOT NULL PRIMARY KEY,
    staff_ids JSON NOT NULL,
    revision INT NOT NULL DEFAULT 1,
    updated_by VARCHAR(100) NOT NULL,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_station_staff_exemption_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
