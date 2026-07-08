package com.glenls.jml.validator.factory;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.factory.PressLineDailyReportPojo;
import com.jfinal.core.Controller;


public class PressLineDailyReportSaveValidator extends ValidatorBase4Pub {

    protected void validate(Controller c) {
        super.validate(c);
        PressLineDailyReportPojo pojo = getPojo(PressLineDailyReportPojo.class);
        this.validatePojo(pojo);
        c.setAttr("pojo",pojo);
    }

    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
