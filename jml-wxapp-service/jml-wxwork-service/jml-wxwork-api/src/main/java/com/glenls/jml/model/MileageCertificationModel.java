package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_mileage_certification",primaryKey = "id")
public class MileageCertificationModel extends DbXmlModel4Jboot<MileageCertificationModel> implements IBean {

    public Page<MileageCertificationModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "mileageCer.queryPageBy",paramsMap);
    }


    public MileageCertificationModel queryUnEndMileageCer(Map<String,Object> paramsMap){
        return findFirstForXml("mileageCer.queryUnEndMileageCer",paramsMap);
    }


    public MileageCertificationModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("mileageCer.queryDetails",paramsMap);
    }


}
