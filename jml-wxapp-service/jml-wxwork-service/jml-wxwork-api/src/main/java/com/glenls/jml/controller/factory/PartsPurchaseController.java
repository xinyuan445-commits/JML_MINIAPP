package com.glenls.jml.controller.factory;

import com.glenls.jml.busi.factory.PartsPurchaseBusi;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.validator.factory.PartsPurchaseApprovalValidator;
import com.glenls.jml.validator.factory.PartsPurchaseSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.tx.Tx;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.Map;


@RequestMapping("/api/partsPurchase")
public class PartsPurchaseController  extends Base4JmlAuthController {
    @Inject
    private PartsPurchaseBusi partsPurchaseBusi;


    @Before({PartsPurchaseSaveValidator.class, Tx.class})
    public void save(){
        renderJson(partsPurchaseBusi.save(getAttr("pojo"),initQueryMap()));
    }


    public void queryPageBy() {
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));
        
        paramsMap.put("startDate", getPara("startDate"));
        paramsMap.put("endDate", getPara("endDate"));
        paramsMap.put("approvalStatus", getPara("approvalStatus"));
        paramsMap.put("prodLineOrDept", getPara("prodLineOrDept"));
        renderJson(partsPurchaseBusi.queryPageBy(getPageNo(),getPageSize(),paramsMap));
    }


    public void queryDetails() {
        Map<String, Object> paramsMap = initQueryMap();
        paramsMap.put("id", getPara("id"));
        renderJson(partsPurchaseBusi.queryDetails(paramsMap));
    }


    @Before({PartsPurchaseApprovalValidator.class, Tx.class})
    public void approval(){
        renderJson(partsPurchaseBusi.approval(getAttr("pojo"),initQueryMap()));
    }
}
