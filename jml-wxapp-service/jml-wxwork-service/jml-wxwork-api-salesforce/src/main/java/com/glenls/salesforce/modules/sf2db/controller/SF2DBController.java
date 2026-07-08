package com.glenls.salesforce.modules.sf2db.controller;

import com.glenls.commons.jboot.controller.BaseController;
import com.glenls.salesforce.modules.sf2db.bean.Sf2DbDelPojo;
import com.glenls.salesforce.modules.sf2db.busi.SF2DBBusi;
import com.glenls.salesforce.modules.sf2db.validator.SF2DBDelValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;
import lombok.extern.log4j.Log4j;


@RequestMapping("/api/sf2db")
@Log4j
public class SF2DBController extends BaseController {

    @Inject
    private SF2DBBusi sf2DbBusi;


    @Before({SF2DBDelValidator.class})
    public void del(){
        Sf2DbDelPojo pojo = getAttr("pojo");
        renderJson(sf2DbBusi.del(pojo));
    }

    public void save(){
        renderJson(sf2DbBusi.save(get("code")));
    }
}
