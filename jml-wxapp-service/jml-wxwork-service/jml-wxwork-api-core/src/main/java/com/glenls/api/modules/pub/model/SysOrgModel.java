package com.glenls.api.modules.pub.model;

import com.jfinal.plugin.activerecord.BaseModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "sys_org",primaryKey = "id")
public class SysOrgModel extends BaseModel4Jboot<SysOrgModel> implements IBean {

	
	public static final Long TOP_ORG_PID = 0L;


	public List<SysOrgModel> query(Map<String,Object> paramsMap){
		return findForXml("sys_org.query",paramsMap);
	}


	public Page<SysOrgModel> page(int pageNo,int pageSize,Map<String,Object> paramsMap){
		return paginateForXml(pageNo,pageSize,"sys_org.query",paramsMap);
	}


	public boolean queryHasChildOrg(Long id){
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("id",id);

		return findFirstForXml("sys_org.queryHasChildOrg",paramsMap).getLong("cnt") > 0;
	}
}
