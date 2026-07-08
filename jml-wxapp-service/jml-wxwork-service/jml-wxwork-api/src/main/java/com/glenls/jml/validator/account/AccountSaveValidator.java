package com.glenls.jml.validator.account;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.jfinal.core.Controller;


public class AccountSaveValidator extends ValidatorBase4Pub {
    @Override
    protected void validate(Controller c) {
        super.validate(c);
        this.validateRequired("account.name",ERROR_KEY,"公司名称不能为空");
        this.validateRequired("account.address",ERROR_KEY,"公司地址不能为空");
        this.validateRequired("account.phone",ERROR_KEY,"公司电话不能为空");
        this.validateRequired("account.type",ERROR_KEY,"公司类型不能为空");
        this.validateRequired("account.company_business",ERROR_KEY,"公司性质不能为空");
        this.validateRequired("account.if_validated_dealer",ERROR_KEY,"是否有效经销商不能为空");
    }
}
