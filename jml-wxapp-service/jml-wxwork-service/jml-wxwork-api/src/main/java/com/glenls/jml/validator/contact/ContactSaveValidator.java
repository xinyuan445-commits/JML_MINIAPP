package com.glenls.jml.validator.contact;

import cn.hutool.core.util.StrUtil;
import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.jfinal.core.Controller;


public class ContactSaveValidator  extends ValidatorBase4Pub {

    @Override
    protected void validate(Controller c) {
        super.validate(c);
        this.validateRequired("contact.name",ERROR_KEY,"联系人姓名不能为空");
        this.validateRequired("contact.account_id",ERROR_KEY,"所在公司不能为空");
        this.validateRequired("contact.mobile_phone",ERROR_KEY,"联系人手机不能为空");
        if(StrUtil.isNotEmpty("contact.email")){
            this.validateEmail("contact.email",ERROR_KEY,"邮箱格式不正确");
        }
        this.validateRequired("contact.department",ERROR_KEY,"联系人部门不能为空");
        this.validateRequired("contact.function",ERROR_KEY,"联系人职能不能为空");
        this.validateRequired("contact.working",ERROR_KEY,"是否在职不能为空");
    }
}
