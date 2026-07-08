package com.glenls.api.modules.pub.model;

import com.jfinal.plugin.activerecord.BaseModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "sys_region",primaryKey = "id")
public class SysRegionModel extends BaseModel4Jboot<SysRegionModel> implements IBean {
	private static final long serialVersionUID = 1L;


	public List<SysRegionModel> findProvinceList() {
		return findForXml("sys_region.findProvinceList");
	}


	public Page<SysRegionModel> pageProvince(int pageNo,int pageSize){
		return paginateForXml(pageNo,pageSize,"sys_region.findProvinceList");
	}


	public List<SysRegionModel> findCityListBycode(String pcode) {
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("code",pcode);

		return findForXml("sys_region.findCityListBycode",paramsMap);
	}


	public List<SysRegionModel> findCityListByPcode(String pcode) {
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("pcode",pcode);

		return findForXml("sys_region.findCityListBycode",paramsMap);
	}


	public Page<SysRegionModel> findCityListByPcode(int pageNo,int pageSize,String pcode) {
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("pcode",pcode);

		return paginateForXml(pageNo,pageSize,"sys_region.findCityListBycode",paramsMap);
	}


	public List<SysRegionModel> findCityListByPname(String pname) {
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("pname",pname);

		return findForXml("sys_region.findCityListBycode",paramsMap);
	}


	public String findCityCodeByName(String cityName) {
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("rname",cityName);

		SysRegionModel model = findFirstForXml("sys_region.findCityListBycode",paramsMap);
		return null != model ? model.getStr("code") : "";
	}


	public String findProvinceCodeByName(String cityName) {
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("cityName",cityName);

		SysRegionModel model = findFirstForXml("sys_region.findCityListBycode",paramsMap);
		return null != model ? model.getStr("code") : "";
	}


	public List<SysRegionModel> querySubRegion(String code){
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("regionCode",code);

		return findForXml("sys_region.querySubRegion",paramsMap);
	}


	public List<SysRegionModel> queryAll(){
		return findForXml("sys_region.queryAll");
	}

	public List<SysRegionModel> queryAllX(){
		return findForXml("sys_region.queryAllX");
	}
}
