package com.glenls.api.modules.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_device_repair_history",primaryKey = "id")
public class DeviceRepairHistoryModel extends DbXmlModel4Jboot<DeviceRepairHistoryModel> implements IBean {
}
