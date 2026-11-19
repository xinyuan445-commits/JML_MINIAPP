CREATE TABLE IF NOT EXISTS mo_daily_task_yx (
 id BIGINT PRIMARY KEY AUTO_INCREMENT,
 work_date DATE NOT NULL,
 dept_name VARCHAR(100) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'draft',
 revision INT NOT NULL DEFAULT 1,
 created_by VARCHAR(100) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 published_by VARCHAR(100) NULL,
 published_at DATETIME NULL,
 UNIQUE KEY uk_daily_department (work_date,dept_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mo_daily_task_item_yx (
 id BIGINT PRIMARY KEY AUTO_INCREMENT,
 task_id BIGINT NOT NULL,
 mo_code VARCHAR(100) NOT NULL,
 sort_seq INT NOT NULL,
 route_id BIGINT NOT NULL,
 seq INT NOT NULL,
 station_id BIGINT NOT NULL,
 kind VARCHAR(12) NOT NULL DEFAULT 'normal',
 quantity DECIMAL(18,4) NOT NULL,
 transferred_qty DECIMAL(18,4) NOT NULL DEFAULT 0,
 sort_order INT NOT NULL DEFAULT 0,
 remark VARCHAR(500) NOT NULL DEFAULT '',
 status VARCHAR(20) NOT NULL DEFAULT 'active',
 snapshot JSON NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uk_daily_item (task_id,mo_code,sort_seq,route_id,seq,station_id,kind),
 KEY idx_daily_workorder (mo_code,sort_seq,route_id,seq,kind),
 CONSTRAINT fk_daily_item_header FOREIGN KEY (task_id) REFERENCES mo_daily_task_yx(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mo_daily_task_change_yx (
 id BIGINT PRIMARY KEY AUTO_INCREMENT,
 task_id BIGINT NOT NULL,
 item_id BIGINT NULL,
 related_item_id BIGINT NULL,
 action VARCHAR(30) NOT NULL,
 before_data JSON NULL,
 after_data JSON NULL,
 actor VARCHAR(100) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_daily_change_task (task_id,id),
 CONSTRAINT fk_daily_change_header FOREIGN KEY (task_id) REFERENCES mo_daily_task_yx(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
