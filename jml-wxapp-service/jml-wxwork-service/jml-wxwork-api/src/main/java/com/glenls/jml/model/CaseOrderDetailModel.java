package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_case_order_detail",primaryKey = "id")
public class CaseOrderDetailModel extends DbXmlModel4Jboot<CaseOrderDetailModel> implements IBean {

    
    public List<CaseOrderDetailModel> queryListBy(String caseId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("caseId",caseId);
        return findForXml("caseOrderDetail.queryListBy",paramsMap);
    }

    
    public CaseOrderDetailModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("caseOrderDetail.queryDetails",paramsMap);
    }

}
