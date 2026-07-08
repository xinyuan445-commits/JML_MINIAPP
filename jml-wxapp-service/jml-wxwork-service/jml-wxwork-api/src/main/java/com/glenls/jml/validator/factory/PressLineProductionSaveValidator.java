package com.glenls.jml.validator.factory;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.factory.PressLineDailyReportPojo;
import com.glenls.jml.pojo.factory.PressLineProductionPojo;
import com.jfinal.core.Controller;


public class PressLineProductionSaveValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        PressLineProductionPojo pojo = getPojo(PressLineProductionPojo.class);
        this.validatePojo(pojo);
        c.setAttr("pojo",pojo);
    }

    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
