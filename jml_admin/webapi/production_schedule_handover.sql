CREATE TABLE IF NOT EXISTS mo_schedule_handover_yx (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    route_id BIGINT NOT NULL DEFAULT 0,
    from_process_id BIGINT NOT NULL,
    to_process_id BIGINT NOT NULL,
    minutes INT NOT NULL,
    is_active TINYINT NOT NULL DEFAULT 1,
    revision INT NOT NULL DEFAULT 1,
    updated_by VARCHAR(255) NOT NULL,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_schedule_handover (route_id,from_process_id,to_process_id),
    CHECK (minutes >= 0),
    CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
