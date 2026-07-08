package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.List;
import java.util.Map;


@Table(tableName = "jml_object_change_history",primaryKey = "id")
public class ObjectChangeHistoryModel extends DbXmlModel4Jboot<ObjectChangeHistoryModel> implements IBean {

    
    public List<ObjectChangeHistoryModel> queryListBy(Map<String,Object> paramsMap){
        return findForXml("objectChangeHistory.queryListBy",paramsMap);
    }
}
