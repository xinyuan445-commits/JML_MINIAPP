package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.glenls.jml.pojo.jmlcase.CaseSolutionDetailPojo;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_case_solution",primaryKey = "id")
@Slf4j
public class CaseSolutionModel extends DbXmlModel4Jboot<CaseSolutionModel> implements IBean {

    public List<CaseSolutionModel> queryListBy(String caseId,String solutionRole){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("caseId",caseId);
        paramsMap.put("solutionRole",solutionRole);
        return findForXml("caseSolution.queryListBy",paramsMap);
    }

    
    public CaseSolutionModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("caseSolution.queryDetails",paramsMap);
    }

    
    public List<CaseSolutionModel> queryCheckFiledList(String caseId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("caseId",caseId);
        return findForXml("caseSolution.queryCheckFiledList",paramsMap);
    }

    

    public List<CaseSolutionModel> querySolutionRole(String caseId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("caseId",caseId);
        return findForXml("caseSolution.querySolutionRole",paramsMap);
    }
    
    public int checkSolutionRole(CaseSolutionDetailPojo caseSolutionPojo){
        log.info("----判断角色---"+caseSolutionPojo.getSolutionRole());
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("caseId",caseSolutionPojo.getCaseId());
        paramsMap.put("solutionRole",caseSolutionPojo.getSolutionRole());
        paramsMap.put("orderDetailId",caseSolutionPojo.getOrderDetailId());
        return findFirstForXml("caseSolution.checkSolutionRole",paramsMap).getInt("cnt");
    }


}
