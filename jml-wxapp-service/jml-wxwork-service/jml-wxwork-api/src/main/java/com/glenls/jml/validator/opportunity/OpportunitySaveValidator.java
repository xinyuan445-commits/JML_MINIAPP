package com.glenls.jml.validator.opportunity;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.jfinal.core.Controller;


public class OpportunitySaveValidator extends ValidatorBase4Pub {
    @Override
    protected void validate(Controller c) {
        super.validate(c);
        this.validateRequired("opp.name",ERROR_KEY,"机会名称不能为空");
    }
}
