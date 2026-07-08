package com.glenls.salesforce.modules.db2sf.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;


@Table(tableName = "sf_sync_conf_db_sf", primaryKey = "id")
public class SfSyncConfDbSfModel extends DbXmlModel4Jboot<SfSyncConfDbSfModel> implements IBean {


    public SfSyncConfDbSfModel query(String code){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("code",code);

        return findFirstForXml("sf_sync_conf_db_sf.query",paramsMap);
    }


    public void updateLastSyncTime(String code, Date syncTime){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("code",code);
        paramsMap.put("syncTime",syncTime);

        updateForXml("sf_sync_conf_db_sf.updateLastSyncTime",paramsMap);
    }

}
