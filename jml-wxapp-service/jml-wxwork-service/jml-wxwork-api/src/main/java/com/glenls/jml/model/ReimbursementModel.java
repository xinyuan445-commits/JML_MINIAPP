package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_reimbursement",primaryKey = "id")
public class ReimbursementModel extends DbXmlModel4Jboot<ReimbursementModel> implements IBean {
    private static final long serialVersionUID = 1L;

    
    public Page<ReimbursementModel> queryPage(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "reimbursement.queryPage",paramsMap);
    }

    
    public ReimbursementModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("reimbursement.queryDetails",paramsMap);
    }

    
    public int submintReim(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return updateForXml("reimbursement.submitReim",paramsMap);
    }

    
    public int deleteReim(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return deleteForXml("reimbursement.deleteReim",paramsMap);
    }



}
