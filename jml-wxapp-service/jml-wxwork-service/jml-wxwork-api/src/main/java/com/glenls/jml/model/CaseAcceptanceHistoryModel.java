package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;



@Table(tableName = "jml_case_acceptance_history",primaryKey = "id")
public class CaseAcceptanceHistoryModel extends DbXmlModel4Jboot<CaseAcceptanceHistoryModel> implements IBean {

    
    public List<CaseAcceptanceHistoryModel> queryHistoryShowList(Map<String,Object> paramsMap){
        return findForXml("caseAcceptanceHistory.queryHistoryShowList",paramsMap);
    }

    
    public List<CaseAcceptanceHistoryModel> queryHistoryShowRelated(Map<String,Object> paramsMap){
        return findForXml("caseAcceptanceHistory.queryHistoryShowRelated",paramsMap);
    }

    
    public CaseAcceptanceHistoryModel queryUpdateStageBy(Map<String,Object> paramsMap){
        return findFirstForXml("caseAcceptanceHistory.queryUpdateStageBy",paramsMap);
    }

    

    public CaseAcceptanceHistoryModel queryNextStage(Map<String,Object> paramsMap){
        return findFirstForXml("caseAcceptanceHistory.queryNextStage",paramsMap);
    }

    
    public void updateFMBy(Map<String,Object> paramsMap){
        updateForXml("caseAcceptanceHistory.updateFMBy", paramsMap);
    }

    
    public void updateCloseStage(Map<String,Object> paramsMap){
        updateForXml("caseAcceptanceHistory.updateCloseStage", paramsMap);
    }

    
    public void deleteByCaseId(String caseId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("caseId",caseId);
        deleteForXml("caseAcceptanceHistory.deleteByCaseId", paramsMap);
    }

    
    public List<CaseAcceptanceHistoryModel>  querySendTmplInfoBy(Map<String,Object> paramsMap){
        return findForXml("caseAcceptanceHistory.querySendTmplInfoBy",paramsMap);
    }

    

    public CaseAcceptanceHistoryModel querySalesOpenIdInfoBy(Map<String,Object> paramsMap){
        return findFirstForXml("caseAcceptanceHistory.querySalesOpenIdInfoBy",paramsMap);
    }

    
    public void updateZLYJBy(Map<String,Object> paramsMap){
        updateForXml("caseAcceptanceHistory.updateZLYJBy", paramsMap);
    }





}
