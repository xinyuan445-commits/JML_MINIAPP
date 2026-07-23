-- 报工工艺路线版本管理（不影响报价模块）

ALTER TABLE mo_route_yx
    ADD COLUMN version_group VARCHAR(50) NULL COMMENT '版本组，初始使用首版路线编码' AFTER route_code,
    ADD COLUMN version_no INT NOT NULL DEFAULT 1 COMMENT '版本号' AFTER version_group,
    ADD COLUMN parent_route_id INT NULL COMMENT '来源路线ID' AFTER version_no,
    ADD COLUMN is_current TINYINT NOT NULL DEFAULT 1 COMMENT '是否当前版本' AFTER is_default,
    ADD COLUMN version_note VARCHAR(200) NULL COMMENT '版本说明' AFTER description;

UPDATE mo_route_yx
SET version_group = route_code,
    version_no = CASE
        WHEN route_name REGEXP 'V[0-9]+$'
            THEN CAST(SUBSTRING(route_name, CHAR_LENGTH(route_name) - LOCATE('V', REVERSE(route_name)) + 2) AS UNSIGNED)
        ELSE 1
    END,
    is_current = 1
WHERE version_group IS NULL OR version_group = '';

-- 已有的“报工路线V2”归入对应生产路线的历史版本组。
UPDATE mo_route_yx v2
JOIN mo_route_yx v1
  ON v1.route_code = REPLACE(v2.route_code, '-MO-V2', '')
SET v2.version_group = v1.route_code,
    v2.version_no = 2,
    v2.is_current = 1,
    v1.is_current = 0
WHERE v2.route_code LIKE '%-MO-V2';

ALTER TABLE mo_route_yx
    MODIFY COLUMN version_group VARCHAR(50) NOT NULL COMMENT '版本组，初始使用首版路线编码',
    ADD UNIQUE KEY uk_mo_route_version (version_group, version_no),
    ADD KEY idx_mo_route_current (version_group, is_current),
    ADD KEY idx_mo_route_parent (parent_route_id);

CREATE TABLE IF NOT EXISTS mo_route_version_category_yx (
    route_id INT NOT NULL,
    product_code VARCHAR(8) NOT NULL,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (route_id, product_code),
    KEY idx_mo_route_version_category_product (product_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报工路线各版本适用产品快照';

INSERT IGNORE INTO mo_route_version_category_yx (route_id, product_code)
SELECT route_id, product_code FROM mo_product_route_yx;

-- 旧版恢复时沿用同一产品类别，工序步骤仍取旧版自身记录。
INSERT IGNORE INTO mo_route_version_category_yx (route_id, product_code)
SELECT v1.id, vc.product_code
FROM mo_route_yx v2
JOIN mo_route_yx v1 ON v1.version_group = v2.version_group AND v1.version_no = 1
JOIN mo_route_version_category_yx vc ON vc.route_id = v2.id
WHERE v2.route_code LIKE '%-MO-V2' AND v2.version_no = 2;
