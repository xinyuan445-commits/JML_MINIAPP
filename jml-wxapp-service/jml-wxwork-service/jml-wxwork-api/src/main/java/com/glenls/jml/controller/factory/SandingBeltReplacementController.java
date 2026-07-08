package com.glenls.jml.controller.factory;

import com.glenls.jml.busi.factory.SandingBeltReplacementBusi;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.pojo.factory.SandingBeltReplacementPojo;
import com.glenls.jml.validator.factory.SandingBeltReplacementSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.tx.Tx;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.Map;


@RequestMapping("/api/sandingBelt")
public class SandingBeltReplacementController extends Base4JmlAuthController {
    @Inject
    private SandingBeltReplacementBusi sandingBeltReplacementBusi;


    @Before({SandingBeltReplacementSaveValidator.class, Tx.class})
    public void save(){
        Map<String,Object> paramsMap = initQueryMap();
        SandingBeltReplacementPojo pojo = getAttr("pojo");
        renderJson(sandingBeltReplacementBusi.save(pojo,paramsMap));
    }



    public void queryDetails() {
        renderJson(sandingBeltReplacementBusi.queryDetails(getPara("id")));
    }


    public void queryPageBy() {
        Map<String, Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled", getPara("multiFiled"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));
        
        paramsMap.put("startDate", getPara("startDate"));
        paramsMap.put("endDate", getPara("endDate"));
        renderJson(sandingBeltReplacementBusi.queryPageBy(getPageNo(),getPageSize(), paramsMap));
    }

}
