package com.glenls.jml.kit;

import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.ApiResult;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.TemplateData;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.TemplateMsgApi;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.jml.constant.CaseCommType;
import io.jboot.Jboot;

import java.util.Map;


public class SendWxTmplMsgKit {
    public static final String getMiniProgramAppId(){
        return Jboot.configValue("wxa.appId");
    }

    
    public static ApiResult sendNoticeTmplMsg(Map<String,Object> paramsMap){
        TemplateData templateData = TemplateData.New();
        String jsonStr = templateData
                .setTouser(paramsMap.get("openId").toString())
                .setTemplate_id("hxtywElsmzaqPRjcsk16j2B-iuetl3jAKKOd6458bQY")
                .setMiniprogram(getMiniProgramAppId(),"pages/complaint/Detailed?id="+paramsMap.get("id").toString()+"&type=pages/complaint/Index")
                .add("character_string5",paramsMap.get("name").toString())
                .add("thing3",paramsMap.get("serviceType").toString())
                .add("thing4",paramsMap.get("caseStage").toString())
                .add("thing2",paramsMap.get("accName").toString())
                .add("time20",paramsMap.get("submitTime").toString())
                .build();
        return new ApiResult(TemplateMsgApi.send(jsonStr).toString());
    }

    
    public static ApiResult sendRemindTmplMsg(Map<String,Object> paramsMap){
        TemplateData templateData = TemplateData.New();
        String jsonStr = templateData
                .setTouser(paramsMap.get("openId").toString())
                .setTemplate_id("-USj9JTwr824ijICLmK-51uyaVbQHwKmit0YZL5ucOE")
                .setMiniprogram(getMiniProgramAppId(),"pages/complaint/Detailed?id="+paramsMap.get("id").toString()+"&type=pages/complaint/Index")
                .add("character_string41",paramsMap.get("name").toString())
                .add("thing37",paramsMap.get("createStaffName").toString())
                .add("const24",paramsMap.get("currentStage").toString())
                .add("const29", CaseCommType.SERVICE_TYPE_SHFW.getDesc().equals(paramsMap.get("serviceType").toString()) ? "高" : "低")
                .add("thing43",paramsMap.get("accName").toString())
                .build();
        return new ApiResult(TemplateMsgApi.send(jsonStr).toString());

    }

    
    public static ApiResult sendReturnTmplMsg(Map<String,Object> paramsMap){
        TemplateData templateData = TemplateData.New();
        String jsonStr = templateData
                .setTouser(paramsMap.get("openId").toString())
                .setTemplate_id("gKH1KVF-zNmVbAfw0rGZD93ktSC5FPvrcu0gPOZlS-w")
                .setMiniprogram(getMiniProgramAppId(),"pages/complaint/Detailed?id="+paramsMap.get("id").toString()+"&type=pages/complaint/Index")
                .add("character_string4",paramsMap.get("name").toString())
                .add("thing1",paramsMap.get("serviceType").toString())
                .add("thing2",paramsMap.get("returnStaffName").toString())
                .add("time3",paramsMap.get("submitTime").toString())
                .build();
       return new ApiResult(TemplateMsgApi.send(jsonStr).toString());
    }

    
    public static ApiResult sendCloseTmplMsg(Map<String,Object> paramsMap){
        TemplateData templateData = TemplateData.New();
        String jsonStr = templateData
                .setTouser(paramsMap.get("openId").toString())
                .setTemplate_id("vHQTUpD3zuTSehntiMhGxF1XT61ymR2vyPh9L03Hc28")
                .setMiniprogram(getMiniProgramAppId(),"pages/complaint/Detailed?id="+paramsMap.get("id").toString()+"&type=pages/complaint/Index")
                .add("character_string4",paramsMap.get("name").toString())
                .add("thing2",paramsMap.get("accName").toString())
                .add("time1",paramsMap.get("submitTime").toString())
                .build();
        return new ApiResult(TemplateMsgApi.send(jsonStr).toString());
    }


    public static ApiResult sendTestTmpMsg() {
        TemplateData templateData = TemplateData.New();
        String sendJson = templateData
                .setTouser("ofB5n6qEiwEmjRypyyLQk06pWuHU")
                .setTemplate_id("7DszZx0NkzyWIqNrxz5jVlwcGX6knC3kFg79rSe_SXU")
                .add("time4","2024-02-27")
                .add("thing3","张三")
                .add("character_string6","NO000001")
                .add("thing9","客服服务审核")
                .add("thing10","测试")
                .build();

        return new ApiResult(TemplateMsgApi.send(sendJson).toString());
    }



}
