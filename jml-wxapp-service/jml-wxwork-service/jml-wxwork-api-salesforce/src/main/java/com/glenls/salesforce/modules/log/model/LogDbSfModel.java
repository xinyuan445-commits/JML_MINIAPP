package com.glenls.salesforce.modules.log.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.Map;


@Table(tableName = "log_db_sf", primaryKey = "id")
public class LogDbSfModel extends DbXmlModel4Jboot<LogDbSfModel> implements IBean {


    
    public void createBakData(Map<String,Object> paramsMap){
        updateForXml("log_db_sf.createBakData",paramsMap);
    }

    
    public void delOldData(Map<String,Object> paramsMap){
        updateForXml("log_db_sf.delOldData",paramsMap);
    }

    
    public int cntFailByDate(Map<String,Object> paramsMap){
        return findFirstForXml("jmlDb2SfLog.cntFailByDate",paramsMap).getInt("cnt");
    }
}
