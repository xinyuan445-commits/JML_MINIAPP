CREATE TABLE IF NOT EXISTS mo_station_staff_proxy_yx (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    station_id INT NOT NULL,
    staff_id VARCHAR(64) NOT NULL,
    starts_at DATETIME NOT NULL COMMENT 'UTC, inclusive',
    ends_at DATETIME NOT NULL COMMENT 'UTC, exclusive',
    updated_by VARCHAR(100) NOT NULL,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_station_proxy_staff (station_id,staff_id),
    KEY ix_station_proxy_expiry (ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
