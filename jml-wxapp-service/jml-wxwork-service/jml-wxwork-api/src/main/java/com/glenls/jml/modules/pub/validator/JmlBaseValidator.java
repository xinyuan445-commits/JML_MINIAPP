package com.glenls.jml.modules.pub.validator;

import com.glenls.commons.jfinal.validator.ValidatorExtend;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.jfinal.core.Controller;
import com.jfinal.validate.ValidateException;
import org.apache.commons.lang3.StringUtils;


public class JmlBaseValidator extends ValidatorExtend {


    protected String getStaffId(){
        return getController().getHeader("staff-id");
    }

    @Override
    protected void validate(Controller c) {
        super.validate(c);
    }

    @Override
    protected void handleError(Controller c) {
        String errorMsg = c.getAttrForStr(ERROR_KEY);
        if (StringUtils.isEmpty(errorMsg)) {
            errorMsg = c.getAttrForStr(this.ERROR_KEY);
        }
        RestApiResult restApiResult = RestApiResult.newFail(errorMsg);

        String codeKey = ERROR_KEY + "_code";
        String errorCode = c.getAttrForStr(codeKey);
        if (StringUtils.isNotEmpty(errorCode)) {
            restApiResult.setCode(errorCode);
        }

        this.getController().renderJson(restApiResult);
    }


    protected void addError(String errorKey, String errorMessage,String code) {
        invalid = true;
        String codeKey = errorKey + "_code";

        if (ret != null) {
            ret.set(errorKey, errorMessage);
            ret.set(codeKey, code);
        } else {
            controller.setAttr(errorKey, errorMessage);
            controller.setAttr(codeKey, code);
        }

        if (shortCircuit) {
            throw new ValidateException();
        }
    }
}
