package com.glenls.jml.validator.salesLead;

import cn.hutool.core.util.StrUtil;
import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.jfinal.core.Controller;


public class SalesLeadSaveValidator extends ValidatorBase4Pub {

    @Override
    protected void validate(Controller c) {
        super.validate(c);
        if(StrUtil.isNotEmpty("salesLead.email")){
            this.validateEmail("salesLead.email",ERROR_KEY,"邮箱格式不正确");
        }

    }
}
