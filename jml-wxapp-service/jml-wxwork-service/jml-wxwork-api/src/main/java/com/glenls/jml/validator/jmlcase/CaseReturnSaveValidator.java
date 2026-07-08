package com.glenls.jml.validator.jmlcase;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.jmlcase.CasePojo;
import com.glenls.jml.pojo.jmlcase.CaseReturnInPojo;
import com.jfinal.core.Controller;


public class CaseReturnSaveValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        CaseReturnInPojo pojo = getPojo(CaseReturnInPojo.class);
        c.setAttr("pojo",pojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
