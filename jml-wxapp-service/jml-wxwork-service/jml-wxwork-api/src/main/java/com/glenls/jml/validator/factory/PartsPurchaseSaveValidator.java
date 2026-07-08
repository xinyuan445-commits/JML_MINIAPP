package com.glenls.jml.validator.factory;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.factory.PartsPurchaseDetailsPojo;
import com.glenls.jml.pojo.factory.PartsPurchasePojo;
import com.jfinal.core.Controller;


public class PartsPurchaseSaveValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        PartsPurchasePojo pojo = getPojo(PartsPurchasePojo.class);
        this.validatePojo(pojo);
        c.setAttr("pojo",pojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
