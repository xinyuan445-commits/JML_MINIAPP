package com.glenls.jml.modules.privilege.validator;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.api.modules.jml.pojo.StaffSfInPojo;
import com.jfinal.core.Controller;


public class StaffSfValidator extends ValidatorBase4Pub {

    protected void validate(Controller c){
        super.validate(c);
        StaffSfInPojo pojo = getPojo(StaffSfInPojo.class);
        c.setAttr("pojo",pojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
