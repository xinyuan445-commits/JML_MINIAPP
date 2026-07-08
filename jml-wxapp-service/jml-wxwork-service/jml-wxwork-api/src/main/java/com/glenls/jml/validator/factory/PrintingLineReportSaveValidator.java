package com.glenls.jml.validator.factory;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.factory.PrintingLineReportPojo;
import com.glenls.jml.pojo.factory.SandingBeltReplacementPojo;
import com.jfinal.core.Controller;


public class PrintingLineReportSaveValidator  extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        PrintingLineReportPojo pojo = getPojo(PrintingLineReportPojo.class);
        this.validatePojo(pojo);
        c.setAttr("pojo",pojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
