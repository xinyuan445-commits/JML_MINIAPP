package com.glenls.jml.modules.privilege.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.List;
import java.util.Map;


@Table(tableName = "jml_role_menu",primaryKey = "id")
public class RoleMenuModel extends DbXmlModel4Jboot<RoleMenuModel> implements IBean {

    public final String SALES_REPORT = "SalesReport";


    public List<RoleMenuModel> queryByStaffId(Map<String,Object> paramsMap){
        return findForXml("jml_role_menu.queryByStaffId",paramsMap);
    }


}
