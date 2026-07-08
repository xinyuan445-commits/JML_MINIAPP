package com.glenls.jml.controller;

import com.glenls.commons.jboot.controller.BaseController;
import com.glenls.jml.busi.ProductBusi;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.HashMap;
import java.util.Map;


@RequestMapping("/api/product")
public class ProductController extends Base4JmlAuthController {

    @Inject
    private ProductBusi productBusi;


    public void queryProductPageBy(){
        Map<String,Object> paramsMap = new HashMap<>();

        paramsMap.put("projectId",getPara("projectId"));;
        renderJson(productBusi.queryPageBy(getPageNo(),getPageSize(),paramsMap));
    }


    public void queryProductDetails(){
        renderJson(productBusi.queryDetails(getPara("id")));
    }


    public void queryList(){
        renderJson(productBusi.queryList());
    }


}
