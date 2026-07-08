package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_sales_lead",primaryKey = "id")
public class SalesLeadModel extends DbXmlModel4Jboot<SalesLeadModel> implements IBean {
    private static final long serialVersionUID = 1L;

    
    public Page<SalesLeadModel> queryPage(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "salesLead.queryPage",paramsMap);
    }

    
    public SalesLeadModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("salesLead.queryDetails",paramsMap);
    }

    
    public List<SalesLeadModel> queryListByStaff(Map<String,Object> paramsMap){
        return findForXml("salesLead.queryListByStaff",paramsMap);
    }
}
