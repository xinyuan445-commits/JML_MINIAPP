package com.glenls.jml.controller.factory;

import com.glenls.jml.busi.factory.PressLineProductionBusi;
import com.glenls.jml.busi.factory.PrintingLineReportBusi;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.validator.factory.PressLineProductionSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.tx.Tx;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.Map;


@RequestMapping("/api/pressLineProduction")
public class PressLineProductionController extends Base4JmlAuthController {

    @Inject
    private PressLineProductionBusi pressLineProductionBusi;

    @Before({PressLineProductionSaveValidator.class, Tx.class})
    public void save(){
        renderJson(pressLineProductionBusi.save(getAttr("pojo"),initQueryMap()));
    }


    public void queryPageBy() {
        Map<String, Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled", getPara("multiFiled"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));
        
        paramsMap.put("startDate", getPara("startDate"));
        paramsMap.put("endDate", getPara("endDate"));
        renderJson(pressLineProductionBusi.queryPageBy(getPageNo(), getPageSize(), paramsMap));
    }

    public void queryDetails() {
        renderJson(pressLineProductionBusi.queryDetails(getPara("id")));
    }
}
