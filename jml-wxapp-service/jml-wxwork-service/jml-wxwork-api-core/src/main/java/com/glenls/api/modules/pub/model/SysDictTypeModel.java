package com.glenls.api.modules.pub.model;

import com.jfinal.plugin.activerecord.BaseModel;
import com.jfinal.plugin.activerecord.BaseModel4Jboot;
import com.jfinal.plugin.activerecord.DbKit;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "sys_dict_type",primaryKey = "id")
public class SysDictTypeModel extends BaseModel4Jboot<SysDictTypeModel> implements IBean {

	private static final long serialVersionUID = 1L;


	public List<SysDictTypeModel> queryAll(Map<String,Object> paramsMap) {
		return findForXml("sys_dict_type.queryAll",paramsMap);
	}


	public boolean validateUniqueDcode(String dcode, String id) {
		boolean ret = Boolean.TRUE;

		Map<String, Object> paramsMap = new HashMap<>();
		paramsMap.put("dcode", dcode);
		paramsMap.put("id", id);

		SysDictTypeModel dictT = findFirstForXml("sys_dict_type.validateUniqueDcode", paramsMap);
		if (dictT != null && dictT.getLong("cnt") > 0) {
			ret = Boolean.FALSE;
		}
		return ret;
	}
	

	public List<SysDictTypeModel> queryPayType(int[] tids) {
		Map<String, Object> paramsMap = new HashMap<>();
		paramsMap.put("tids",tids);
		return findForXml("sys_dict_type.queryPayType",paramsMap);
	}


	public List<SysDictTypeModel> queryDictTypeAndDictInfoById(List<String> dictTypeDcodeList){
		Map<String, Object> paramsMap = new HashMap<>();
		paramsMap.put("dictTypeIdList",dictTypeDcodeList);
		return findForXml("sys_dict_type.queryDictTypeAndDictInfoById",paramsMap);
	}


	public SysDictTypeModel queryByCode(String code) {
		return findFirstForXml("sys_dict_type.queryByCode", code);
	}
}
