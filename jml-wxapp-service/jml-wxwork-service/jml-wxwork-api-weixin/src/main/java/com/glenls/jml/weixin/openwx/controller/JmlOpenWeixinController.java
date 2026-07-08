package com.glenls.jml.weixin.openwx.controller;

import com.glenls.commons.jfinal_wxmp.openwx.ComponentAuthApi;
import com.glenls.commons.jfinal_wxmp.openwx.ComponentAuthorizerAccessToken;
import com.glenls.commons.jfinal_wxmp.openwx.controller.AuthMessageControllerAdapter;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.ApiConfig;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.ApiConfigKit;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.ApiResult;
import com.glenls.jml.weixin.openwx.kit.OpenWeixinKit;
import com.jfinal.kit.JsonKit;
import com.jfinal.kit.StrKit;
import io.jboot.web.controller.annotation.RequestMapping;
import lombok.extern.slf4j.Slf4j;


@RequestMapping("/api/weixin/open")
@Slf4j
public class JmlOpenWeixinController extends AuthMessageControllerAdapter {


    @Override
    public ApiConfig getComponentApiConfig() {
        return OpenWeixinKit.putApiConfig();
    }

    
    public void jump() {
        OpenWeixinKit.putApiConfig();
        String redirect_uri = "https%3a%2f%2f" + getRequest().getServerName() + "%2fopenwx%2fauth%2fcallback";
        String openAppId = ApiConfigKit.getComponentApiConfig().getAppId();
        log.info("开放平台APPID：" + openAppId);
        ApiConfigKit.getAppId();

        String authorizeURL = ComponentAuthApi.getAuthorizeURL(openAppId, redirect_uri);
        log.info("授权跳转地址：" + authorizeURL);
        setAttr("replaceActionUrl", authorizeURL);
        redirect(authorizeURL);
    }

    public void callback() {
        if (!StrKit.isBlank(getPara("auth_code"))) {
            String query_auth_code = getPara("auth_code");
            final ApiResult auth = ComponentAuthApi.auth(query_auth_code);

            if (auth != null && auth.isSucceed()) {
                final String authorization_info = JsonKit.toJson(auth.get("authorization_info"));

                log.info("auth json >> " + auth.toString());
                log.info("authorization_info >> " + authorization_info);
                ComponentAuthorizerAccessToken token = new ComponentAuthorizerAccessToken(authorization_info);
                log.info("授权方 AppId : " + token.getAuthorizerAppId());
            }
            renderNull();
        }

    }
}
