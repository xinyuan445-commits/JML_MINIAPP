package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_device_repair",primaryKey = "id")
public class DeviceRepairModel extends DbXmlModel4Jboot<DeviceRepairModel> implements IBean {


    public  Page<DeviceRepairModel> queryPageBy(int pageNo, int pageSize, java.util.Map<String,Object> paramsMap) {
        return paginateForXml(pageNo, pageSize, "deviceRepair.queryPageBy", paramsMap);
    }


    public DeviceRepairModel queryDetails(String id) {
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("id", id);
        return findFirstForXml("deviceRepair.queryDetails", paramsMap);
    }
}
