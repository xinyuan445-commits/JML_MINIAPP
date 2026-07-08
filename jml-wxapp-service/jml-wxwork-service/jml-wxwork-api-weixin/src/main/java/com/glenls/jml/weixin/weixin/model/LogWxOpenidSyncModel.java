package com.glenls.jml.weixin.weixin.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.List;
import java.util.Map;


@Table(tableName = "log_wxopenid_sync",primaryKey = "id")
public class LogWxOpenidSyncModel extends DbXmlModel4Jboot<LogWxOpenidSyncModel> implements IBean {
	private static final long serialVersionUID = 1L;

	
	public static final String STATUS_0 = "0";

	
	public static final String STATUS_1 = "1";

	
	public void delByWechatId(Map<String, Object> paramsMap){
		deleteForXml("log_wxopenid_sync.delByWechatId",paramsMap);
	}

	
	public void updateStatus(){
		updateForXml("log_wxopenid_sync.updateStatus");
	}

	
	public List<LogWxOpenidSyncModel> queryNoSyncDetailData(){
		return findForXml("log_wxopenid_sync.queryNoSyncDetailData");
	}

	
	public LogWxOpenidSyncModel queryLastest(){
		return findFirstForXml("log_wxopenid_sync.queryLastest");
	}
}
