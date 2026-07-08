package com.glenls.salesforce.modules.pub.busi;

import cn.hutool.http.HttpUtil;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.salesforce.modules.db2sf.busi.ConfDbSfBusi;
import com.glenls.salesforce.modules.pub.kit.SalesforceKit;
import com.glenls.salesforce.modules.pub.pojo.SfTokenPojo;
import com.jfinal.aop.Inject;
import com.jfinal.kit.JsonKit;
import io.jboot.Jboot;
import io.jboot.support.redis.JbootRedis;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;

import java.util.HashMap;
import java.util.Map;


@Slf4j
public class SfTokenBusi {

    @Inject
    private ConfDbSfBusi confAwsSfBusi;

    public static final String key = "dbToSF:conf:token";


    public SfTokenPojo getToken(){
        JbootRedis jBootRedis = Jboot.getRedis();

        SfTokenPojo tokenPojo  = jBootRedis.get(key);
        if(tokenPojo != null){
            log.info("token缓存：" + JSON.toJSONString(tokenPojo));
            return tokenPojo;
        }
        tokenPojo = new SfTokenPojo();

        RestApiResult RestApiResult = confAwsSfBusi.queryHost();
        if(RestApiResult.isFail()){
            log.error("查询配置参数失败：" + JsonKit.toJson(RestApiResult));
            return null;
        }
        String host = (String) RestApiResult.getData();
        String url = new StringBuffer(host).append("/services/oauth2/token").toString();

        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("grant_type",Jboot.configValue("sf.grant_type"));
        paramsMap.put("client_id",Jboot.configValue("sf.client_id"));
        paramsMap.put("client_secret",Jboot.configValue("sf.client_secret"));
        paramsMap.put("username",Jboot.configValue("sf.username"));
        paramsMap.put("password",Jboot.configValue("sf.password"));

        String reqRet = HttpUtil.post(url,paramsMap);
        if(StringUtils.isEmpty(reqRet)){
            log.error("接口：" + url + "请求返回数据为空，请排查！请求参数：" + JSON.toJSONString(paramsMap));
            return null;
        }

        log.info("获取token：" + reqRet);

        JSONObject retJson = JSON.parseObject(reqRet);

        String tokenType = retJson.getString("token_type");
        String accessToken = retJson.getString("access_token");
        String token = tokenType + " " + accessToken;

        log.error("接口：" + url + "请求返回token为空，请排查！请求参数：" + JSON.toJSONString(paramsMap) +"，返回值：" + reqRet);
        if(StringUtils.isEmpty(tokenType) || StringUtils.isEmpty(accessToken)){
            return null;
        }
        tokenPojo.setToken(token);
        tokenPojo.setUrl(retJson.getString("instance_url"));

        jBootRedis.setex(key, SalesforceKit.CACHE_TIMEOUT_SENCONDS,tokenPojo);

        log.info("token实时：" + JSON.toJSONString(tokenPojo));
        return tokenPojo;
    }
}
