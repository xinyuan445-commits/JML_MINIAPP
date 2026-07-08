package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_case_approval_history",primaryKey = "id")
public class CaseApprovalHistoryModel extends DbXmlModel4Jboot<CaseApprovalHistoryModel> implements IBean {


    public List<CaseApprovalHistoryModel> queryListBy(String caseId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("caseId",caseId);
        return findForXml("caseApprovalHistory.queryListBy",paramsMap);

    }


    public boolean checkNewCntBy(String caseId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("caseId",caseId);
        return findFirstForXml("caseApprovalHistory.checkNewCntBy",paramsMap).getLong("cnt") > 0;
    }

}
