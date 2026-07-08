package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_peripheral_device_mnt",primaryKey = "id")
public class PeripheralDeviceMntModel extends DbXmlModel4Jboot<PeripheralDeviceMntModel> implements IBean {


    public Page<PeripheralDeviceMntModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap) {
        return paginateForXml(pageNo, pageSize, "peripheralDeviceMnt.queryPageBy", paramsMap);
    }


    public PeripheralDeviceMntModel queryDetails(String id) {
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("peripheralDeviceMnt.queryDetails", paramsMap);
    }

}
