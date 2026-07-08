package com.glenls.jml.kit;

import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.ApiResult;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.TemplateData;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.TemplateMsgApi;
import com.glenls.jml.weixin.openwx.kit.OpenWeixinKit;
import io.jboot.Jboot;

import java.util.Map;


public class SendWxTmpFacMsgKit {
    public static final String getMiniProgramAppId(){
        return Jboot.configValue("wxa.appId");
    }

    
    public static ApiResult sendATmplMsg(Map<String,Object> paramsMap){
        TemplateData templateData = TemplateData.New();
        String jsonStr = templateData
                .setTouser(paramsMap.get("openid").toString())
                .setTemplate_id("hxtywElsmzaqPRjcsk16j4zcI_OHsmrQ4bIMIpiM6vs")
                .setMiniprogram(getMiniProgramAppId(),paramsMap.get("pagePath").toString())
                .add("character_string5",paramsMap.get("name").toString())
                .add("thing3",paramsMap.get("factoryType").toString())
                .add("thing4","已提交")
                .add("thing44",paramsMap.get("createName").toString())
                .add("time20",paramsMap.get("createdTime").toString())
                .build();
        return new ApiResult(TemplateMsgApi.send(jsonStr, OpenWeixinKit.getAccessTokenStr()).toString());
    }

    
    public static ApiResult sendBTmplMsg(Map<String,Object> paramsMap){
        TemplateData templateData = TemplateData.New();
        String jsonStr = templateData
                .setTouser(paramsMap.get("openid").toString())
                .setTemplate_id("W1tWGqcEyDYCDC6IhplyZgXN-S5N5bU3rMAe94qAo0c")
                .setMiniprogram(getMiniProgramAppId(),paramsMap.get("pagePath").toString())
                .add("character_string11",paramsMap.get("name").toString())
                .add("thing7",paramsMap.get("staffName").toString())
                .add("time10",paramsMap.get("createdTime").toString())
                .add("thing3",paramsMap.get("status").toString())
                .build();
        return new ApiResult(TemplateMsgApi.send(jsonStr, OpenWeixinKit.getAccessTokenStr()).toString());
    }

    

    public static ApiResult sendCTmplMsg(Map<String,Object> paramsMap){
        TemplateData templateData = TemplateData.New();
        String jsonStr = templateData
                .setTouser(paramsMap.get("openid").toString())
                .setTemplate_id("7qxnnCaxmpWcwqdgVOIPs3T42XnHIB2K7k-dMbFa2yU")
                .setMiniprogram(getMiniProgramAppId(),paramsMap.get("pagePath").toString())
                .add("character_string1",paramsMap.get("name").toString())
                .add("thing25",paramsMap.get("deviceName").toString())
                .add("thing10",paramsMap.get("staffName").toString())
                .add("time6",paramsMap.get("createdTime").toString())
                .add("time29",paramsMap.get("assignTime").toString())
                .build();
        return new ApiResult(TemplateMsgApi.send(jsonStr, OpenWeixinKit.getAccessTokenStr()).toString());
    }
}
