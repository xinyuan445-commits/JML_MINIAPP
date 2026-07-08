package com.glenls.jml.controller.factory;

import com.glenls.jml.busi.factory.NitrogenLogBusi;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.validator.factory.NitrogenLogSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.tx.Tx;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.Map;


@RequestMapping("/api/nitrogenLog")
public class NitrogenLogController  extends Base4JmlAuthController {

    @Inject
    private NitrogenLogBusi nitrogenLogBusi;


    @Before({NitrogenLogSaveValidator.class, Tx.class})
    public void save(){
        renderJson(nitrogenLogBusi.save(getAttr("pojo"),initQueryMap()));
    }


    public void queryPageBy() {
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));
        
        paramsMap.put("startDate", getPara("startDate"));
        paramsMap.put("endDate", getPara("endDate"));
        renderJson(nitrogenLogBusi.queryPageBy(getPageNo(),getPageSize(),paramsMap));
    }


    public void queryDetails() {
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(nitrogenLogBusi.queryDetails(paramsMap));
    }


    public void queryBeforeLiquid() {
        renderJson(nitrogenLogBusi.queryBeforeLiquid(initQueryMap()));
    }



}
