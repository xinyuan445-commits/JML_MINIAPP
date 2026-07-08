package com.glenls.jml.validator.factory;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.factory.JobAssignmentPojo;
import com.glenls.jml.pojo.factory.JobAssignmentStaffPojo;
import com.jfinal.core.Controller;


public class JobAssignmentCompleteValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        JobAssignmentStaffPojo pojo = getPojo(JobAssignmentStaffPojo.class);
        this.validatePojo(pojo);
        c.setAttr("pojo",pojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
