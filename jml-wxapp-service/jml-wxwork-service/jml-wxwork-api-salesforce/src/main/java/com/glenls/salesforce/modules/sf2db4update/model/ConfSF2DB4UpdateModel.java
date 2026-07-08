package com.glenls.salesforce.modules.sf2db4update.model;

import com.glenls.commons.jfinal.plugins.sqlxml.plugin.activerecord.DbXmlModel;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "sf_sync_conf_sf_db_update", primaryKey = "id")
public class ConfSF2DB4UpdateModel extends DbXmlModel<ConfSF2DB4UpdateModel> implements IBean {


    public ConfSF2DB4UpdateModel queryByCode(String code){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("code",code);

        return findFirstForXml("sf_sync_conf_sf_db_update.queryByCode",paramsMap);
    }

}
