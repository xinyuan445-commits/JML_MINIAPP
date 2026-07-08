package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_related_cfg",primaryKey = "id")
public class RelatedCfgModel extends DbXmlModel4Jboot<RelatedCfgModel> implements IBean {
    
    public List<RelatedCfgModel> queryListByParentObjCode(String parentObjCode){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("parentObjCode",parentObjCode);
        return findForXml("relatedCfg.queryListByParentObjCode",paramsMap);
    }

    
    public int CntByRelatedCode(Map<String,Object> paramsMap){
        return findFirstForXml("relatedCfg.cntByRelatedCode",paramsMap).getLong("cnt").intValue();
    }
}
