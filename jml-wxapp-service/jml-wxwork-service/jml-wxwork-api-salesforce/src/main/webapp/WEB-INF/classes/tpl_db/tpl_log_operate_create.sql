CREATE TABLE `#(tbName)` (
       `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键',
       `server_node` varchar(50) NULL COMMENT '服务器节点',
       `action` varchar(256) DEFAULT NULL COMMENT '请求地址',
       `req_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '请求时间',
       `user_agent` varchar(1000) DEFAULT NULL COMMENT '浏览器字符串',
       `req_params` text COMMENT '请求参数',
       `cost_time` bigint(20) DEFAULT NULL COMMENT '请求耗时，毫秒',
       `req_method` varchar(50) DEFAULT NULL COMMENT '请求方法',
       `req_rawdata` text COMMENT '请求内容体',
       `client` varchar(20) DEFAULT NULL COMMENT '请求客户端',
       `clientIp` varchar(50) DEFAULT NULL COMMENT '客户端IP',
       `ajaxFlag` varchar(1) DEFAULT NULL COMMENT 'ajax请求标记',
       `mobileFlag` varchar(1) DEFAULT NULL COMMENT '是否为移动平台',
       `browser` varchar(100) DEFAULT NULL COMMENT '浏览器类型',
       `platform` varchar(100) DEFAULT NULL COMMENT '平台类型',
       `os` varchar(100) DEFAULT NULL COMMENT '系统类型',
       `engine` varchar(100) DEFAULT NULL COMMENT '引擎类型',
       `version` varchar(50) DEFAULT NULL COMMENT '浏览器版本',
       `engineVersion` varchar(50) DEFAULT NULL COMMENT '引擎版本',
       PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='业务操作日志#(tbName)';

# CREATE INDEX log_o_#(dateStr)_stu_id_IDX USING BTREE ON #(tbName) (stu_id);
# CREATE INDEX log_o_#(dateStr)_action_IDX USING BTREE ON #(tbName) (`action`);
# CREATE INDEX log_o_#(dateStr)_req_time_IDX USING BTREE ON #(tbName) (req_time);
# CREATE INDEX log_o_#(dateStr)_unionId_IDX USING BTREE ON #(tbName) (unionId);
# CREATE INDEX log_o_#(dateStr)_clientIp_IDX USING BTREE ON #(tbName) (clientIp);
# CREATE INDEX log_o_#(dateStr)_client_IDX USING BTREE ON #(tbName) (client);
