package com.glenls.jml.validator.jmlcase;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.jmlcase.CasePojo;
import com.jfinal.core.Controller;


public class CaseSaveValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        CasePojo casePojo = getPojo(CasePojo.class);
        this.validatePojo(casePojo);
        c.setAttr("pojo",casePojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
