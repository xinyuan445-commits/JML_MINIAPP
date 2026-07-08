package com.glenls.jml.modules.privilege.validator;

import com.glenls.api.modules.jml.pojo.StaffLoginPojo;
import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.ReimbursementInPojo;
import com.jfinal.core.Controller;


public class StaffLoginValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        StaffLoginPojo staffLoginPojo = getPojo(StaffLoginPojo.class);
        c.setAttr("pojo",staffLoginPojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
