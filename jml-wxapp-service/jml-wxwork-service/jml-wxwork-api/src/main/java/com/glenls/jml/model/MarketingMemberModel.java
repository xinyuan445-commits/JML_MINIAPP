package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_marketing_member",primaryKey = "id")
public class MarketingMemberModel  extends DbXmlModel4Jboot<MarketingMemberModel> implements IBean {

    public Page<MarketingMemberModel>  queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "marketingMember.queryPageBy",paramsMap);
    }


    public MarketingMemberModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("marketingMember.queryDetails",paramsMap);
    }


}
