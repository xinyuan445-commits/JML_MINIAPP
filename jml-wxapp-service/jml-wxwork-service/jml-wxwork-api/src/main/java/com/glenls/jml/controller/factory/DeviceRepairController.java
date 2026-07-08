package com.glenls.jml.controller.factory;

import com.glenls.jml.busi.factory.DeviceRepairBusi;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.validator.factory.*;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.tx.Tx;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.Map;


@RequestMapping("/api/deviceRepair")
public class DeviceRepairController extends Base4JmlAuthController {
    @Inject
    private DeviceRepairBusi deviceRepairBusi;

    private DeviceRepairBusi deviceRepairBusi2;


    @Before({DeviceRepairSaveValidator.class, Tx.class})
    public void submit() {
        renderJson(deviceRepairBusi.submit(getAttr("pojo"), initQueryMap()));
    }


    public void queryPageBy() {
        Map<String, Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled", getPara("multiFiled"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));
        
        paramsMap.put("startDate", getPara("startDate"));
        paramsMap.put("endDate", getPara("endDate"));
        
        paramsMap.put("roleCode", getPara("roleCode"));
        
        paramsMap.put("repairerStaffId", getPara("repairerStaffId"));
        
        paramsMap.put("prodLineOrDept", getPara("prodLineOrDept"));
        renderJson(deviceRepairBusi.queryPageBy(getPageNo(), getPageSize(), initQueryMap()));
    }


    public void queryDetails() {
        Map<String, Object> paramsMap = initQueryMap();
        paramsMap.put("id", getPara("id"));
        paramsMap.put("roleCode", getPara("roleCode"));
        renderJson(deviceRepairBusi.queryDetails(paramsMap));
    }


    @Before({DeviceRepairAssignValidator.class, Tx.class})
    public void assign() {
        renderJson(deviceRepairBusi.assign(getAttr("pojo"), initQueryMap()));
    }


    @Before({DeviceRepairRepairValidator.class, Tx.class})
    public void repair() {
        renderJson(deviceRepairBusi.repair(getAttr("pojo"), initQueryMap()));
    }


    @Before({DeviceRepairCompleteValidator.class, Tx.class})
    public void complete() {
        renderJson(deviceRepairBusi.complete(getAttr("pojo"), initQueryMap()));
    }


    @Before({DeviceRepairCancelValidator.class, Tx.class})
    public void cancel() {
        renderJson(deviceRepairBusi.cancel(getAttr("pojo"), initQueryMap()));
    }

    @Before({DeviceRepairConfirmValidator.class, Tx.class})
    public void confirm() {
        renderJson(deviceRepairBusi.confirm(getAttr("pojo"), initQueryMap()));
    }


    public void queryDevices() {
        renderJson(deviceRepairBusi.queryDevices());
    }


    public void accept() {
        Map<String, Object> paramsMap = initQueryMap();
        paramsMap.put("id", getPara("id"));
        renderJson(deviceRepairBusi.accept(paramsMap));
    }

}
