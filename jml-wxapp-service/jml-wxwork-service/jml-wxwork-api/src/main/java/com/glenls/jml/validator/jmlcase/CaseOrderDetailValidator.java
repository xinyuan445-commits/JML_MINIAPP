package com.glenls.jml.validator.jmlcase;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.jmlcase.CaseOrderDetailPojo;
import com.jfinal.core.Controller;


public class CaseOrderDetailValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        CaseOrderDetailPojo pojo = getPojo(CaseOrderDetailPojo.class);
        this.validatePojo(pojo);
        c.setAttr("pojo",pojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
