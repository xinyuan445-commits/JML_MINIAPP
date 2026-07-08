package com.glenls.jml.controller.factory;

import com.glenls.jml.busi.factory.PressLineDailyReportBusi;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.pojo.factory.PressLineDailyReportPojo;
import com.glenls.jml.pojo.factory.PrintingLineReportPojo;
import com.glenls.jml.validator.factory.PressLineDailyReportSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.tx.Tx;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.Map;


@RequestMapping("/api/pressLineReport")
public class PressLineDailyReportController extends Base4JmlAuthController {

    @Inject
    private PressLineDailyReportBusi pressLineDailyReportBusi;

    
    @Before({PressLineDailyReportSaveValidator.class, Tx.class})
    public void save(){
        PressLineDailyReportPojo pojo = getAttr("pojo");
        renderJson(pressLineDailyReportBusi.save(pojo,initQueryMap()));
    }
    
    public void queryPageBy() {
        Map<String, Object> paramsMap = initQueryMap();
        paramsMap.put("pressLineType", getPara("pressLineType"));
        paramsMap.put("multiFiled", getPara("multiFiled"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));
        
        paramsMap.put("startDate", getPara("startDate"));
        paramsMap.put("endDate", getPara("endDate"));
        renderJson(pressLineDailyReportBusi.queryPageBy(getPageNo(), getPageSize(), paramsMap));
    }

    
    public void queryDetails() {
        renderJson(pressLineDailyReportBusi.queryDetails(getPara("id")));

    }



}
