package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_device_repair_history",primaryKey = "id")
public class DeviceRepairHistoryModel extends DbXmlModel4Jboot<DeviceRepairHistoryModel> implements IBean {

    public List<DeviceRepairHistoryModel> queryListBy(String deviceRepairId) {
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("deviceRepairId", deviceRepairId);
        return findForXml("deviceRepairHistory.queryListBy", paramsMap);
    }
}
