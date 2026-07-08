package com.glenls.salesforce.modules.db2sf.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "sf_sync_conf_db_sf_detail", primaryKey = "id")
public class SfSyncConfDbSfDetailModel extends DbXmlModel4Jboot<SfSyncConfDbSfDetailModel> implements IBean {


    public List<SfSyncConfDbSfDetailModel> query(String code){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("code",code);

        return findForXml("sf_sync_conf_db_sf_detail.query",paramsMap);
    }


    public List<SfSyncConfDbSfDetailModel> queryNotOnBodyAttr(String code){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("code",code);

        return findForXml("sf_sync_conf_db_sf_detail.queryNotOnBodyAttr",paramsMap);
    }


    public List<SfSyncConfDbSfDetailModel> queryNeedUpdateAttr(String code){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("code",code);

        return findForXml("sf_sync_conf_db_sf_detail.queryNeedUpdateAttr",paramsMap);
    }
}
