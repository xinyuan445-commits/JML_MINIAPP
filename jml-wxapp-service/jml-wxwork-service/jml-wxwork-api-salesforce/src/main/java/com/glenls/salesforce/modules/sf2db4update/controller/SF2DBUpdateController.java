package com.glenls.salesforce.modules.sf2db4update.controller;

import com.glenls.commons.jboot.controller.BaseController;
import com.glenls.salesforce.modules.db2sf4updatesfid.busi.CommUpdateSfIdBusi;
import com.glenls.salesforce.modules.sf2db.bean.Sf2DbDelPojo;
import com.glenls.salesforce.modules.sf2db.busi.SF2DBBusi;
import com.glenls.salesforce.modules.sf2db.validator.SF2DBDelValidator;
import com.glenls.salesforce.modules.sf2db4update.busi.SF2DBUpdateBusi;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;
import lombok.extern.log4j.Log4j;


@RequestMapping("/api/sf2dbupdate")
@Log4j
public class SF2DBUpdateController extends BaseController {

    @Inject
    private SF2DBUpdateBusi sf2DbBusi;

    @Inject
    private CommUpdateSfIdBusi commUpdateSfIdBusi;

    public void save(){
        renderJson(sf2DbBusi.save(get("code")));
    }


    public void testUpdate(){
        renderJson(commUpdateSfIdBusi.updateSalesReportByRemId());
    }
}
