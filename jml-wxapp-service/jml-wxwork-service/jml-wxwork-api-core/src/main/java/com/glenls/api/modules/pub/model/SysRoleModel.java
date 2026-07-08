package com.glenls.api.modules.pub.model;

import com.jfinal.plugin.activerecord.BaseModel4Jboot;
import io.jboot.db.annotation.Table;


@Table(tableName = "sys_role",primaryKey = "id")
public class SysRoleModel extends BaseModel4Jboot<SysRoleModel> {
	private static final long serialVersionUID = 1L;

}
