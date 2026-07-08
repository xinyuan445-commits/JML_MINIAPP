package com.glenls.wxwork.validator;

import com.glenls.commons.jfinal.validator.ValidatorExtend;
import com.jfinal.core.Controller;


public class WxCodeValidator extends ValidatorExtend {

	@Override
	protected void validate(Controller c) {
		super.validate(c);
		this.validateRequired("code",ERROR_KEY,"code不允许为空");
	}

	@Override
	protected void handleError(Controller c) {
		super.handleError(c);
	}
}
