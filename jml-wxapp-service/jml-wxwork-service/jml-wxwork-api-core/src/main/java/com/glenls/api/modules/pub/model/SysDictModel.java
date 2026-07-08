package com.glenls.api.modules.pub.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "sys_dict",primaryKey = "id")
public class SysDictModel extends DbXmlModel4Jboot<SysDictModel> implements IBean {
	
	private static final long serialVersionUID = 1L;



	
	public List<SysDictModel> queryDictByTCode(String tcode) {
		return findForXml("sys_dict.queryDictByTCode", tcode);
	}

	
	public List<SysDictModel> queryDictByTCode(String tcode,Object notDval) {
		SysDictModel paramsMap = new SysDictModel();
		paramsMap.put("dcode",tcode);
		paramsMap.put("notInDval",notDval);

		return queryBy(paramsMap);
	}


	
	public List<SysDictModel> queryBy(SysDictModel paramsModel){
		return findForXml("sys_dict.queryBy",paramsModel != null ? paramsModel._getAttrs() : null);
	}

	
	public List<SysDictModel> queryByTCodeList(List<String> tcodeList){
		SysDictModel paramsModel = new SysDictModel();
		paramsModel.put("dcodeList",tcodeList);

		return queryBy(paramsModel);
	}

	
	public List<SysDictModel> queryDictByTid(long tid) {
		return findForXml("sys_dict.queryByTid", tid);
	}

	
	public String queryVal(String typeCode, String code) {
		Map<String, Object> paramMap = new HashMap<>();
		paramMap.put("dicCode", code);
		paramMap.put("dicTypeCode", typeCode);
		SysDictModel dict = findFirstForXml("sys_dict.queryValByCode", paramMap);
		if(dict == null) {
			return null;
		}
		return dict.getStr("dval");
	}
	
	
	public String queryNameByVal(String dicVal, String dicTypeCode) {
		Map<String, Object> paramMap = new HashMap<>();
		paramMap.put("dicVal", dicVal);
		paramMap.put("dicTypeCode", dicTypeCode);
		SysDictModel dict = findFirstForXml("sys_dict.queryNameByVal", paramMap);
		if(dict == null) {
			return null;
		}
		return dict.getStr("dname");
	}


	
	public List<SysDictModel> queryAll(){
		return findForXml("sys_dict.queryAll");
	}

	public List<SysDictModel> querySubDictByPid(Long pid){
		return findForXml("sys_dict.querySubDictByPid",pid);
	}

	public List<SysDictModel> queryParentTcode(String tcode){
		return findForXml("sys_dict.queryParentTcode",tcode);
	}


	
	public SysDictModel queryBytCode(String tcode) {
		return findFirstForXml("sys_dict.queryBytCode", tcode);
	}
}
