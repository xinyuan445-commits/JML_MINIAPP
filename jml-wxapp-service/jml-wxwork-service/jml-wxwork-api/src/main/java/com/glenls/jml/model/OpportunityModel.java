package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_opportunity",primaryKey = "id")
public class OpportunityModel extends DbXmlModel4Jboot<OpportunityModel> implements IBean {

    
    public final String STAGE_YXKH = "意向中";
    
    public final String STAGE_KHQT = "洽谈";
    
    public final String STAGE_CPJS = "产品介绍";
    
    public final String STAGE_HTQD = "合同签订";
    
    public final String STAGE_DSGB = "丢失关闭";



    public Page<OpportunityModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "opportunity.queryPageBy",paramsMap);
    }


    public OpportunityModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("opportunity.queryDetails",paramsMap);
    }


    public List<OpportunityModel> queryListByStaff(Map<String,Object> paramsMap){
        return findForXml("opportunity.queryListByStaff",paramsMap);
    }

}
