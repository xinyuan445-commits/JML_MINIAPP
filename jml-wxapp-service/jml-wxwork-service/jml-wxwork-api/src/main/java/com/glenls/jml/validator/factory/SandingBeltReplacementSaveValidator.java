package com.glenls.jml.validator.factory;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.factory.SandingBeltReplacementPojo;
import com.jfinal.core.Controller;


public class SandingBeltReplacementSaveValidator extends ValidatorBase4Pub {

    protected void validate(Controller c) {
        super.validate(c);
        SandingBeltReplacementPojo pojo = getPojo(SandingBeltReplacementPojo.class);
        this.validatePojo(pojo);
        c.setAttr("pojo",pojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
