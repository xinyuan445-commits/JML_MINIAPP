package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;


@Table(tableName = "jml_staff_login_history",primaryKey = "id")
public class StaffLoginHistoryModel extends DbXmlModel4Jboot<StaffLoginHistoryModel> implements IBean {
}
