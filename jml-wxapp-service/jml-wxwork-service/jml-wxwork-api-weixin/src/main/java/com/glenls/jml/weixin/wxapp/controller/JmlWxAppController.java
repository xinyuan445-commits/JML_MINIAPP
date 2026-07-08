package com.glenls.jml.weixin.wxapp.controller;

import com.glenls.commons.jboot.controller.BaseController;
import com.glenls.commons.jfinal.validator.PostValidator;
import com.glenls.commons.wxmp.wxapp.validator.WxappCodeValidator;
import com.glenls.jml.weixin.wxapp.busi.JmlWxAppBusi;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;
import lombok.extern.slf4j.Slf4j;


@RequestMapping("/api/weixin/wxapp/auth")
@Slf4j
public class JmlWxAppController extends BaseController {

    @Inject
    public JmlWxAppBusi jmlWxAppBusi;


    @Before({PostValidator.class, WxappCodeValidator.class})
    public void byCode(){
        renderJson(jmlWxAppBusi.queryByCode(get("code")));
    }
}
