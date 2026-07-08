package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_device_repair_staff_cfg",primaryKey = "id")
public class DeviceRepairStaffModel extends DbXmlModel4Jboot<DeviceRepairStaffModel> implements IBean {

    public DeviceRepairStaffModel queryRepairStaffId(String prodLine){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("prodLine",prodLine);
        return findFirstForXml("deviceRepairStaffCfg.queryRepairStaffId", paramsMap);
    }
}
