package com.glenls.jml.weixin.weixin.validator;

import com.glenls.commons.jfinal.validator.ValidatorExtend;
import com.jfinal.core.Controller;
import org.apache.commons.lang3.StringUtils;


public class WexinAccessTokenValidator extends ValidatorExtend {

    @Override
    protected void validate(Controller c) {
        super.validate(c);
        String token = c.getHeader("Authorization");
        if(StringUtils.isEmpty(token)){
            this.addError(ERROR_KEY,"鉴权参数错误");
            return;
        }
        if(!StringUtils.startsWith(token,"Bearer ")){
            this.addError(ERROR_KEY,"鉴权参数错误");
            return;
        }
        String targetToken = "Bearer SfrS9f72s83A8WFkAg2sWtdEbx28sDzG";
        if(!StringUtils.equals(token,targetToken)){
            this.addError(ERROR_KEY,"鉴权参数错误");
        }
    }

    @Override
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
