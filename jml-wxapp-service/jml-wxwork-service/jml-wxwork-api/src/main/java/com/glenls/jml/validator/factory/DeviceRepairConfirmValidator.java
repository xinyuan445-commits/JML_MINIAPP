package com.glenls.jml.validator.factory;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.factory.DeviceRepairPojo;
import com.jfinal.core.Controller;


public class DeviceRepairConfirmValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        DeviceRepairPojo pojo = getPojo(DeviceRepairPojo.class);
        this.validatePojo(pojo);
        c.setAttr("pojo",pojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
