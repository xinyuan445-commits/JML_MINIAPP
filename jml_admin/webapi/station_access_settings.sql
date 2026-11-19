CREATE TABLE IF NOT EXISTS mo_station_access_setting_yx (
    id TINYINT NOT NULL PRIMARY KEY,
    enabled TINYINT NOT NULL DEFAULT 0,
    report_access_mode ENUM('exempt','station','all') NOT NULL DEFAULT 'exempt',
    revision INT NOT NULL DEFAULT 0,
    updated_by VARCHAR(128) NULL,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (id = 1),
    CHECK (enabled IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO mo_station_access_setting_yx (id,enabled,report_access_mode,revision) VALUES (1,0,'exempt',0);
