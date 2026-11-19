-- Explicit production calendar and dispatch policy migration.
-- Schedule previews are calculated at request time and are never persisted.
CREATE TABLE IF NOT EXISTS mo_work_calendar_yx (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    calendar_code VARCHAR(64) NOT NULL UNIQUE,
    calendar_name VARCHAR(100) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    is_default TINYINT NOT NULL DEFAULT 0,
    is_active TINYINT NOT NULL DEFAULT 1,
    revision INT NOT NULL DEFAULT 1,
    updated_by VARCHAR(255) NOT NULL,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (is_default IN (0,1)),
    CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mo_work_calendar_period_yx (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    calendar_id BIGINT NOT NULL,
    period_name VARCHAR(100) NOT NULL,
    start_month_day CHAR(5) NOT NULL,
    end_month_day CHAR(5) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_work_calendar_period (calendar_id,period_name),
    INDEX idx_work_calendar_period_calendar (calendar_id,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mo_work_calendar_week_yx (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    period_id BIGINT NOT NULL,
    weekday TINYINT NOT NULL,
    intervals_json JSON NOT NULL,
    UNIQUE KEY uq_work_calendar_week (period_id,weekday),
    CHECK (weekday BETWEEN 1 AND 7)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mo_work_calendar_exception_yx (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    calendar_id BIGINT NOT NULL,
    work_date DATE NOT NULL,
    exception_type VARCHAR(16) NOT NULL,
    intervals_json JSON NOT NULL,
    reason VARCHAR(255) NOT NULL DEFAULT '',
    source VARCHAR(64) NOT NULL DEFAULT 'manual',
    revision INT NOT NULL DEFAULT 1,
    updated_by VARCHAR(255) NOT NULL,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_work_calendar_exception (calendar_id,work_date),
    INDEX idx_work_calendar_exception_date (work_date),
    CHECK (exception_type IN ('work','rest'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mo_schedule_policy_yx (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    policy_code VARCHAR(64) NOT NULL UNIQUE,
    policy_name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    is_default TINYINT NOT NULL DEFAULT 0,
    is_active TINYINT NOT NULL DEFAULT 1,
    revision INT NOT NULL DEFAULT 1,
    updated_by VARCHAR(255) NOT NULL,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (is_default IN (0,1)),
    CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mo_schedule_policy_rule_yx (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    policy_id BIGINT NOT NULL,
    priority INT NOT NULL,
    rule_code VARCHAR(64) NOT NULL,
    is_enabled TINYINT NOT NULL DEFAULT 1,
    UNIQUE KEY uq_schedule_policy_rule (policy_id,rule_code),
    INDEX idx_schedule_policy_rule_priority (policy_id,priority),
    CHECK (is_enabled IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
