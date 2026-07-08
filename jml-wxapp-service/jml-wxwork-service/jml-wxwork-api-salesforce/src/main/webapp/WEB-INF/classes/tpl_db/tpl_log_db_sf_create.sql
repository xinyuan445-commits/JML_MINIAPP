CREATE TABLE `#(tbName)` (
    id                   bigint not null auto_increment comment '主键ID',
    code                 varchar(100) not null comment '对象代码',
    val                  varchar(1000) comment '对象值',
    post_json            text comment '请求参数',
    ret_json             text comment '返回参数',
    send_status          varchar(1) comment '发送状态；1-成功，0-失败；默认为1',
    cost_time            bigint comment '发送耗时',
    update_sql           text comment '执行更新的sql',
    createtime           datetime not null default CURRENT_TIMESTAMP comment '创建时间',
    primary key (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='AWS-SF日志表#(tbName)';
