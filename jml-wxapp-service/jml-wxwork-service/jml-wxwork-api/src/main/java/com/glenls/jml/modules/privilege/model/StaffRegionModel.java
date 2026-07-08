package com.glenls.jml.modules.privilege.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_staff_region",primaryKey = "id")
public class StaffRegionModel extends DbXmlModel4Jboot<StaffRegionModel> implements IBean {


    public List<StaffRegionModel> queryByStaffId(String staffId){
        Map<String,String> paramsMap = new HashMap<>();
        paramsMap.put("staffId",staffId);

        return findForXml("jml_staff_region.queryByStaffId",paramsMap);
    }



    public List<StaffRegionModel> queryRecursiveByStaffId(String staffId){
        Map<String,String> paramsMap = new HashMap<>();
        paramsMap.put("staffId",staffId);

        return findForXml("jml_staff_region.queryRecursiveByStaffId",paramsMap);
    }

}
