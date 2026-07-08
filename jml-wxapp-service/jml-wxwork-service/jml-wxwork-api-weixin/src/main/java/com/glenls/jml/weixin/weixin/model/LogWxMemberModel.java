package com.glenls.jml.weixin.weixin.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "log_wx_member",primaryKey = "id")
public class LogWxMemberModel extends DbXmlModel4Jboot<LogWxMemberModel> implements IBean {
	private static final long serialVersionUID = 1L;


	public void delByWechatid(String wxappid) {
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("wxappid",wxappid);

		deleteForXml("log_wx_member.delByWechatId",paramsMap);
	}


	public LogWxMemberModel queryFirstByWechatId(String wxappid){
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("wxappid",wxappid);

		return findFirstForXml("log_wx_member.queryFirstByWechatId",paramsMap);
	}
}
