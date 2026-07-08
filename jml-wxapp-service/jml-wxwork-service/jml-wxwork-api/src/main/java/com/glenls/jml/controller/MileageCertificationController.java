package com.glenls.jml.controller;

import com.glenls.jml.busi.MarketingBusi;
import com.glenls.jml.busi.MileageCertificationBusi;
import com.glenls.jml.model.MileageCertificationModel;
import com.glenls.jml.model.OpportunityModel;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.validator.mileageCer.SaveMileageCerValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.HashMap;
import java.util.Map;


@RequestMapping("/api/mileageCer")
public class MileageCertificationController  extends Base4JmlAuthController {

    @Inject
    private MileageCertificationBusi mileageCertificationBusi;


    public void queryMileageCerPage(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("status",getPara("status"));
        renderJson(mileageCertificationBusi.queryPage(getPageNo(),getPageSize(),paramsMap));
    }

    
    public void queryDetails(){
        renderJson(mileageCertificationBusi.queryDetails(getPara("id")));
    }


    public void queryUnEndMileageCer(){
        Map<String,Object> paramsMap = initQueryMap();
        renderJson(mileageCertificationBusi.queryUnEndMileageCer(paramsMap));
    }

    
    @Before({SaveMileageCerValidator.class})
    public void saveMileageCer(){
        Map<String,Object> paramsMap = initQueryMap();
        MileageCertificationModel model = getModel(MileageCertificationModel.class,"mileageCer");
        renderJson(mileageCertificationBusi.save(model,paramsMap));
    }

    
    public void deleteMileageCer(){
        renderJson(mileageCertificationBusi.deleteMileageCer(getPara("id")));
    }

}
