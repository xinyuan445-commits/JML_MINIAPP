package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.List;


@Table(tableName = "jml_device",primaryKey = "id")
public class DeviceModel extends DbXmlModel4Jboot<DeviceModel> implements IBean {
    public List<DeviceModel> queryList() {
        return findForXml("device.queryList");
    }
}
