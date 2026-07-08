package com.glenls.api.modules.jml.kit;

import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.ApiResult;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.TemplateData;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.TemplateMsgApi;
import io.jboot.Jboot;

import java.util.Map;


public class SendWxTmpFacMsgKit {
    public static final String getMiniProgramAppId(){
        return Jboot.configValue("wxa.appId");
    }


    public static ApiResult sendDTmplMsg(Map<String,Object> paramsMap){
        TemplateData templateData = TemplateData.New();
        String jsonStr = templateData
                .setTouser(paramsMap.get("openid").toString())
                .setTemplate_id("EYPhEsJYzLjzp-ys4tRaRZUNBFLBMg6qrOEguR2yDxE")
                .setMiniprogram(getMiniProgramAppId(),paramsMap.get("pagePath").toString())
                .add("character_string2",paramsMap.get("name").toString())
                .add("time34",paramsMap.get("createdTime").toString())
                .add("thing25",paramsMap.get("staffName").toString())
                .add("thing6",paramsMap.get("status").toString())
                .add("thing11","此工单超时未接收")
                .build();
        return new ApiResult(TemplateMsgApi.send(jsonStr, OpenWeixinKit.getAccessTokenStr()).toString());
    }


}
