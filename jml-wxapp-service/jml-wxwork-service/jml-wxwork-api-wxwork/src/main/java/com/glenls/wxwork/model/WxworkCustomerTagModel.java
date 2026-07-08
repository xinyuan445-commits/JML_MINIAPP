package com.glenls.wxwork.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.glenls.commons.lang.kit.AppKit;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "wxwork_customer_tag", primaryKey = "id")
public class WxworkCustomerTagModel extends DbXmlModel4Jboot<WxworkCustomerTagModel> implements IBean {


    public void delByCustId(String custId){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("custId",custId);

        deleteForXml("wxwork_customer_tag.delByCustId",paramsMap);
    }


    public void batchInsert(List<WxworkCustomerTagModel> list){
        String columns = "custId, group_name, tag_name, type, tag_id";
        batchForXml("wxwork_customer_tag.batchInsert",columns,list, AppKit.BATCH_SIZE);
    }
}
