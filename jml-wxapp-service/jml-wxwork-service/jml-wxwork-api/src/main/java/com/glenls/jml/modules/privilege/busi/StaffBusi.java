package com.glenls.jml.modules.privilege.busi;

import cn.hutool.core.collection.ListUtil;
import cn.hutool.core.util.ObjUtil;
import cn.hutool.crypto.digest.DigestUtil;
import com.alibaba.fastjson.JSON;
import com.glenls.api.modules.jml.model.*;
import com.glenls.api.modules.jml.pojo.*;
import com.glenls.api.modules.pub.model.FactoryStaffRoleModel;
import com.glenls.jml.model.SalesReportModel;
import com.glenls.jml.model.StaffLoginHistoryModel;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.jml.modules.privilege.model.*;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.wxwork.busi.WxWorkUserSyncBusi;
import com.glenls.wxwork.pojo.user.WxworkUserPojo;
import com.jfinal.aop.Inject;
import io.jboot.Jboot;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Slf4j
public class StaffBusi {

    @Inject
    private StaffModel staffDao;

    @Inject
    private StaffAreaModel staffAreaDao;

    @Inject
    private RoleMenuModel roleMenuDao;

    @Inject
    private RoleFunctionModel roleFunctionDao;

    @Inject
    private FunctionModel functionDao;

    @Inject
    private SalesReportModel salesReportDao;

    @Inject
    private StaffRegionModel staffRegionDao;

    @Inject
    private StaffRoleModel staffRoleDao;

    @Inject
    private FactoryStaffRoleModel factoryStaffRoleDao;

    @Inject
    private WxWorkUserSyncBusi wxWorkUserSyncBusi;

    @Inject
    private StaffLoginHistoryModel staffLoginHistoryDao;

    @Inject
    private FactoryStaffRoleModel factoryStaffDao;

    
    private static final String STAFF_CACHE_KEY = "staff:";

    
    public RestApiResult queryById(String staffId) {
        StaffModel model = staffDao.queryById(staffId);

        return model == null ? RestApiResult.newFail("员工不存在") : RestApiResult.newSuccessWithData(model);
    }

    
    public RestApiResult queryByCode(String staffCode) {
        StaffModel model = staffDao.queryByCode(staffCode);

        return model == null ? RestApiResult.newFail("员工不存在") : RestApiResult.newSuccessWithData(model);
    }

    
    public RestApiResult queryMenu(Map<String, Object> paramsMap) {
        List<RoleMenuModel> roleMenuModelList = roleMenuDao.queryByStaffId(paramsMap);
        for (RoleMenuModel roleMenuModel : roleMenuModelList) {
            StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
            if (roleMenuDao.SALES_REPORT.equals(roleMenuModel.get("menu_code")) && staffPojo.isRoleRM()) {
                List<SalesReportModel> salesReportModelList = salesReportDao.queryUnRedListByRM(paramsMap);
                if (salesReportModelList.size() > 0) {
                    roleMenuModel.put("gmRead", "1");
                } else {
                    roleMenuModel.put("gmRead", "0");
                }
            }
        }
        return RestApiResult.newSuccessWithData(roleMenuModelList);
    }

    
    public RestApiResult queryFunction(Map<String, Object> paramsMap) {
        return RestApiResult.newSuccessWithData(roleFunctionDao.queryByStaffId(paramsMap));
    }

    
    public RestApiResult checkActionAuth(String actionKey, String staffId) {
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("actionUrl", actionKey);
        paramsMap.put("staffId", staffId);

        FunctionModel functionModel = functionDao.queryByActionUrl(paramsMap);
        if (functionModel == null) {
            return RestApiResult.newSuccess();
        }

        RoleFunctionModel roleFunctionModel = roleFunctionDao.queryStaffFuncAuth(paramsMap);
        if (roleFunctionModel == null) {
            return RestApiResult.newFail("无改接口的请求权限");
        }

        return RestApiResult.newSuccess();
    }

    
    public RestApiResult querySubStaff(Map<String, Object> paramsMap) {
        return RestApiResult.newSuccessWithData(staffDao.queryRecursiveByStaffId(paramsMap));
    }

    
    public RestApiResult querySubStaffWithoutSelf(Map<String, Object> paramsMap) {
        return RestApiResult.newSuccessWithData(staffDao.queryRecursiveWithoutSelf(paramsMap));
    }

    
    public RestApiResult queryFactorySubStaffWithOutSelf(Map<String, Object> paramsMap) {
        return RestApiResult.newSuccessWithData(factoryStaffRoleDao.queryFactorySubStaffWithOutSelf(paramsMap));
    }



    
    public RestApiResult factoryMenu(Map<String, Object> paramsMap) {
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        List<FactoryStaffRoleModel> factoryStaffRoleModelList = factoryStaffRoleDao.queryFactoryStaffFuncByStaffId(staffPojo.getStaffId());
        return RestApiResult.newSuccessWithData(factoryStaffRoleModelList);
    }

    
    public RestApiResult queryFactoryStaff() {
        return RestApiResult.newSuccessWithData(staffDao.queryFactoryStaff());
    }

    public RestApiResult factoryMenuFunction(Map<String, Object> paramsMap) {
        return RestApiResult.newSuccessWithData(factoryStaffRoleDao.queryFactoryMenuFunction(paramsMap));
    }
    
    public RestApiResult queryRepairStaffList() {
        return RestApiResult.newSuccessWithData(factoryStaffRoleDao.queryRepairStaffList());
    }

    
    public RestApiResult queryParentStaffList(Map<String,Object> paramsMap) {
        return RestApiResult.newSuccessWithData(staffDao.queryParentStaff(paramsMap));
    }


    
    public RestApiResult sfSaveStaffInfo(StaffSfInPojo pojo) {
        StaffModel staffModel = new StaffModel();
        staffModel.set("id", pojo.getId());
        staffModel.set("name", pojo.getName());
        staffModel.set("area_code", pojo.getAreaCode());
        staffModel.set("region_code", pojo.getRegionCode());
        staffModel.set("parent_id", pojo.getParentId());
        staffModel.set("employ_id", pojo.getEmployeeId());
        staffModel.set("status", pojo.getStatus());
        staffModel.set("email", pojo.getEmail());
        staffModel.set("mobile", pojo.getMobile());
        staffModel.set("gender", pojo.getGender());
        staffModel.set("department", ListUtil.of(pojo.getDepartment()).toString());
        staffModel.set("position", pojo.getPosition());
        staffModel.set("entry_date", pojo.getEntryDate());
        staffModel.set("leaving_date", pojo.getLeavingDate());
        String userId = pojo.getMobile();

        Map<String, String> paramsMap4QueryWxWorkUser = new HashMap<>();
        paramsMap4QueryWxWorkUser.put("mobile", pojo.getMobile());
        paramsMap4QueryWxWorkUser.put("email", pojo.getEmail());

        RestApiResult restApiResult4QueryUser = wxWorkUserSyncBusi.queryUserBy(paramsMap4QueryWxWorkUser);
        log.info("restApiResult4QueryUser->" + JSON.toJSONString(restApiResult4QueryUser));
        if (restApiResult4QueryUser.isSuccess()) {
            userId = (String) restApiResult4QueryUser.getData();
        }

        staffModel.set("userid", userId);
        Map<String, String> retMap = new HashMap();
        retMap.put("userId", userId);
        WxworkUserPojo wxworkUserPojo = new WxworkUserPojo();
        wxworkUserPojo.setUserid(userId);
        wxworkUserPojo.setName(pojo.getName());
        wxworkUserPojo.setDepartment(ListUtil.of(pojo.getDepartment()));
        wxworkUserPojo.setMobile(pojo.getMobile());
        wxworkUserPojo.setEmail(pojo.getEmail());
        wxworkUserPojo.setPosition(pojo.getPosition());
        wxworkUserPojo.setEnable(pojo.getStatus());
        wxWorkUserSyncBusi.createUser(wxworkUserPojo);

        if (ObjectUtils.isEmpty(staffDao.findById(pojo.getId()))) {
            staffModel.save();
        } else {
            staffModel.update();
        }
        if (pojo.getRegionList().size() > 0) {
            for (StaffRegionSfInPojo regionSfInPojo : pojo.getRegionList()) {
                StaffRegionModel regionModel = new StaffRegionModel();
                regionModel.set("id", regionSfInPojo.getId());
                regionModel.set("staff_id", regionSfInPojo.getStaffId());
                regionModel.set("staff_name", regionSfInPojo.getStaffName());
                regionModel.set("region_id", regionSfInPojo.getRegionId());
                regionModel.set("region_code", regionSfInPojo.getRegionCode());
                regionModel.set("enable", regionSfInPojo.getEnabled());
                if (ObjectUtils.isEmpty(staffRegionDao.findById(regionSfInPojo.getId()))) {
                    regionModel.save();
                } else {
                    regionModel.update();
                }
            }
        }
        if (pojo.getRoleList().size() > 0) {
            for (StaffRoleSfInPojo roleSfInPojo : pojo.getRoleList()) {
                StaffRoleModel roleModel = new StaffRoleModel();
                roleModel.set("id", roleSfInPojo.getId());
                roleModel.set("role_id", roleSfInPojo.getRoleId());
                roleModel.set("role_name", roleSfInPojo.getRoleName());
                roleModel.set("staff_id", roleSfInPojo.getStaffId());
                roleModel.set("staff_name", roleSfInPojo.getStaffName());
                roleModel.set("enable", roleSfInPojo.getEnable());
                if (ObjectUtils.isEmpty(staffRoleDao.findById(roleSfInPojo.getId()))) {
                    roleModel.save();
                } else {
                    roleModel.update();
                }
            }
        }

        return RestApiResult.newSuccess("员工保存成功", retMap);
    }

    
    public RestApiResult login(StaffLoginPojo pojo) {
        Map<String, Object> loginMap = new HashMap<>();
        loginMap.put("mobile", pojo.getMobile());
        loginMap.put("pwd", DigestUtil.md5Hex(pojo.getPwd()));
        StaffModel staffModel = staffDao.login(loginMap);

        
        StaffLoginHistoryModel loginHistoryModel = new StaffLoginHistoryModel();
        loginHistoryModel.set("mobile", pojo.getMobile());
        loginHistoryModel.set("openid", pojo.getOpenId());
        loginHistoryModel.set("unionid", pojo.getUnionId());
        loginHistoryModel.set("user_agent", pojo.getUserAgent());
        loginHistoryModel.set("device", pojo.getDevice());

        if (ObjectUtils.isEmpty(staffModel)) {
            loginHistoryModel.set("mobile", pojo.getMobile());
            loginHistoryModel.set("login_result", "登录失败，用户名或密码错误！");
            loginHistoryModel.save();
            return RestApiResult.newFail("登录失败，用户名或密码错误！");
        }
        if (StringUtils.isEmpty(staffModel.get("openid"))) {
            staffModel.set("openid", pojo.getOpenId());
        }
        if (StringUtils.isEmpty(staffModel.get("openid"))) {
            staffModel.set("openid", pojo.getOpenId());
        }
        if (StringUtils.isEmpty(staffModel.get("unionid"))) {
            staffModel.set("unionid", pojo.getUnionId());
        }
        loginHistoryModel.set("login_result", "登录成功！");
        loginHistoryModel.set("staff_id", staffModel.get("id"));
        loginHistoryModel.save();
        staffModel.update();
        
        if(factoryStaffDao.queryByStaffId(staffModel.get("id"))!=null){
            staffModel.put("isFactory","1");
        }
        staffModel.put("staffAreaList",staffAreaDao.queryByStaffId(staffModel.get("id").toString()));

        return RestApiResult.newSuccess("登录成功", staffModel);
    }

    
    public RestApiResult sfSaveStaffInfo2(StaffSfInPojo pojo) {
        String staffId = pojo.getId();
        StaffModel staffModel = new StaffModel();
        staffModel.set("id", pojo.getId());
        staffModel.set("name", pojo.getName());
        staffModel.set("area_code", pojo.getAreaCode());
        staffModel.set("region_code", pojo.getRegionCode());
        staffModel.set("parent_id", pojo.getParentId());
        staffModel.set("employ_id", pojo.getEmployeeId());
        staffModel.set("status", pojo.getStatus());
        staffModel.set("email", pojo.getEmail());
        staffModel.set("mobile", pojo.getMobile());
        staffModel.set("gender", pojo.getGender());
        staffModel.set("position", pojo.getPosition());
        staffModel.set("entry_date", pojo.getEntryDate());
        staffModel.set("leaving_date", pojo.getLeavingDate());
        staffModel.set("factory_code", pojo.getFactoryCode());
        staffModel.set("is_admin", pojo.getIsAdmin());
        staffModel.set("factory_m_role", pojo.getFactoryMRole());
        if (ObjectUtils.isEmpty(staffDao.findById(pojo.getId()))) {
            staffModel.set("userid", pojo.getMobile());
            staffModel.set("pwd", DigestUtil.md5Hex(StaffModel.INITIAL_PWD));
            staffModel.save();
        } else {
            staffModel.set("is_reset", JmlKit.FLAG_1);
            staffModel.update();
        }
        
        if(!pojo.getAreaList().isEmpty()){
            for (StaffAreaSfInPojo areaSfInPojo : pojo.getAreaList()) {
                StaffAreaModel areaModel = new StaffAreaModel();
                areaModel.set("id", areaSfInPojo.getId());
                areaModel.set("staff_id", areaSfInPojo.getStaffId());
                areaModel.set("staff_name", areaSfInPojo.getStaffName());
                areaModel.set("area_id", areaSfInPojo.getAreaId());
                areaModel.set("area_code", areaSfInPojo.getAreaCode());
                areaModel.set("area_name", areaSfInPojo.getAreaName());
                areaModel.set("enable", areaSfInPojo.getEnable());
                if (ObjectUtils.isEmpty(staffAreaDao.findById(areaSfInPojo.getId()))) {
                    areaModel.save();
                } else {
                    areaModel.update();
                }
            }
        }
        
        if (!pojo.getRoleList().isEmpty()) {
            for (StaffRoleSfInPojo roleSfInPojo : pojo.getRoleList()) {
                StaffRoleModel roleModel = new StaffRoleModel();
                roleModel.set("id", roleSfInPojo.getId());
                roleModel.set("role_id", roleSfInPojo.getRoleId());
                roleModel.set("role_name", roleSfInPojo.getRoleName());
                roleModel.set("staff_id", roleSfInPojo.getStaffId());
                roleModel.set("staff_name", roleSfInPojo.getStaffName());
                roleModel.set("enable", roleSfInPojo.getEnable());
                if (ObjectUtils.isEmpty(staffRoleDao.findById(roleSfInPojo.getId()))) {
                    roleModel.save();
                } else {
                    roleModel.update();
                }
            }
        }
        
        if(!pojo.factoryRoleList.isEmpty()){
            for(StaffFactoryRole staffFactoryRolePojo:pojo.factoryRoleList){
                FactoryStaffRoleModel factoryStaffRoleModel = new FactoryStaffRoleModel();
                factoryStaffRoleModel.set("id",staffFactoryRolePojo.getId());
                factoryStaffRoleModel.set("factory_role_id",staffFactoryRolePojo.getFactoryRoleId());
                factoryStaffRoleModel.set("factory_role_name",staffFactoryRolePojo.getFactoryRoleName());
                factoryStaffRoleModel.set("staff_id",staffFactoryRolePojo.getStaffId());
                factoryStaffRoleModel.set("staff_name",staffFactoryRolePojo.getStaffName());
                factoryStaffRoleModel.set("prod_line_or_dept",staffFactoryRolePojo.getProdLineOrDept());
                factoryStaffRoleModel.set("job_type",staffFactoryRolePojo.getJobType());
                factoryStaffRoleModel.set("role_code",staffFactoryRolePojo.getRoleCode());
                factoryStaffRoleModel.set("role_type",staffFactoryRolePojo.getRoleType());
                factoryStaffRoleModel.set("enable",staffFactoryRolePojo.getEnable());
                if (ObjectUtils.isEmpty(factoryStaffRoleDao.findById(staffFactoryRolePojo.getId()))) {
                    factoryStaffRoleModel.save();
                } else {
                    factoryStaffRoleModel.update();
                }
            }
        }

        
        if(Jboot.getRedis().exists(new StringBuffer(STAFF_CACHE_KEY).append(staffId).toString())){
            Jboot.getRedis().del(new StringBuffer(STAFF_CACHE_KEY).append(staffId).toString());
        }

        return RestApiResult.newSuccess("员工保存成功");
    }

    
    public RestApiResult resetPwd(Map<String,Object> paramsMap){
        if(ObjectUtils.isEmpty(paramsMap.get("staffId"))){
            return RestApiResult.newSuccess("员工Id为空");
        }
        if(ObjectUtils.isEmpty(paramsMap.get("newPwd"))){
            return RestApiResult.newSuccess("新密码为空");
        }
        StaffModel staffModel = staffDao.findById(paramsMap.get("staffId").toString());
        if(ObjectUtils.isEmpty(staffModel)){
           return RestApiResult.newFail("员工不存在");
        }
        String newPwd = DigestUtil.md5Hex(String.valueOf(paramsMap.get("newPwd")));
        staffModel.set("pwd",newPwd);
        staffModel.set("openid","");
        staffModel.set("unionid","");
        staffModel.update();
        return RestApiResult.newSuccess("重置密码成功",staffModel);
    }


    
    public RestApiResult sfResetPwd(String id){
        if(StringUtils.isEmpty(id)){
            return RestApiResult.newSuccess("员工Id为空");
        }
        StaffModel staffModel = staffDao.findById(id);
        if(ObjectUtils.isEmpty(staffModel)){
            return RestApiResult.newFail("员工不存在，请联系管理员");
        }
        staffModel.set("is_reset", JmlKit.FLAG_1);
        staffModel.set("pwd",DigestUtil.md5Hex(StaffModel.INITIAL_PWD));
        staffModel.set("openid","");
        staffModel.set("unionid","");
        staffModel.update();
        
        if(Jboot.getRedis().exists(new StringBuffer(STAFF_CACHE_KEY).append(id).toString())){
            Jboot.getRedis().del(new StringBuffer(STAFF_CACHE_KEY).append(id).toString());
        }
        return RestApiResult.newSuccess("重置密码成功");
    }


    public RestApiResult loginOut(Map<String,Object> paramsMap){
        StaffModel staffModel = staffDao.findById(paramsMap.get("staffId").toString());
        if(ObjectUtils.isEmpty(staffModel)){
            return RestApiResult.newFail("员工不存在");
        }
        staffModel.set("openid","");
        staffModel.set("unionid","");
        staffModel.update();
        return RestApiResult.newSuccess("登出成功");
    }






}
