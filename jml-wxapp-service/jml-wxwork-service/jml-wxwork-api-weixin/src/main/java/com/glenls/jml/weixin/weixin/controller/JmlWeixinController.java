package com.glenls.jml.weixin.weixin.controller;

import com.glenls.commons.jboot.controller.BaseController;
import com.glenls.commons.jfinal.validator.PostValidator;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.AccessTokenApi;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.wxmp.wxapp.validator.WxappCodeValidator;
import com.glenls.jml.weixin.weixin.busi.OpenWxFansBusi;
import com.glenls.jml.weixin.weixin.validator.WexinAccessTokenValidator;
import com.glenls.jml.weixin.wxapp.busi.JmlWxAppBusi;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;
import lombok.extern.slf4j.Slf4j;


@RequestMapping("/api/weixin/wechat")
@Slf4j
public class JmlWeixinController extends BaseController {

    @Inject
    public OpenWxFansBusi openWxFansBusi;


    public void sync(){
        openWxFansBusi.sync();
        renderJson(RestApiResult.newSuccess("开始同步"));
    }


    @Before({WexinAccessTokenValidator.class})
    public void accessToken(){
        renderJson(RestApiResult.newSuccessWithData(AccessTokenApi.getAccessTokenStr()));
    }
}
