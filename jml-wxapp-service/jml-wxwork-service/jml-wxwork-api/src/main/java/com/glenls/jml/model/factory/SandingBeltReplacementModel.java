package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_sanding_belt_replacement",primaryKey = "id")
public class SandingBeltReplacementModel extends DbXmlModel4Jboot<SandingBeltReplacementModel> implements IBean {

    
    public Page<SandingBeltReplacementModel> queryPageBy(int pageNumber, int pageSize,Map<String,Object> paramsMap) {
        return paginateForXml(pageNumber, pageSize, "sandingBeltReplacement.queryPageBy", paramsMap);
    }
    

    public SandingBeltReplacementModel queryDetails(String id) {
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("sandingBeltReplacement.queryDetails",paramsMap);
    }

}
