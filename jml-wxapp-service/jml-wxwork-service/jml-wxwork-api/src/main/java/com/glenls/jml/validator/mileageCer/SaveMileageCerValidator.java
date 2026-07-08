package com.glenls.jml.validator.mileageCer;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.core.Controller;


public class SaveMileageCerValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        this.validateRequired("mileageCer.status",ERROR_KEY,"里程认证状态不能为空");
        if(JmlKit.FLAG_0.equals(c.get("mileageCer.status"))){
            this.validateRequired("mileageCer.start_mileage",ERROR_KEY,"开始里程数不能为空");
            this.validateRequired("mileageCer.start_odometer_img",ERROR_KEY,"开始里程图片不能为空");
            this.validateDouble("mileageCer.start_mileage",ERROR_KEY,"开始里程数格式不正确");
        }
        if(JmlKit.FLAG_1.equals(c.get("mileageCer.status"))){
            this.validateRequired("mileageCer.end_mileage",ERROR_KEY,"结束里程数不能为空");
            this.validateDouble("mileageCer.end_mileage",ERROR_KEY,"结束里程数格式不正确");
            this.validateRequired("mileageCer.end_odometer_img",ERROR_KEY,"结束里程图片不能为空");
        }

    }
}
