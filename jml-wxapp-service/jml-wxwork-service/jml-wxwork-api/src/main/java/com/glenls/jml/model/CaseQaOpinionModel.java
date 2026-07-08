package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_case_qa_opinion",primaryKey = "id")
public class CaseQaOpinionModel extends DbXmlModel4Jboot<CaseQaOpinionModel> implements IBean {


    public List<CaseQaOpinionModel> queryListBy(String caseId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("caseId",caseId);
        return findForXml("caseQaOpinion.queryListBy",paramsMap);
    }


    public CaseQaOpinionModel queryDetails(String caseId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("caseId",caseId);
        return findFirstForXml("caseQaOpinion.queryDetails",paramsMap);
    }

}
