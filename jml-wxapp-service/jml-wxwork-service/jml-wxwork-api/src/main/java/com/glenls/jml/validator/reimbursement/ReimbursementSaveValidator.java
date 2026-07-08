package com.glenls.jml.validator.reimbursement;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.ReimbursementInPojo;
import com.jfinal.core.Controller;


public class ReimbursementSaveValidator  extends ValidatorBase4Pub {

    protected void validate(Controller c) {
        super.validate(c);
        ReimbursementInPojo reimbursementInPojo = getPojo(ReimbursementInPojo.class);
        c.setAttr("pojo",reimbursementInPojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }

}
