package com.glenls.salesforce.modules.db2sf.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;


@Table(tableName = "sf_sync_conf_auth", primaryKey = "id")
public class SfSyncConfAuthModel extends DbXmlModel4Jboot<SfSyncConfAuthModel> implements IBean {

    
    public SfSyncConfAuthModel queryConf(){
        return findFirstForXml("sf_sync_conf_auth.queryConf");
    }
}
