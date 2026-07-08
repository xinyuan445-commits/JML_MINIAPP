package com.glenls.jml.weixin.weixin.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.glenls.commons.lang.kit.AppKit;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "wx_member",primaryKey = "id")
public class WxMemberModel extends DbXmlModel4Jboot<WxMemberModel> implements IBean {
	private static final long serialVersionUID = 1L;


	public static final String SUBSCRIBE_0 = "0";


	public static final String SUBSCRIBE_1 = "1";


	public WxMemberModel queryByOpenId(String openId){
		WxMemberModel paramsModel = new WxMemberModel();
		paramsModel.put("openid",openId);

		return querySingleBy(paramsModel);
	}


	public WxMemberModel querySingleBy(WxMemberModel paramsModel){
		return findFirstForXml("wxmember.queryBy",paramsModel != null ? paramsModel._getAttrs() : null);
	}




	public void batchInsert(List<WxMemberModel> memberList){
		String columns = "wechatid,subscribe,openid,nickname,sex,city,country,province,headimgurl,subscribe_time,unionid,remark,groupid";
		batchForXml("wxmember.batchInsert",columns,memberList, AppKit.BATCH_SIZE);
	}


	public void delWxmemberByWechatid(long wechatid) {
		deleteForXml("wxmember.delWxmemberByWechatid",wechatid);
	}


	public void batchUpdate4Sync(Map<String, Object> paramsMap){
		updateForXml("wxmember.batchUpdate4Sync",paramsMap);
	}


	public void batchInsert4Sync(Map<String, Object> paramsMap){
		updateForXml("wxmember.batchInsert4Sync",paramsMap);
	}


	public void updateSubscribeFlagByOpenId(String openId,String subscribe){
		Map<String, Object> paramsMap = new HashMap<>();
		paramsMap.put("openId",openId);
		paramsMap.put("subscribe",subscribe);

		updateForXml("wxmember.updateSubscribeFlagByOpenId",paramsMap);
	}



	public void updateSubscribeFlag(Map<String, Object> paramsMap){
		updateForXml("wxmember.updateSubscribeFlag",paramsMap);
	}


	public void updateSubscribeFlag2(){
		updateForXml("wxmember.updateSubscribeFlag2");
	}


	public void updateSubscribeFlag3(){
		updateForXml("wxmember.updateSubscribeFlag3");
	}



	public WxMemberModel queryNewest(){
		return findFirstForXml("wxmember.queryNewest");
	}
}
