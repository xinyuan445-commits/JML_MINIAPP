package com.glenls.api.modules.pub.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.glenls.commons.jfinal.plugins.sqlxml.plugin.activerecord.DbXmlModel;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.Map;


@Table(tableName = "sys_log",primaryKey = "id")
public class SysLogModel extends DbXmlModel4Jboot<SysLogModel> implements IBean {

	public Page<SysLogModel> queryBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
		return paginateForXml(pageNo,pageSize,"sys_log.queryBy",paramsMap);
	}


	public void clearLog(){
		deleteForXml("sys_log.clearLog");
	}
}
