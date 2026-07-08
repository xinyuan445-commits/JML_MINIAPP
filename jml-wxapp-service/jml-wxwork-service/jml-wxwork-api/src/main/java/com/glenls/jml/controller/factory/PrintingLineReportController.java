package com.glenls.jml.controller.factory;

import com.glenls.jml.busi.factory.PrintingLineReportBusi;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.pojo.factory.PrintingLineReportPojo;
import com.glenls.jml.validator.factory.PrintingLineReportSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.tx.Tx;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.Map;


@RequestMapping("/api/printingLineReport")
public class PrintingLineReportController extends Base4JmlAuthController {

    @Inject
    private PrintingLineReportBusi printingLineReportBusi;


    @Before({PrintingLineReportSaveValidator.class, Tx.class})
    public void save() {
        Map<String,Object> paramsMap = initQueryMap();
        PrintingLineReportPojo pojo = getAttr("pojo");
        renderJson(printingLineReportBusi.save(pojo,paramsMap));
    }


    public void queryPageBy() {
        Map<String, Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled", getPara("multiFiled"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));
        
        paramsMap.put("startDate", getPara("startDate"));
        paramsMap.put("endDate", getPara("endDate"));
        renderJson(printingLineReportBusi.queryPageBy(getPageNo(), getPageSize(), paramsMap));
    }


    public void queryDetails() {
        renderJson(printingLineReportBusi.queryDetails(getPara("id")));
    }





}
