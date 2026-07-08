package com.glenls.jml.modules.privilege.controller;

import com.glenls.api.modules.jml.pojo.StaffLoginPojo;
import com.glenls.jml.modules.privilege.busi.StaffBusi;
import com.glenls.api.modules.jml.pojo.StaffSfInPojo;
import com.glenls.jml.modules.privilege.validator.MenuFunctionValidator;
import com.glenls.jml.modules.privilege.validator.StaffLoginValidator;
import com.glenls.jml.modules.privilege.validator.StaffSfValidator;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.modules.pub.validator.StaffAuthValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Clear;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.Map;


@RequestMapping("/api/jml/staff")
public class StaffController extends Base4JmlAuthController {

    @Inject
    private StaffBusi staffBusi;


    public void menu(){
        renderJson(staffBusi.queryMenu(initQueryMap()));
    }


    @Before({MenuFunctionValidator.class})
    public void menuFunction(){
        renderJson(staffBusi.queryFunction(initQueryMap()));
    }


    public void list4SubStaff(){
        renderJson(staffBusi.querySubStaff(initQueryMap()));
    }


    public void list4SubStaffWithoutSelf(){
        renderJson(staffBusi.querySubStaffWithoutSelf(initQueryMap()));
    }


    public void list4FactorySubStaffWithoutSelf(){
        Map<String,Object> paramsMap = initQueryMap();
        renderJson(staffBusi.queryFactorySubStaffWithOutSelf(paramsMap));
    }


    public void list4FactoryRoleStaff() {
        renderJson(staffBusi.queryFactoryStaff());
    }


    public void list4Repairer() {
        renderJson(staffBusi.queryRepairStaffList());
    }


    public void list4ParentStaff() {
        Map<String,Object> paramsMap = initQueryMap();
        renderJson(staffBusi.queryParentStaffList(paramsMap));
    }


    @Clear({StaffAuthValidator.class})
    @Before({StaffSfValidator.class})
    public void sfSaveStaffInfo(){
        StaffSfInPojo pojo = getAttr("pojo");
        renderJson(staffBusi.sfSaveStaffInfo(pojo));
    }


    @Clear({StaffAuthValidator.class})
    @Before({StaffLoginValidator.class})
    public void login(){
        StaffLoginPojo pojo = getAttr("pojo");
        renderJson(staffBusi.login(pojo));
    }


    public void resetPwd(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("newPwd",getPara("newPwd"));
        renderJson(staffBusi.resetPwd(paramsMap));
    }


    @Clear({StaffAuthValidator.class})
    @Before({StaffSfValidator.class})
    public void sfSaveStaffInfo2(){
        StaffSfInPojo pojo = getAttr("pojo");
        renderJson(staffBusi.sfSaveStaffInfo2(pojo));
    }


    @Clear({StaffAuthValidator.class})
    public void sfResetPwd(){
        renderJson(staffBusi.sfResetPwd(getPara("id")));
    }


    public void loginOut(){
        Map<String,Object> paramsMap = initQueryMap();
        renderJson(staffBusi.loginOut(paramsMap));
    }


    public void factoryMenu(){
        Map<String,Object> paramsMap = initQueryMap();
        renderJson(staffBusi.factoryMenu(paramsMap));
    }


    public void factoryMenuFunction() {
        Map<String, Object> paramsMap = initQueryMap();
        renderJson(staffBusi.factoryMenuFunction(paramsMap));
    }


}
