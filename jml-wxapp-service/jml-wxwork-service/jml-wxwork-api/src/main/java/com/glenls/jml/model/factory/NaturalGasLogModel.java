package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_natural_gas_log",primaryKey = "id")
public class NaturalGasLogModel  extends DbXmlModel4Jboot<NaturalGasLogModel> implements IBean {


    public Page<NaturalGasLogModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap) {
        return paginateForXml(pageNo, pageSize, "naturalGasLog.queryPageBy", paramsMap);
    }


    public NaturalGasLogModel queryDetails(String id) {
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("naturalGasLog.queryDetails", paramsMap);
    }


    public NaturalGasLogModel queryBeforeReading(Map<String,Object> paramsMap) {
        return findFirstForXml("naturalGasLog.queryBeforeReading", paramsMap);
    }
    
}
