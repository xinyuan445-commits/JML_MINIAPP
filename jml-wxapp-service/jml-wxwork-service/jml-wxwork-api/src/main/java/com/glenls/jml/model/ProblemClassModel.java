package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.List;
import java.util.Map;


@Table(tableName = "jml_problem_class",primaryKey = "id")
public class ProblemClassModel extends DbXmlModel4Jboot<ProblemClassModel> implements IBean {

    
    public List<ProblemClassModel> queryListBy(Map<String,Object> paramsMap) {
        return findForXml("problemClass.queryListBy",paramsMap);
    }
}
