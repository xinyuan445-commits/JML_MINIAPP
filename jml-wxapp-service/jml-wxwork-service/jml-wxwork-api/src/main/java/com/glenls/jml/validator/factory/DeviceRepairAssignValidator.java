package com.glenls.jml.validator.factory;

import cn.hutool.core.util.ObjUtil;
import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.pojo.factory.DeviceRepairPojo;
import com.jfinal.core.Controller;


public class DeviceRepairAssignValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        DeviceRepairPojo pojo = getPojo(DeviceRepairPojo.class);
        this.validatePojo(pojo);
        if(ObjUtil.isEmpty(pojo.getRepairerStaffId())){
            this.addError(ERROR_KEY,"维修员不能为空");
        }
        if(ObjUtil.isEmpty(pojo.getRepairerStatus())){
            this.addError(ERROR_KEY,"维修机器状态不能为空");
        }
        c.setAttr("pojo",pojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
