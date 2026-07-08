package com.glenls.jml.model;

import com.alibaba.fastjson.JSONArray;
import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_case",primaryKey = "id")
public class CaseModel extends DbXmlModel4Jboot<CaseModel> implements IBean {


    public Page<CaseModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "case.queryPageBy",paramsMap);
    }


    public CaseModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("case.queryDetails",paramsMap);
    }




}
