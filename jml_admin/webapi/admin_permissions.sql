-- Run with init_admin_permissions.py; does not change ERP or miniapp tables.
CREATE TABLE IF NOT EXISTS mo_admin_role_yx (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    permissions JSON NOT NULL,
    is_active TINYINT NOT NULL DEFAULT 1,
    is_system TINYINT NOT NULL DEFAULT 0,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS mo_admin_account_yx (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    identity_key CHAR(64) NOT NULL UNIQUE,
    auth_source VARCHAR(16) NOT NULL,
    local_user_id BIGINT NULL UNIQUE,
    issuer VARCHAR(500) NOT NULL DEFAULT '',
    subject VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL DEFAULT '',
    is_active TINYINT NOT NULL DEFAULT 1,
    session_version INT NOT NULL DEFAULT 0,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS mo_admin_account_role_yx (
    account_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (account_id,role_id),
    FOREIGN KEY (account_id) REFERENCES mo_admin_account_yx(id),
    FOREIGN KEY (role_id) REFERENCES mo_admin_role_yx(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS mo_config_approval_yx (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    request_no VARCHAR(32) NULL UNIQUE,
    module_type VARCHAR(32) NOT NULL,
    action_type VARCHAR(32) NOT NULL,
    target_key VARCHAR(160) NOT NULL,
    pending_key VARCHAR(200) NULL UNIQUE,
    before_data JSON NULL,
    after_data JSON NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    revision INT NOT NULL DEFAULT 1,
    applicant_seen TINYINT NOT NULL DEFAULT 0,
    applicant_account_id BIGINT NOT NULL,
    applicant_name VARCHAR(255) NOT NULL,
    reviewer_account_id BIGINT NULL,
    reviewer_name VARCHAR(255) NULL,
    review_comment VARCHAR(500) NOT NULL DEFAULT '',
    apply_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    review_time DATETIME NULL,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_config_approval_status (status, module_type, apply_time),
    INDEX idx_config_approval_applicant (applicant_account_id, apply_time),
    FOREIGN KEY (applicant_account_id) REFERENCES mo_admin_account_yx(id),
    FOREIGN KEY (reviewer_account_id) REFERENCES mo_admin_account_yx(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS mo_admin_page_setting_yx (
    page_key VARCHAR(64) NOT NULL PRIMARY KEY,
    is_enabled TINYINT NOT NULL DEFAULT 1,
    revision INT NOT NULL DEFAULT 0,
    updated_by VARCHAR(100) NULL,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (is_enabled IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
