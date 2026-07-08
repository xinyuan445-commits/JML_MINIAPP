package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_nitrogen_log",primaryKey = "id")
public class NitrogenLogModel extends DbXmlModel4Jboot<NitrogenLogModel> implements IBean {

    
    public Page<NitrogenLogModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap) {
        return paginateForXml(pageNo, pageSize, "nitrogenLog.queryPageBy", paramsMap);
    }

    
    public NitrogenLogModel queryDetails(String id) {
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("nitrogenLog.queryDetails", paramsMap);
    }

    
    public NitrogenLogModel queryBeforeLiquid(Map<String,Object> paramsMap) {
        return findFirstForXml("nitrogenLog.queryBeforeLiquid", paramsMap);
    }
}
