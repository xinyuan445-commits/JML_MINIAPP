package com.glenls.jml.validator.jmlcase;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.jmlcase.CaseQaOpinionPojo;
import com.jfinal.core.Controller;


public class CaseQaOpinionSaveValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        CaseQaOpinionPojo opinionPojo = getPojo(CaseQaOpinionPojo.class);
        this.validatePojo(opinionPojo);
        c.setAttr("pojo",opinionPojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
