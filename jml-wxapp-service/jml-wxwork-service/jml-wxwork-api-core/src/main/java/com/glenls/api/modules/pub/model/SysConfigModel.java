package com.glenls.api.modules.pub.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "sys_config",primaryKey = "id")
public class SysConfigModel extends DbXmlModel4Jboot<SysConfigModel> implements IBean {
	private static final long serialVersionUID = 1L;



	public void upWebSet(String value, String key) {
		Map<String, Object> paramsMap = new HashMap<>();
		paramsMap.put("k", key);
		paramsMap.put("v", value);

		updateForXml("sys_config.upWebSet", paramsMap);
	}


	public SysConfigModel findConfigByKey(String key) {
		Map<String, Object> params = new HashMap<>();
		params.put("key", key);
		return findFirstForXml("sys_config.query", params);
	}


	public String findValuegByKey(String key) {
		SysConfigModel model = findConfigByKey(key);
		return model != null ? model.getStr("value") : "";
	}
	


	public List<SysConfigModel> findList() {
		return findForXml("sys_config.query");
	}


	public Map<String, String> getDefaultVal() {
		List<SysConfigModel> configRecord = findForXml("sys_config.query");
		if (CollectionUtils.isEmpty(configRecord)) {
			return null;
		}

		Map<String, String> map = new HashMap<String, String>();
		for (SysConfigModel model : configRecord) {
			if (StringUtils.isNotEmpty(model.getStr("defaultVal"))) {
				map.put(model.getStr("key"), model.getStr("defaultVal"));
			}
		}
		return map;
	}


	public List<SysConfigModel> queryByColumsName(String columsName,String value){
		Map<String, Object> map=new HashMap<>();
		map.put("columsName", columsName);
		map.put("value", value);
		return findForXml("sys_config.queryByColumsName", map);
	}


	public void delBatch(List<SysConfigModel> modelList){
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("list",modelList);

		deleteForXml("sys_config.delBatch",paramsMap);
	}
}
