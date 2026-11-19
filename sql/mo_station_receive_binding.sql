-- New trial path only. No changes to historical handovers or executions.
CREATE TABLE IF NOT EXISTS mo_station_receive_binding_yx (
    handover_id BIGINT NOT NULL PRIMARY KEY,
    station_id INT NOT NULL,
    staff_id VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
