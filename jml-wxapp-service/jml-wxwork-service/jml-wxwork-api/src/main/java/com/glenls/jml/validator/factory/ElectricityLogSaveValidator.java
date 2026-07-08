package com.glenls.jml.validator.factory;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.factory.ElectricityLogPojo;
import com.jfinal.core.Controller;


public class ElectricityLogSaveValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        ElectricityLogPojo pojo = getPojo(ElectricityLogPojo.class);
        this.validatePojo(pojo);
        c.setAttr("pojo",pojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
