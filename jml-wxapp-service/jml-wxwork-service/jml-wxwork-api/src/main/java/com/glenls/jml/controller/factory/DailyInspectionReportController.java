package com.glenls.jml.controller.factory;

import com.glenls.jml.busi.factory.DailyInspectionReportBusi;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.validator.factory.DailyInspectionReportSaveValidator;
import com.glenls.jml.validator.factory.JobAssignmentSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.tx.Tx;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.Map;


@RequestMapping("/api/dailyInspection")
public class DailyInspectionReportController  extends Base4JmlAuthController {

    @Inject
    private DailyInspectionReportBusi dailyInspectionReportBusi;


    @Before({DailyInspectionReportSaveValidator.class, Tx.class})
    public void save() {
        renderJson(dailyInspectionReportBusi.save(getAttr("pojo"), initQueryMap()));
    }


    public void queryPageBy() {
        Map<String, Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled", getPara("multiFiled"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));
        
        paramsMap.put("startDate", getPara("startDate"));
        paramsMap.put("endDate", getPara("endDate"));
        renderJson(dailyInspectionReportBusi.queryPageBy(getPageNo(), getPageSize(), paramsMap));
    }


    public void queryDetails() {
        Map<String, Object> paramsMap = initQueryMap();
        paramsMap.put("id", getPara("id"));
        renderJson(dailyInspectionReportBusi.queryDetails(paramsMap));
    }

    public void confirm() {
        Map<String, Object> paramsMap = initQueryMap();
        paramsMap.put("id", getPara("id"));
        paramsMap.put("type", getPara("type"));
        renderJson(dailyInspectionReportBusi.confirm(paramsMap));
    }



}
