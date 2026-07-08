package com.glenls.wxwork.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "wxwork_customer", primaryKey = "id")
public class WxworkCustomerModel extends DbXmlModel4Jboot<WxworkCustomerModel> implements IBean {


    public WxworkCustomerModel queryByCustId(String custId){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("custId",custId);

        return findFirstForXml("wxwork_customer.queryByCustId",paramsMap);
    }
}
