package com.glenls.jml.controller;

import com.glenls.jml.busi.SalesReportBusi;
import com.glenls.jml.model.SalesReportModel;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.validator.salesReport.SalesReportSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;

import java.text.ParseException;
import java.util.Map;


@RequestMapping("/api/salesReport")
public class SalesReportController extends Base4JmlAuthController {
    
    @Inject
    private SalesReportBusi salesReportBusi;

    
    public void querySalesReportPageBy(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        paramsMap.put("accountId",getPara("accountId"));
        paramsMap.put("contactId",getPara("contactId"));
        paramsMap.put("oppId",getPara("oppId"));
        paramsMap.put("reimId",getPara("reimId"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));

        paramsMap.put("startDate", getPara("startDate"));
        paramsMap.put("endDate", getPara("endDate"));

        paramsMap.put("managerRead",getPara("managerRead"));
        paramsMap.put("tab",getPara("tab"));

        renderJson(salesReportBusi.queryPageBy(getPageNo(),getPageSize(),paramsMap));
    }

    
    public void queryListBy(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("reimId",getPara("reimId"));
        paramsMap.put("startDate", getPara("startDate"));
        paramsMap.put("endDate", getPara("endDate"));
        renderJson(salesReportBusi.queryListBy(paramsMap));
    }

    
    @Before({SalesReportSaveValidator.class})
    public void saveSalesReport(){
        Map<String,Object> paramsMap = initQueryMap();
        SalesReportModel model = getModel(SalesReportModel.class,"salesReport");
        renderJson(salesReportBusi.save(model,paramsMap));
    }
    
    public void querySalesReportDetails(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        paramsMap.put("readFlag",getPara("readFlag"));
        renderJson(salesReportBusi.queryDetails(paramsMap));
    }

    
    public void gmRead(){
        Map<String,Object> paramsMap = initQueryMap();
        renderJson(salesReportBusi.managerRead(paramsMap));
    }


    
    public void queryDayListByDate() throws ParseException {
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("date",getPara("date"));
        renderJson(salesReportBusi.queryDayListByDate(paramsMap));
    }

    
    public void queryReportNoticeByDay(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("day",getPara("day"));
        renderJson(salesReportBusi.queryReportNoticeByDay(paramsMap));
    }
    
    public void queryGmReport(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        paramsMap.put("startDate",getPara("startDate"));
        paramsMap.put("endDate",getPara("endDate"));
        paramsMap.put("isAccReport",getPara("isAccReport"));
        renderJson(salesReportBusi.queryGmReport(paramsMap));
    }

    
    public void submitReport(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(salesReportBusi.submitReport(paramsMap));
    }

    
    public void deleteReport(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(salesReportBusi.deleteReport(paramsMap));
    }
}
