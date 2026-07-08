package com.glenls.api.modules.pub.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.glenls.commons.lang.kit.AppKit;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.List;


@Table(tableName = "sys_rela_role_auth",primaryKey = "id")
public class RelaRoleAuthModel extends DbXmlModel4Jboot<RelaRoleAuthModel> implements IBean {
	private static final long serialVersionUID = 1L;



	public boolean delByRoleId(String roleId){
		return deleteForXml("sysAuth.delByRoleId",roleId) > 0;
	}


	public void batachAdd(List<RelaRoleAuthModel> authModelList){
		batchForXml("sysAuth.batchAddSQL","id,roleId,authType,authId",authModelList, AppKit.PAGE_SIZE_SELECT_IN);
	}


	public List<RelaRoleAuthModel> getAuthByRoleId(String roleId) {
		return findForXml("sysAuth.getAuthByRoleId",roleId);
	}


	public List<RelaRoleAuthModel> query4RoleAuth(String roleId){
		return findForXml("sysAuth.query4RoleAuth",roleId);
	}
}
