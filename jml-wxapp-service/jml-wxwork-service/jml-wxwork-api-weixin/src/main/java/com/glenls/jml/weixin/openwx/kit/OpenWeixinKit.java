package com.glenls.jml.weixin.openwx.kit;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import com.alibaba.fastjson.JSON;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.AccessTokenApi;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.ApiConfig;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.ApiConfigKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import io.jboot.Jboot;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;


@Slf4j
public class OpenWeixinKit {


    private static final long WX_CONF_DEFAULT_ID = 1;


    public static final String ENCRYPT_MODE = "1";



    public static final String get(String key){
        return Jboot.configValue(key,StringUtils.EMPTY);
    }


    public static final boolean getBoolean(String key){
        return Boolean.valueOf(Jboot.configValue(key));
    }



    private static String findWeixinId(){
        return get("wechat.id");
    }


    public static String getOpenAppId(){
        return get("wx.open.appid");
    }


    public static ApiConfig putApiConfig(){
        ApiConfig apiConfig =  new ApiConfig();
        apiConfig.setToken(get("wx.mp.token"));
        apiConfig.setAppId(get("wx.mp.appid"));
        apiConfig.setAppSecret(get("wx.mp.appsecret"));


        apiConfig.setEncryptMessage(ENCRYPT_MODE.equals(get("wx.mp.msgMode")));
        apiConfig.setEncodingAesKey(StringUtils.defaultIfEmpty(get("wx.mp.msgSecret"), ""));
        apiConfig.setAuthorizerAppid(get("wx.open.appid"));

        log.info("微信公众号配置参数：" + JSON.toJSONString(apiConfig));
        ApiConfigKit.putApiConfig(apiConfig);
        ApiConfig apiConfig4Open = new ApiConfig();
        apiConfig4Open.setToken(get("wx.open.token"));
        apiConfig4Open.setAppId(get("wx.open.appid"));
        apiConfig4Open.setAppSecret(get("wx.open.appsecret"));
        apiConfig4Open.setAuthorizerAppid(get("wx.open.appid"));
        apiConfig4Open.setEncryptMessage(true);
        apiConfig4Open.setEncodingAesKey(get("wx.open.encodekey"));
        log.info("微信开放平台配置参数：" + JSON.toJSONString(apiConfig4Open));
        ApiConfigKit.setThreadLocalComponentApiConfig(apiConfig4Open);

        return apiConfig4Open;
    }


    public static String getAccessTokenStr(){
        String uri = Jboot.configValue("jml.wx.token.url");
        if(StringUtils.isEmpty(uri)){
            return AccessTokenApi.getAccessTokenStr();
        }

        uri = StringUtils.appendIfMissing(uri,"/","/");

        String url = uri + "api/weixin/wechat/accessToken";
        HttpRequest request = HttpRequest.get(url);
        request.header("Authorization","Bearer SfrS9f72s83A8WFkAg2sWtdEbx28sDzG");
        HttpResponse response = request.execute();
        if(!response.isOk()){
            return AccessTokenApi.getAccessTokenStr();
        }
        String resultStr = response.body();
        RestApiResult restApiResult = JSON.parseObject(resultStr,RestApiResult.class);
        if(restApiResult.isFail()){
            return AccessTokenApi.getAccessTokenStr();
        }
        return String.valueOf(restApiResult.getData());
    }
}
