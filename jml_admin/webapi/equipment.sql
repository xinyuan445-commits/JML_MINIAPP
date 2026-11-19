-- Explicit migration only.
-- Existing jml_device, workstations, repair records and permissions are not modified.
CREATE TABLE IF NOT EXISTS mo_equipment_device_yx (
    device_id VARCHAR(64) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
    device_code VARCHAR(64) NOT NULL UNIQUE,
    device_name VARCHAR(100) NOT NULL,
    device_enabled TINYINT NOT NULL DEFAULT 1,
    device_type VARCHAR(100) NOT NULL,
    workshop VARCHAR(100) NOT NULL DEFAULT '',
    location VARCHAR(255) NOT NULL DEFAULT '',
    brand VARCHAR(100) NULL,
    model VARCHAR(100) NULL,
    serial_no VARCHAR(100) NULL,
    commissioned_on DATE NULL,
    photo MEDIUMTEXT NULL,
    remark VARCHAR(1000) NOT NULL DEFAULT '',
    revision INT NOT NULL DEFAULT 1,
    updated_by VARCHAR(255) NOT NULL,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mo_equipment_yx (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    station_id BIGINT NOT NULL UNIQUE,
    device_id VARCHAR(64) COLLATE utf8mb4_bin NOT NULL UNIQUE,
    revision INT NOT NULL DEFAULT 1,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mo_equipment_capacity_yx (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
    process_id BIGINT NOT NULL,
    category_code VARCHAR(64) NOT NULL DEFAULT '',
    specification VARCHAR(255) NOT NULL DEFAULT '',
    capacity_mode VARCHAR(16) NOT NULL,
    quantity DECIMAL(20,8) NULL,
    unit VARCHAR(30) NOT NULL DEFAULT '',
    period VARCHAR(16) NULL,
    effective_hours DECIMAL(10,6) NULL,
    staffing INT NULL,
    setup_minutes DECIMAL(14,6) NULL,
    basis VARCHAR(16) NOT NULL,
    measured_on DATE NULL,
    remark VARCHAR(1000) NOT NULL DEFAULT '',
    is_active TINYINT NOT NULL DEFAULT 1,
    revision INT NOT NULL DEFAULT 1,
    active_slot TINYINT GENERATED ALWAYS AS (CASE WHEN is_active=1 THEN 1 ELSE NULL END) STORED,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_equipment_capacity_active (device_id,process_id,category_code,active_slot),
    CHECK (capacity_mode IN ('finite','unlimited')),
    CHECK (is_active IN (0,1)),
    CHECK ((capacity_mode='unlimited' AND quantity IS NULL AND period IS NULL AND effective_hours IS NULL)
      OR (capacity_mode='finite' AND quantity IS NOT NULL AND quantity>0 AND unit<>'' AND period IS NOT NULL AND
        ((period IN ('minute','hour') AND effective_hours IS NULL) OR
         (period IN ('day','shift') AND effective_hours IS NOT NULL AND effective_hours>0 AND effective_hours<=24))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mo_equipment_history_yx (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    module_type VARCHAR(32) NOT NULL,
    target_id BIGINT NOT NULL,
    device_id VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
    before_data JSON NULL,
    after_data JSON NOT NULL,
    approved_by VARCHAR(255) NOT NULL,
    effective_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_equipment_history (module_type,target_id,id),
    INDEX idx_equipment_history_device (device_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
