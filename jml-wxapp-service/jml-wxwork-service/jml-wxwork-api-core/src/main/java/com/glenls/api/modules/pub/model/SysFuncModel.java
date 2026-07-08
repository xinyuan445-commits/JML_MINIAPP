package com.glenls.api.modules.pub.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;
import org.apache.commons.collections.CollectionUtils;

import java.util.List;
import java.util.Map;


@Table(tableName = "sys_func",primaryKey = "id")
public class SysFuncModel extends DbXmlModel4Jboot<SysFuncModel> implements IBean {
	
	public static final String ACTION_TYPE__1 = "1";
	
	public static final String ACTION_TYPE__2 = "2";


	public Page<SysFuncModel> pageBy(int pageNumber, int pageSize, SysFuncModel paramsModel){
		return paginateForXml(pageNumber,pageSize,"sys_func.queryBy",paramsModel != null ? paramsModel._getAttrs() : null);
	}


	public List<SysFuncModel> queryBy(SysFuncModel paramsModel){
		return findForXml("sys_func.queryBy",paramsModel != null ? paramsModel._getAttrs() : null);
	}


	public List<SysFuncModel> queryByType(String actionType){
		SysFuncModel paramsModel = new SysFuncModel();
		paramsModel.put("actionType",actionType);

		return queryBy(paramsModel);
	}


	public boolean checkActionConfigExists(String controllerKey,String actionKey){
		SysFuncModel paramsModel = new SysFuncModel();
		paramsModel.put("actionQ",actionKey);
		paramsModel.put("url",controllerKey);

		return CollectionUtils.isNotEmpty(queryBy(paramsModel));
	}


	public List<SysFuncModel> queryBaseFunc(){
		return queryByType(ACTION_TYPE__1);
	}


	public <T> List<SysFuncModel> queryByMenuId(T menuId){
		SysFuncModel paramsModel = new SysFuncModel();
		paramsModel.put("menuid",menuId);

		return queryBy(paramsModel);
	}


	public List<SysFuncModel> queryAuthBy(SysFuncModel paramsModel){
		return findForXml("sys_func.queryAuthBy",paramsModel);
	}


	public void delByIds(Map<String,Object> paramsMap){
		updateForXml("sys_func.delByIds",paramsMap);
	}
}
