package com.glenls.api.modules.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_device_repair",primaryKey = "id")
public class DeviceRepairModel extends DbXmlModel4Jboot<DeviceRepairModel> implements IBean {


    public DeviceRepairModel queryDetails(String id) {
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("id", id);
        return findFirstForXml("deviceRepairByCore.queryDetails", paramsMap);
    }


    public List<DeviceRepairModel> queryCreate15Min(){
        return findForXml("deviceRepairByCore.queryCreate15Min");
    }

}
