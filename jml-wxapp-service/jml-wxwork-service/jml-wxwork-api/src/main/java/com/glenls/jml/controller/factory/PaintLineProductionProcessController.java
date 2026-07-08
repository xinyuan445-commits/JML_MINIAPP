package com.glenls.jml.controller.factory;

import com.glenls.jml.busi.factory.PaintLineProductionProcessBusi;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.pojo.factory.PaintLineProductionProcessPojo;
import com.glenls.jml.validator.factory.PaintLineProductionProcessSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.tx.Tx;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.Map;


@RequestMapping("/api/paintLinProd")
public class PaintLineProductionProcessController extends Base4JmlAuthController {
    @Inject
    private PaintLineProductionProcessBusi paintLineProductionProcessBusi;


    @Before({PaintLineProductionProcessSaveValidator.class, Tx.class})
    public void save(){
        Map<String,Object> paramsMap = initQueryMap();
        PaintLineProductionProcessPojo pojo = getAttr("pojo");
        renderJson(paintLineProductionProcessBusi.save(pojo,paramsMap));
    }


    public void queryPageBy(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));
        
        paramsMap.put("startDate", getPara("startDate"));
        paramsMap.put("endDate", getPara("endDate"));
        renderJson(paintLineProductionProcessBusi.queryPageBy(getPageNo(),getPageSize(),paramsMap));
    }


    public void queryDetails(){
        renderJson(paintLineProductionProcessBusi.queryDetails(getPara("id")));
    }


}
