-- ============================================================
-- 示例数据：压贴线（木皮）工艺路线
-- 部门编码：04137
-- 工序：压贴 → 倒角 → 修补
-- 工站：压机、倒角机、修补区
-- ============================================================

-- 1. 工序
INSERT INTO `mo_process_yx` (`process_code`, `process_name`, `sort`) VALUES
('YT-01', '压贴', 1),
('DJ-01', '倒角', 2),
('XB-01', '修补', 3);

-- 2. 工站
INSERT INTO `mo_workstation_yx` (`station_code`, `station_name`) VALUES
('WS-YJ',  '压机'),
('WS-DJJ', '倒角机'),
('WS-XBQ', '修补区');

-- 3. 工艺路线
INSERT INTO `mo_route_yx` (`route_code`, `route_name`, `dept_code`, `dept_name`, `is_default`) VALUES
('RT-04137-001', '压贴线（木皮）', '04137', '压贴线', 1);

-- 4. 路线步骤（压贴→倒角→修补）
INSERT INTO `mo_route_step_yx` (`route_id`, `seq`, `process_id`)
SELECT r.id, 1, p.id FROM mo_route_yx r, mo_process_yx p
WHERE r.route_code = 'RT-04137-001' AND p.process_code = 'YT-01';

INSERT INTO `mo_route_step_yx` (`route_id`, `seq`, `process_id`)
SELECT r.id, 2, p.id FROM mo_route_yx r, mo_process_yx p
WHERE r.route_code = 'RT-04137-001' AND p.process_code = 'DJ-01';

INSERT INTO `mo_route_step_yx` (`route_id`, `seq`, `process_id`)
SELECT r.id, 3, p.id FROM mo_route_yx r, mo_process_yx p
WHERE r.route_code = 'RT-04137-001' AND p.process_code = 'XB-01';

-- 5. 步骤允许工站
-- 步骤1（压贴）→ 压机
INSERT INTO `mo_step_station_yx` (`step_id`, `station_id`)
SELECT rs.id, ws.id
FROM mo_route_step_yx rs
JOIN mo_route_yx r ON r.id = rs.route_id
JOIN mo_workstation_yx ws ON ws.station_code = 'WS-YJ'
WHERE r.route_code = 'RT-04137-001' AND rs.seq = 1;

-- 步骤2（倒角）→ 倒角机
INSERT INTO `mo_step_station_yx` (`step_id`, `station_id`)
SELECT rs.id, ws.id
FROM mo_route_step_yx rs
JOIN mo_route_yx r ON r.id = rs.route_id
JOIN mo_workstation_yx ws ON ws.station_code = 'WS-DJJ'
WHERE r.route_code = 'RT-04137-001' AND rs.seq = 2;

-- 步骤3（修补）→ 修补区
INSERT INTO `mo_step_station_yx` (`step_id`, `station_id`)
SELECT rs.id, ws.id
FROM mo_route_step_yx rs
JOIN mo_route_yx r ON r.id = rs.route_id
JOIN mo_workstation_yx ws ON ws.station_code = 'WS-XBQ'
WHERE r.route_code = 'RT-04137-001' AND rs.seq = 3;
