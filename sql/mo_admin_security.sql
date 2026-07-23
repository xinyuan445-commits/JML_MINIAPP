-- 管理后台账号与操作审计（DB2: wecom-db）

CREATE TABLE IF NOT EXISTS mo_admin_user_yx (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(64) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL DEFAULT '',
    role VARCHAR(32) NOT NULL DEFAULT 'viewer',
    is_active TINYINT NOT NULL DEFAULT 1,
    last_login_time DATETIME NULL,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_mo_admin_user_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理后台账号';

CREATE TABLE IF NOT EXISTS mo_admin_audit_log_yx (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(64) NOT NULL,
    action_name VARCHAR(100) NOT NULL,
    request_method VARCHAR(10) NOT NULL,
    request_path VARCHAR(255) NOT NULL,
    target_id VARCHAR(100) NULL,
    request_data TEXT NULL,
    result_code INT NOT NULL DEFAULT 0,
    result_message VARCHAR(500) NULL,
    ip_address VARCHAR(64) NULL,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_mo_admin_audit_time (create_time),
    KEY idx_mo_admin_audit_user (username, create_time),
    KEY idx_mo_admin_audit_path (request_path, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理后台操作审计日志';
