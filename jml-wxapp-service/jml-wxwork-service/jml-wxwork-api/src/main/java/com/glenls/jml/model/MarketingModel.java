package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_marketing",primaryKey = "id")
public class MarketingModel extends DbXmlModel4Jboot<MarketingModel> implements IBean {
    private static final long serialVersionUID = 1L;


    public Page<MarketingModel> queryPage(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "marketing.queryPage",paramsMap);
    }


    public MarketingModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("marketing.queryDetails",paramsMap);
    }


    public List<MarketingModel> queryListByStaff(Map<String,Object> paramsMap){
        return findForXml("marketing.queryListByStaff",paramsMap);
    }




}
