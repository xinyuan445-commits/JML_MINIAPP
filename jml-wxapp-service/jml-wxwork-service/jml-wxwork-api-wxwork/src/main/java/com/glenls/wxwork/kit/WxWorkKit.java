package com.glenls.wxwork.kit;

import com.glenls.commons.jfinal_wxwork.sdk.api.ApiConfig;
import io.jboot.Jboot;

import java.util.HashMap;
import java.util.Map;


public class WxWorkKit {


    public static final String getCorpId(){
        return Jboot.configValue("wxwork.corpId");
    }



    public static final String getAgentId(){
        return Jboot.configValue("wxwork.agentId");
    }


    public static final String getSecret(){
        return Jboot.configValue("wxwork.secret");
    }


    public static final String getCustSecret(){
        return get("wxwork.cust.secret");
    }


    public static final String getUserId(){
        return get("wxwork.userId");
    }


    public static final String get(String key){
        return Jboot.configValue(key);
    }


    public static ApiConfig getWxApiConf(){
        ApiConfig apiConfig = new ApiConfig();

        apiConfig.setAgentId(getAgentId());
        apiConfig.setSecret(get("wxwork.secret"));
        apiConfig.setEncryptMessage(true);
        apiConfig.setCorpId(get("wxwork.corpId"));
        apiConfig.setToken(get("wxwork.token"));
        apiConfig.setCorpSecret(get("wxwork.corpSecret"));
        apiConfig.setEncodingAesKey(getSecret());

        return apiConfig;
    }


    public static Map<String, Object> getConf4Front(){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("corpId",get("wxwork.corpId"));
        paramsMap.put("agentid",getAgentId());
        paramsMap.put("corpsecret",get("wxwork.corpSecret"));

        return paramsMap;
    }

}
