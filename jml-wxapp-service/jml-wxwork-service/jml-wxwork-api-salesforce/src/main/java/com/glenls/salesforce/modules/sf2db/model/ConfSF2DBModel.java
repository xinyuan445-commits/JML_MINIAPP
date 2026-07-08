package com.glenls.salesforce.modules.sf2db.model;

import com.glenls.commons.jfinal.plugins.sqlxml.plugin.activerecord.DbXmlModel;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "sf_sync_conf_sf_db", primaryKey = "id")
public class ConfSF2DBModel extends DbXmlModel<ConfSF2DBModel> implements IBean {

    
    public ConfSF2DBModel queryByCode(String code){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("code",code);

        return findFirstForXml("sf_sync_conf_sf_db.queryByCode",paramsMap);
    }

}
