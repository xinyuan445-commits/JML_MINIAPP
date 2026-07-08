package com.glenls.jml.kit;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.jfinal.kit.HttpKit;

import org.apache.commons.lang3.StringUtils;

import java.util.HashMap;
import java.util.Map;


public class ChatGptKit {

    public static final String URL = "https:

    public static final String KEY = "sk-AQ0CCg03Kt1I3HFnNfDNFrjw9Wu11YTXNcltC2Euva5GFwjs";


    public static final JSONObject getChatGptInfo(String content,String openId) {

        JSONObject jsonParam = new JSONObject();
        jsonParam.put("model", "gpt-3.5-turbo");
        jsonParam.put("temperature", 0.9);
        jsonParam.put("user", openId);
        jsonParam.put("max_tokens", 1024);
        JSONArray messages = new JSONArray();
        JSONObject message = new JSONObject();
        message.put("role", "system");
        message.put("content", content);
        messages.add(message);
        jsonParam.put("messages", messages);
        Map<String,String> headerMap = new HashMap<>();
        headerMap.put("Authorization",KEY);
        HttpKit.setConnectTimeout(120000);
        String ret = HttpKit.post(URL,jsonParam.toString(),headerMap);

        JSONObject jsonObjectRet = new JSONObject();
        if(StringUtils.isNotBlank(ret)){
            jsonObjectRet = JSON.parseObject(ret);
        }
        System.out.println(jsonObjectRet);
        return jsonObjectRet;
    }

    public static void main(String[] args) {

        getChatGptInfo("你是一名专业的投资顾问","123455");

    }

}
