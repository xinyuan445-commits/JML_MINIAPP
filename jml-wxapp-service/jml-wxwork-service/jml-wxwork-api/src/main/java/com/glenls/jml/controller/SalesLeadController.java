package com.glenls.jml.controller;

import com.glenls.commons.jboot.controller.BaseController;
import com.glenls.jml.busi.SalesLeadBusi;
import com.glenls.jml.model.MarketingModel;
import com.glenls.jml.model.SalesLeadModel;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.validator.salesLead.SalesLeadSaveValidator;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;
import com.jfinal.aop.Before;
import java.util.HashMap;
import java.util.Map;


@RequestMapping("/api/salesLead")
public class SalesLeadController extends Base4JmlAuthController {

    @Inject
    private SalesLeadBusi salesLeadBusi;

    
    public void querySalesLeadPage(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        renderJson(salesLeadBusi.queryPage(getPageNo(),getPageSize(),paramsMap));
    }

    
    public void queryListByStaff(){
        Map<String,Object> paramsMap = initQueryMap();
        renderJson(salesLeadBusi.queryListByStaff(paramsMap));
    }

    
    @Before({SalesLeadSaveValidator.class})
    public void saveSalesLead(){
        Map<String,Object> paramsMap = initQueryMap();
        SalesLeadModel model = getModel(SalesLeadModel.class,"salesLead");
        renderJson(salesLeadBusi.save(model,paramsMap));
    }

    
    public void querySalesLeadDetails(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(salesLeadBusi.queryDetails(paramsMap));
    }

    
    public void convertSalesLead(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(salesLeadBusi.convert(paramsMap));
    }

    
    public void changeStatus(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        paramsMap.put("status",getPara("status"));
        renderJson(salesLeadBusi.changeStatus(paramsMap));
    }


}
