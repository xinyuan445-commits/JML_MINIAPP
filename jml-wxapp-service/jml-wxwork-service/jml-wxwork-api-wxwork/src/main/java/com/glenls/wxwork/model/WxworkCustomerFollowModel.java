package com.glenls.wxwork.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.glenls.commons.lang.kit.AppKit;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "wxwork_customer_follow", primaryKey = "id")
public class WxworkCustomerFollowModel extends DbXmlModel4Jboot<WxworkCustomerFollowModel> implements IBean {


    public void delByCustId(String custId){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("custId",custId);

        deleteForXml("wxwork_customer_follow.delByCustId",paramsMap);
    }


    public void batchInsert(List<WxworkCustomerFollowModel> modelList){
        String columns = "userid,remark,description,createtime,oper_userid,remark_corp_name,add_way,state";
        batchForXml("wxwork_customer_follow.batchInsert",columns,modelList, AppKit.BATCH_SIZE);
    }
}
