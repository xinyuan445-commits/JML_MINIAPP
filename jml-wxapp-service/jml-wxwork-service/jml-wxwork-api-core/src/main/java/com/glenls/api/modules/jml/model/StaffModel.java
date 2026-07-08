package com.glenls.api.modules.jml.model;

import com.glenls.api.modules.pub.model.FactoryStaffRoleModel;
import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_staff",primaryKey = "id")
public class StaffModel extends DbXmlModel4Jboot<StaffModel> implements IBean {

    public static final String INITIAL_PWD ="password";

    public StaffModel queryById(String staffId){
        Map<String,String> paramsMap = new HashMap<>();
        paramsMap.put("staffId",staffId);

        return findFirstForXml("jml_staff.queryById",paramsMap);
    }


    public StaffModel queryByCode(String staffCode){
        Map<String,String> paramsMap = new HashMap<>();
        paramsMap.put("staffCode",staffCode);

        return findFirstForXml("jml_staff.queryByCode",paramsMap);
    }


    public List<StaffModel> queryRecursiveByStaffId(Map<String,Object> paramsMap){
        return findForXml("jml_staff.queryRecursiveByStaffId",paramsMap);
    }


    public List<StaffModel> queryRecursiveWithoutSelf(Map<String,Object> paramsMap){
        return findForXml("jml_staff.queryRecursiveWithoutSelf",paramsMap);
    }



    public StaffModel queryByWxworkUserId(String userid){
        Map<String,String> paramsMap = new HashMap<>();
        paramsMap.put("userid",userid);

        return findFirstForXml("jml_staff.queryByWxworkUserId",paramsMap);
    }



    public List<StaffModel> queryByMentionedUser(Map<String,Object> paramsMap){
        return findForXml("jml_staff.queryByMentionedUser",paramsMap);
    }


    public StaffModel queryByOpenIdOrUnionId(Map<String,Object> paramsMap){
        return findFirstForXml("jml_staff.queryByOpenIdOrUnionId",paramsMap);
    }

    public StaffModel login(Map<String,Object> paramsMap){
        return findFirstForXml("jml_staff.login",paramsMap);
    }


    public List<StaffModel> queryFactoryStaff() {
        return findForXml("jml_staff.queryFactoryStaff");
    }


    public List<StaffModel> queryParentStaff(Map<String,Object> paramsMap){
        return findForXml("jml_staff.queryParentStaff",paramsMap);
    }

}
