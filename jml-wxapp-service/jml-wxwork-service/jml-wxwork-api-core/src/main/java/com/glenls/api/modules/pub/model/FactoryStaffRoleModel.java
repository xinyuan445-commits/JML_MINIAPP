package com.glenls.api.modules.pub.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_factory_staff_role",primaryKey = "id")
public class FactoryStaffRoleModel extends DbXmlModel4Jboot<FactoryStaffRoleModel> implements IBean {


    public List<FactoryStaffRoleModel> queryByStaffId(String staffId){
        Map<String,String> paramsMap = new HashMap<>();
        paramsMap.put("staffId",staffId);
        return findForXml("jml_factory_staff_role.queryByStaffId",paramsMap);
    }


    public List<FactoryStaffRoleModel> queryFactoryStaffFuncByStaffId(String staffId){
        Map<String,String> paramsMap = new HashMap<>();
        paramsMap.put("staffId",staffId);
        return findForXml("jml_factory_staff_role.queryFactoryStaffFuncByStaffId",paramsMap);
    }


    public List<FactoryStaffRoleModel> queryFactorySubStaffWithOutSelf(Map<String,Object> paramsMap){
        return findForXml("jml_factory_staff_role.queryFactorySubStaffWithOutSelf",paramsMap);
    }


    public List<FactoryStaffRoleModel> queryFactoryMenuFunction(Map<String,Object> paramsMap) {
        return findForXml("jml_factory_staff_role.queryFactoryMenuFunction", paramsMap);
    }


    public FactoryStaffRoleModel queryProdLineOrDeptAndJobType(String staffId,String roleCode){
        Map<String,String> paramsMap = new HashMap<>();
        paramsMap.put("staffId",staffId);
        paramsMap.put("roleCode",roleCode);
        return findFirstForXml("jml_factory_staff_role.queryProdLineOrDeptAndJobType",paramsMap);
    }


    public List<FactoryStaffRoleModel> queryRepairStaffList() {
        return findForXml("jml_factory_staff_role.queryRepairStaffList");
    }



}
