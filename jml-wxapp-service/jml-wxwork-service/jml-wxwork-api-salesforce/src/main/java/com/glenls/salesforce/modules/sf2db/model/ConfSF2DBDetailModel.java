package com.glenls.salesforce.modules.sf2db.model;

import com.glenls.commons.jfinal.plugins.sqlxml.plugin.activerecord.DbXmlModel;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "sf_sync_conf_sf_db_detail", primaryKey = "id")
public class ConfSF2DBDetailModel extends DbXmlModel<ConfSF2DBDetailModel> implements IBean {


    public List<ConfSF2DBDetailModel> queryByCode(String code){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("code",code);

        return findForXml("sf_sync_conf_sf_db_detail.queryByCode",paramsMap);
    }

}
