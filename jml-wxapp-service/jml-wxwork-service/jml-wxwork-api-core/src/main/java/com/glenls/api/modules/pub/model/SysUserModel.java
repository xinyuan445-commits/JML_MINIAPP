package com.glenls.api.modules.pub.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "sys_user",primaryKey = "id")
public class SysUserModel extends DbXmlModel4Jboot<SysUserModel> {

	private static final long serialVersionUID = 1L;

	
	public static final String ACCT_TYPE_NORMAL = "1";

	
	public static final String ACCT_TYPE_SUPERADMIN = "999";

	
	public boolean isSuperAdmin(){
		return ACCT_TYPE_SUPERADMIN.equals(getStr("acctType"));
	}


	
	public Page<SysUserModel> pageUserInfoBy(int pageNumber, int pageSize, Map<String, Object> paramMap) {
		if(paramMap == null){
			paramMap = new HashMap<>();
		}
		return paginateForXml(pageNumber,pageSize,"sys_user.querySingleTableBy",paramMap);
	}





	
	public boolean vaildUnique(Long userId, String key, String value) {
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("key",key);
		paramsMap.put("val",value);
		paramsMap.put("id",userId);

		return findFirstForXml("sys_user.vaildUnique",paramsMap) == null;
	}


	
	public SysUserModel queryUserByOpenId(String openId) {
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("openid",openId);
		return findFirstForXml("sys_user.findSysUserByPage",paramsMap);
	}

	
	public SysUserModel queryUserByMobile(String mobile) {
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("mobile",mobile);
		return findFirstForXml("sys_user.findSysUserByPage",paramsMap);
	}

	
	public SysUserModel queryUserByMobileAndOpenid(String mobile, String openId) {
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("mobile",mobile);
		paramsMap.put("openid",openId);
		return findFirstForXml("sys_user.findSysUserByPage",paramsMap);
	}

	
	public SysUserModel queryUserBy(Map<String,Object> paramsMap){
		return findFirstForXml("sys_user.findSysUserByPage",paramsMap);
	}

	
	public SysUserModel queryUserBy(Long userId){
		if(userId == null && userId <= 0){
			return null;
		}
		Map<String,Object> params = new HashMap<>();
		params.put("id",userId);

		return queryUserBy(params);
	}


	
	public boolean checkOldPwdIsRight(String userId, String oldPwd) {
		SysUserModel model = new SysUserModel();
		model.put("id",userId);
		model.put("pwd",oldPwd);
		return queryCntBy(model) > 0;
	}

	
	public long queryCntBy(SysUserModel model) {
		SysUserModel m = findFirstForXml("sys_user.findCntBy", model.attrs());
		return m.getLong("cnt");
	}

	
	public long queryCntBy(String mobile){
		SysUserModel paramsModel = new SysUserModel();
		paramsModel.put("mobile",mobile);

		return queryCntBy(paramsModel);
	}

	
	public <T> long queryCntBy(String mobile,T companyId){
		SysUserModel paramsModel = new SysUserModel();
		paramsModel.put("mobile",mobile);
		paramsModel.put("companyId",companyId);

		return queryCntBy(paramsModel);
	}

	
	public SysUserModel querySingleTableBy(SysUserModel paramsModel){
		return findFirstForXml("sys_user.querySingleTableBy",paramsModel != null ? paramsModel.attrs() : null);
	}

	
	public boolean updateOpenIdBy(SysUserModel paramsModel){
		return updateForXml("sys_user.updateOpenIdBy",paramsModel != null ? paramsModel.attrs() : null) > 0;
	}

	
	public int updateFailCnt(String userName){
		Map<String, Object> paramsMap = new HashMap<>();
		paramsMap.put("userName",userName);

		return updateForXml("sys_user.updateFailCnt",paramsMap);
	}

	
	public int resetFailtCnt(String userName){
		Map<String, Object> paramsMap = new HashMap<>();
		paramsMap.put("userName",userName);

		return updateForXml("sys_user.resetFailtCnt",paramsMap);
	}

	
	public void updateUserStatus(){
		updateForXml("sys_user.updateUserStatus");
	}
}
