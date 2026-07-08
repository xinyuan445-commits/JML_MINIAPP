package com.glenls.jml.controller.factory;

import com.glenls.jml.busi.factory.NaturalGasLogBusi;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.validator.factory.NaturalGasLogSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.tx.Tx;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.Map;


@RequestMapping("/api/naturalGasLog")
public class NaturalGasLogController  extends Base4JmlAuthController {

    @Inject
    private NaturalGasLogBusi naturalGasLogBusi;


    @Before({NaturalGasLogSaveValidator.class, Tx.class})
    public void save() {
        renderJson(naturalGasLogBusi.save(getAttr("pojo"),initQueryMap()));
    }


    public void queryPageBy() {
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));
        
        paramsMap.put("startDate", getPara("startDate"));
        paramsMap.put("endDate", getPara("endDate"));
        renderJson(naturalGasLogBusi.queryPageBy(getPageNo(),getPageSize(),paramsMap));
    }

    public void queryDetails() {
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(naturalGasLogBusi.queryDetails(paramsMap));
    }


    public void queryBeforeReading() {
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(naturalGasLogBusi.queryBeforeReading(paramsMap));
    }


}
