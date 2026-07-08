package com.glenls.jml.controller.factory;

import com.glenls.jml.busi.factory.ElectricityLogBusi;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.validator.factory.ElectricityLogSaveValidator;
import com.glenls.jml.validator.factory.NaturalGasLogSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.tx.Tx;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.Map;


@RequestMapping("/api/electricityLog")
public class ElectricityLogController extends Base4JmlAuthController {

    @Inject
    private ElectricityLogBusi electricityLogBusi;


    @Before({ElectricityLogSaveValidator.class, Tx.class})
    public void save() {
        renderJson(electricityLogBusi.save(getAttr("pojo"),initQueryMap()));
    }


    public void queryPageBy() {
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));
        
        paramsMap.put("startDate", getPara("startDate"));
        paramsMap.put("endDate", getPara("endDate"));
        renderJson(electricityLogBusi.queryPageBy(getPageNo(),getPageSize(),paramsMap));
    }

    public void queryDetails() {
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(electricityLogBusi.queryDetails(paramsMap));
    }


    public void queryBeforeReading() {
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("electricityType",getPara("electricityType"));
        renderJson(electricityLogBusi.queryBeforeReading(paramsMap));
    }


}
