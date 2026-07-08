package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_press_line_production",primaryKey = "id")
public class PressLineProductionModel extends DbXmlModel4Jboot<PressLineProductionModel> implements IBean {

    
    public Page<PressLineProductionModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "pressLineProduction.queryPageBy",paramsMap);
    }

    
    public PressLineProductionModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("pressLineProduction.queryDetails",paramsMap);
    }
}
