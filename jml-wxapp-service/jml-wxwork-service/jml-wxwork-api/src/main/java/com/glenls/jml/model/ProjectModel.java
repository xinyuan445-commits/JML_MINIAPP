package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_project",primaryKey = "id")
public class ProjectModel extends DbXmlModel4Jboot<ProjectModel> implements IBean {
    private static final long serialVersionUID = 1L;

    
    public Page<ProjectModel> queryPage(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "project.queryPage",paramsMap);
    }

    
    public ProjectModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("project.queryDetails",paramsMap);
    }

}
