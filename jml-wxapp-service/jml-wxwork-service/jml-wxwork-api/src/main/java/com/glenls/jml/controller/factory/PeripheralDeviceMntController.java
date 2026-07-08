package com.glenls.jml.controller.factory;

import com.glenls.jml.busi.factory.PeripheralDeviceMntBusi;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.validator.factory.PeripheralDeviceMntSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.tx.Tx;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.Map;


@RequestMapping("/api/perDeviceMnt")
public class PeripheralDeviceMntController extends Base4JmlAuthController {

    @Inject
    private PeripheralDeviceMntBusi peripheralDeviceMntBusi;


    @Before({PeripheralDeviceMntSaveValidator.class, Tx.class})
    public void save() {
        renderJson(peripheralDeviceMntBusi.save(getAttr("pojo"), initQueryMap()));
    }


    public void queryPageBy() {
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));
        
        paramsMap.put("startDate", getPara("startDate"));
        paramsMap.put("endDate", getPara("endDate"));
        renderJson(peripheralDeviceMntBusi.queryPageBy(getPageNo(), getPageSize(), paramsMap));
    }


    public void queryDetails() {
        renderJson(peripheralDeviceMntBusi.queryDetails(getPara("id")));
    }


    public void queryTpServiceProviderList() {
        renderJson(peripheralDeviceMntBusi.queryTpServiceProviderList(initQueryMap()));
    }


}
