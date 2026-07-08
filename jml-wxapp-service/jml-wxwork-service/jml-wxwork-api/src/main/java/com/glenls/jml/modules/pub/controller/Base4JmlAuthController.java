package com.glenls.jml.modules.pub.controller;

import cn.hutool.core.util.StrUtil;
import com.glenls.jml.modules.privilege.kit.RoleKit;
import com.glenls.api.modules.jml.model.StaffModel;
import com.glenls.jml.modules.privilege.model.StaffRegionModel;
import com.glenls.jml.modules.privilege.model.StaffRoleModel;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.validator.FunctionAuthValidator;
import com.glenls.jml.modules.pub.validator.StaffAuthValidator;
import com.jfinal.aop.Before;
import com.jfinal.json.Jackson;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Before({StaffAuthValidator.class, FunctionAuthValidator.class})
public class Base4JmlAuthController extends Base4JmlController {


    protected StaffPojo initQueryPojo(){
        return RoleKit.initStaffInfo(getStaffId());
    }



    protected Map<String,Object> initQueryMap(){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("staff",initQueryPojo());
        paramsMap.put("staffId",getStaffId());
        paramsMap.put("areaCode",getAreaCode());
        paramsMap.put("regionCode",getRegionCode());
        paramsMap.put("staffName",getStaffName());
        paramsMap.put("userId",getUserId());
        paramsMap.putAll(getParamsMap());

        return paramsMap;
    }


    protected StaffModel getStaffModel(){
        StaffPojo pojo = initQueryPojo();
        return pojo != null ? pojo.getStaffObj() : null;
    }


    protected <T> T getStaffAttr(String key){
        StaffModel model = getStaffModel();
        if(model == null){
            return null;
        }

        return model.get(key);
    }


    protected String getStaffEmail(){
        return getStaffAttr("email");
    }


    protected String getDept(){
        return getStaffAttr("department");
    }


    protected String getPosition(){
        return getStaffAttr("position");
    }


    protected String getMobile(){
        return getStaffAttr("mobile");
    }


    public String getAreaCode(){
        return getStaffAttr("area_code");
    }


    public String getRegionCode(){
        return getStaffAttr("region_code");
    }


    public String getStaffName(){
        return getStaffAttr("name");
    }


    public String getUserId(){
        return getStaffAttr("user_id");
    }


    public List<StaffRegionModel> getManageRegion(){
        StaffPojo pojo = initQueryPojo();
        return pojo != null ? pojo.getRegionList() : null;
    }


    public List<StaffRoleModel> getHaveRole(){
        StaffPojo pojo = initQueryPojo();
        return pojo != null ? pojo.getRoleList() : null;
    }
}
