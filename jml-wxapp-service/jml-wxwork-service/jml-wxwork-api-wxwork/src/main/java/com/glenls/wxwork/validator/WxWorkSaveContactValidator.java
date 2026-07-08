package com.glenls.wxwork.validator;

import com.glenls.commons.jfinal.validator.ValidatorExtend;
import com.jfinal.core.Controller;


public class WxWorkSaveContactValidator extends ValidatorExtend {

    @Override
    protected void validate(Controller c) {
        super.validate(c);
        this.validateRequired("userId",ERROR_KEY,"userId为空");
        this.validateRequired("externalUserId",ERROR_KEY,"externalUserId为空");
    }

    @Override
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
