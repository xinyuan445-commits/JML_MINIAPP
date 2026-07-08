package com.glenls.jml.validator.factory;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.factory.NitrogenLogPojo;
import com.glenls.jml.pojo.factory.PeripheralDeviceMntPojo;
import com.jfinal.core.Controller;


public class PeripheralDeviceMntSaveValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        PeripheralDeviceMntPojo pojo = getPojo(PeripheralDeviceMntPojo.class);
        this.validatePojo(pojo);
        c.setAttr("pojo",pojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}

