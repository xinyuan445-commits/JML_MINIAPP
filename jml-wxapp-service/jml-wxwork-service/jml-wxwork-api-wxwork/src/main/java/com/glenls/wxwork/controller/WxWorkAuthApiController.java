package com.glenls.wxwork.controller;

import cn.hutool.core.util.URLUtil;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.glenls.api.modules.jml.model.StaffModel;
import com.glenls.commons.jboot.controller.BaseController;
import com.glenls.commons.jfinal.ineterceptor.CrossDomainInterceptor;
import com.glenls.commons.jfinal_wxwork.sdk.api.*;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.wxwork.busi.WxWorkUserSyncBusi;
import com.glenls.wxwork.kit.WxWorkKit;
import com.glenls.wxwork.validator.WxCodeValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.kit.HashKit;
import com.jfinal.kit.StrKit;
import io.jboot.web.controller.annotation.RequestMapping;
import lombok.extern.log4j.Log4j;
import org.apache.commons.lang3.StringUtils;

import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;


@RequestMapping("/openapi/wxwork/auth")
@Log4j
@Before({CrossDomainInterceptor.class})
public class WxWorkAuthApiController extends BaseController {

    @Inject
    private StaffModel staffDao;

    
    public void loadConf(){
        renderJson(RestApiResult.newSuccessWithData(WxWorkKit.getConf4Front()));
    }

    
    public void sign(){
        JsTicket jsTicket = JsTicketApi.getTicket(JsTicketApi.JsApiType.jsapi);
        log.info("jsticket获取结果：" + jsTicket.getJson());
        log.info("签名原始参数：" + JSON.toJSONString(getParaMap()));
        String _wxShareUrl = getPara("url");
        log.info("签名URL原始参数：" + _wxShareUrl);

        Map<String, String> _wxMap = new TreeMap<>();
        _wxMap.put("jsapi_ticket", jsTicket.getTicket());
        _wxMap.put("noncestr", UUID.randomUUID().toString().replace("-", ""));
        _wxMap.put("timestamp", (System.currentTimeMillis() / 1000) + "");
        _wxMap.put("url", _wxShareUrl);


        log.info("签名参数：" + JSON.toJSONString(_wxMap));
        StringBuilder _wxBaseString = new StringBuilder();
        for (Map.Entry<String, String> param : _wxMap.entrySet()) {
            _wxBaseString.append(param.getKey()).append("=").append(param.getValue()).append("&");
        }
        String _wxSignString = _wxBaseString.substring(0, _wxBaseString.length() - 1);
        String _wxSignature = HashKit.sha1(_wxSignString);

        _wxMap.put("signature",_wxSignature);
        _wxMap.put("corpId",WxWorkKit.getCorpId());

        RestApiResult result = RestApiResult.newSuccessWithData(_wxMap);

        renderJson(result);
    }

    
    public void accessToken(){
        AccessToken accessToken = AccessTokenApi.getAccessToken();
        RestApiResult ajaxRetPojo = RestApiResult.newFail();
        if(accessToken != null && accessToken.isAvailable()){
            ajaxRetPojo = RestApiResult.newSuccessWithData(accessToken.getAccessToken());
        }
        renderJson(ajaxRetPojo);
    }

    
    @Before({CrossDomainInterceptor.class, WxCodeValidator.class})
    public void userInfo(){
        detail();
    }

    
    @Before({CrossDomainInterceptor.class, WxCodeValidator.class})
    public void detail(){
        String code = getPara("code");
        log.info("企业微信的code：" + code);

        ApiResult apiResult = WxWorkUserSyncBusi.getUserInfoByCodeNew(code);
        log.info("企业微信code: "+code+"，获取用户信息结果：" + apiResult.getJson());
        if(!apiResult.isSucceed()){
            renderJson(RestApiResult.newFail("用户查询失败，企业微信接口调用失败"));
            return ;
        }
        String userId = apiResult.getStr("userid");

        StaffModel staffModel = staffDao.queryByWxworkUserId(userId);
        if(staffModel != null){
            String userTicket = apiResult.getStr("user_ticket");
            
            ApiResult userInfoApiResult = WxWorkUserSyncBusi.getUserInfoByUserTicketNew(userTicket);

            log.info("企业微信user_ticket: "+userTicket+"，获取用户敏感信息结果：" + userInfoApiResult.getJson());

            if(!userInfoApiResult.isSucceed()){
                renderJson(RestApiResult.newFail("获取用户信息失败，企业微信敏感信息接口调用失败"));
                return ;
            }
            String avatar = userInfoApiResult.get("avatar");
            if(StringUtils.isNotEmpty(avatar)){
                staffModel.set("avatar", avatar);
                staffModel.update();
            }
            renderJson(RestApiResult.newSuccessWithData(staffModel));
            return;
        }



        renderJson(RestApiResult.newFail("用户查询失败，用户不存在，用户ID：" + userId));
    }


}
