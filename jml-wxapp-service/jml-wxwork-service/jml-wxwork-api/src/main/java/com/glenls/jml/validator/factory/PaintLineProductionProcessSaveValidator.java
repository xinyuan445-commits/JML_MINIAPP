package com.glenls.jml.validator.factory;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.factory.PaintLineProductionProcessPojo;
import com.glenls.jml.pojo.jmlcase.CasePojo;
import com.jfinal.core.Controller;


public class PaintLineProductionProcessSaveValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        PaintLineProductionProcessPojo pojo = getPojo(PaintLineProductionProcessPojo.class);
        this.validatePojo(pojo);
        c.setAttr("pojo",pojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
