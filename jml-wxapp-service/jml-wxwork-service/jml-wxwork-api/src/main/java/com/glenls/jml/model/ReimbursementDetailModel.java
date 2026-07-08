package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_reimbursement_detail",primaryKey = "id")
public class ReimbursementDetailModel extends DbXmlModel4Jboot<ReimbursementDetailModel> implements IBean {


    public List<ReimbursementDetailModel> queryListBy(String reimId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("reimId",reimId);
        return findForXml("reimDetail.queryListBy",paramsMap);
    }


    public ReimbursementDetailModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("reimDetail.queryDetails",paramsMap);
    }


    public Page<ReimbursementDetailModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "reimDetail.queryPageBy",paramsMap);
    }


    public int submintReimDetail(String reimId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("reimId",reimId);
        return updateForXml("reimDetail.submitReimDetail",paramsMap);
    }


    public int deleteReimDetail(String reimId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("reimId",reimId);
        return deleteForXml("reimDetail.deleteReimDetail",paramsMap);
    }


}
