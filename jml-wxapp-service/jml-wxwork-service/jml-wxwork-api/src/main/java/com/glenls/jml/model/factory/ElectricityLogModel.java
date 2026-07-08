package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_electricity_log",primaryKey = "id")
public class ElectricityLogModel extends DbXmlModel4Jboot<ElectricityLogModel> implements IBean {


    public Page<ElectricityLogModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap) {
        return paginateForXml(pageNo, pageSize, "electricityLog.queryPageBy", paramsMap);
    }


    public ElectricityLogModel queryDetails(String id) {
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("electricityLog.queryDetails", paramsMap);
    }


    public ElectricityLogModel queryBeforeReading(Map<String,Object> paramsMap) {
        return findFirstForXml("electricityLog.queryBeforeReading", paramsMap);
    }
    
}
