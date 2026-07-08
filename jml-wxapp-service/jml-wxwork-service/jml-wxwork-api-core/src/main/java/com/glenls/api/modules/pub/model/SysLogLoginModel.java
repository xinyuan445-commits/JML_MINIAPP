package com.glenls.api.modules.pub.model;

import com.jfinal.plugin.activerecord.BaseModel4Jboot;
import io.jboot.db.annotation.Table;

import java.util.List;


@Table(tableName = "sys_login_log",primaryKey = "id")
public class SysLogLoginModel extends BaseModel4Jboot<SysLogLoginModel> {
	private static final long serialVersionUID = 1L;

	
	public List<SysLogLoginModel> queryTop10(){
		return findForXml("sys_login_log.queryTop10");
	}
}
