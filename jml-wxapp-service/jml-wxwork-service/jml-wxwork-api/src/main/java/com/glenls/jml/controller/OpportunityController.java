package com.glenls.jml.controller;

import com.glenls.commons.jboot.controller.BaseController;
import com.glenls.jml.busi.OppProductBusi;
import com.glenls.jml.busi.OpportunityBusi;
import com.glenls.jml.model.ContactModel;
import com.glenls.jml.model.OppProductModel;
import com.glenls.jml.model.OpportunityModel;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.validator.opportunity.OpportunitySaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.HashMap;
import java.util.Map;


@RequestMapping("/api/opportunity")
public class OpportunityController extends Base4JmlAuthController {
    @Inject
    private OpportunityBusi opportunityBusi;

    @Inject
    private OppProductBusi oppProductBusi;

    
    public void queryOpportunityPageBy(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        paramsMap.put("accountId",getPara("accountId"));
        renderJson(opportunityBusi.queryPageBy(getPageNo(),getPageSize(),paramsMap));
    }

    
    public void queryListByStaff(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("staffId",getPara("staffId"));
        renderJson(opportunityBusi.queryListByStaff(paramsMap));
    }

    
    @Before({OpportunitySaveValidator.class})
    public void saveOpportunity(){
        Map<String,Object> paramsMap = initQueryMap();
        OpportunityModel model = getModel(OpportunityModel.class,"opp");
        renderJson(opportunityBusi.save(model,paramsMap));
    }

    
    public void queryOpportunityDetails(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(opportunityBusi.queryDetails(paramsMap));
    }

    
    public void queryOppProductPageBy(){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("oppId",getPara("oppId"));
        renderJson(oppProductBusi.queryPageBy(getPageNo(),getPageSize(),paramsMap));
    }

    
    public void queryOppProductDetails(){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",getPara("id"));
        renderJson(oppProductBusi.queryDetails(paramsMap));
    }


    
    public void saveOppProduct(){
        Map<String,Object> paramsMap = initQueryMap();
        OppProductModel model = getModel(OppProductModel.class,"oppProduct");
        renderJson(oppProductBusi.save(model,paramsMap));
    }

    
    public void changeStage(){
        Map<String,Object> paramsMap = initQueryMap();
        renderJson(opportunityBusi.changeStage(paramsMap));
    }
    
    
}
