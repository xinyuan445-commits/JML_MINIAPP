package com.glenls.jml.modules.privilege.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.List;
import java.util.Map;


@Table(tableName = "jml_role_function",primaryKey = "id")
public class RoleFunctionModel extends DbXmlModel4Jboot<RoleFunctionModel> implements IBean {


    public List<RoleFunctionModel> queryByStaffId(Map<String,Object> paramsMap){
        return findForXml("jml_role_function.queryByStaffId",paramsMap);
    }


    public RoleFunctionModel queryStaffFuncAuth(Map<String,Object> paramsMap){
        return findFirstForXml("jml_role_function.queryStaffFuncAuth",paramsMap);
    }
}
