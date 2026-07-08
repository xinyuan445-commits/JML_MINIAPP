package com.glenls.jml.modules.privilege.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_staff_role",primaryKey = "id")
public class StaffRoleModel extends DbXmlModel4Jboot<StaffRoleModel> implements IBean {


    public List<StaffRoleModel> queryByStaffId(String staffId){
        Map<String,String> paramsMap = new HashMap<>();
        paramsMap.put("staffId",staffId);

        return findForXml("jml_staff_role.queryByStaffId",paramsMap);
    }


}
