package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_device_repair_progress",primaryKey = "id")
public class DeviceRepairProgressModel  extends DbXmlModel4Jboot<DeviceRepairProgressModel> implements IBean {

    
    public List<DeviceRepairProgressModel> queryListBy(String deviceRepairId) {
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("deviceRepairId", deviceRepairId);
        return findForXml("deviceRepairProgress.queryListBy", paramsMap);
    }
}
