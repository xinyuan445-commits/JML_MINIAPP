package com.glenls.jml.controller;

import com.glenls.commons.jboot.controller.BaseController;
import com.glenls.jml.busi.MarketingBusi;
import com.glenls.jml.busi.MarketingMemberBusi;
import com.glenls.jml.model.MarketingMemberModel;
import com.glenls.jml.model.MarketingModel;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.HashMap;
import java.util.Map;


@RequestMapping("/api/marketing")
public class MarketingController  extends Base4JmlAuthController {


    @Inject
    private MarketingBusi marketingBusi;


    @Inject
    private MarketingMemberBusi marketingMemberBusi;


    public void queryMarketingPage(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        renderJson(marketingBusi.queryPage(getPageNo(),getPageSize(),paramsMap));
    }


    public void queryListByStaff(){
        Map<String,Object> paramsMap = initQueryMap();
        renderJson(marketingBusi.queryListByStaff(paramsMap));
    }


    public void saveMarketing(){
        Map<String,Object> paramsMap = initQueryMap();
        MarketingModel model = getModel(MarketingModel.class,"marketing");
        renderJson(marketingBusi.save(model,paramsMap));
    }


    public void queryMarketingDetails(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(marketingBusi.queryDetails(paramsMap));
    }


    public void queryMemberPageBy(){
        Map<String,Object> paramsMap = initQueryMap();
        
        paramsMap.put("marketingId",getPara("marketingId"));
        
        paramsMap.put("salesLeadId",getPara("salesLeadId"));
        
        paramsMap.put("contactId",getPara("contactId"));
        renderJson(marketingMemberBusi.queryPageBy(getPageNo(),getPageSize(),paramsMap));
    }


    public void saveMember(){
        Map<String,Object> paramsMap = initQueryMap();
        MarketingMemberModel model = getModel(MarketingMemberModel.class,"member");
        renderJson(marketingMemberBusi.save(model,paramsMap));
    }


    public void queryMemberDetails(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(marketingMemberBusi.queryDetails(paramsMap));
    }
}
