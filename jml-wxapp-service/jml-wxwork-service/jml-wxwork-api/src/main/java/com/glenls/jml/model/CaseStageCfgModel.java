package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.List;
import java.util.Map;


@Table(tableName = "jml_case_stage_cfg",primaryKey = "id")
public class CaseStageCfgModel  extends DbXmlModel4Jboot<CaseStageCfgModel> implements IBean {

    public List<CaseStageCfgModel> queryListByServiceType(Map<String,Object> paramsMap){
        return findForXml("caseStageCfg.queryListByServiceType",paramsMap);
    }


    public CaseStageCfgModel queryFactoryAcceptance(Map<String,Object> paramsMap){
        return findFirstForXml("caseStageCfg.queryFactoryAcceptance",paramsMap);
    }


    public CaseStageCfgModel queryCheckStage(Map<String,Object> paramsMap){
        return findFirstForXml("caseStageCfg.queryCheckStage",paramsMap);
    }


    public List<CaseStageCfgModel> queryCheckFiled(){
        return findForXml("caseStageCfg.queryCheckFiled");
    }


    public List<CaseStageCfgModel> queryListByFlowCode(Map<String,Object> paramsMap){
        return findForXml("caseStageCfg.queryListByFlowCode",paramsMap);
    }






}
