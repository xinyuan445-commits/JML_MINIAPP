package com.glenls.jml.validator.jmlcase;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.jmlcase.CaseSolutionDetailPojo;
import com.jfinal.core.Controller;

import java.util.List;


public class CaseSolutionSaveValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        List<CaseSolutionDetailPojo> listPojo = getPojoList(CaseSolutionDetailPojo.class);

        c.setAttr("listPojo",listPojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
