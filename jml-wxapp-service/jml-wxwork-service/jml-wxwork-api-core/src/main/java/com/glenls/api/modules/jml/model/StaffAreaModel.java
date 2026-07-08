package com.glenls.api.modules.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_staff_area",primaryKey = "id")
public class StaffAreaModel extends DbXmlModel4Jboot<StaffAreaModel> implements IBean {

    
    public List<StaffAreaModel> queryByStaffId(String staffId){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("staffId",staffId);
        return findForXml("jml_staff_area.queryByStaffId",paramsMap);
    }

}
