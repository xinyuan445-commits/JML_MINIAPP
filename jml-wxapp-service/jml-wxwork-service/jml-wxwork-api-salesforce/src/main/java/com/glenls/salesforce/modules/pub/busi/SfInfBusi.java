package com.glenls.salesforce.modules.pub.busi;

import cn.hutool.http.*;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.salesforce.modules.pub.pojo.SfTokenPojo;
import com.jfinal.aop.Inject;
import com.jfinal.kit.JsonKit;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;


@Slf4j
public class SfInfBusi {

    @Inject
    private SfTokenBusi sfTokenBusi;


    public RestApiResult sendToResult(String uri, String data, Method method){
        SfTokenPojo tokenPojo = sfTokenBusi.getToken();
        if(tokenPojo == null){
            return RestApiResult.newFail("token参数为空");
        }
        String url = new StringBuffer(tokenPojo.getUrl()).append(uri).toString();
        HttpRequest request = HttpUtil.createRequest(method,url);

        Map<String, String> headerMap = new HashMap<>();;
        headerMap.put(Header.AUTHORIZATION.getValue(),tokenPojo.getToken());
        headerMap.put(Header.ACCEPT.getValue(),"application/json");

        request.headerMap(headerMap,true);


        String ret = null;
        Integer status = null;
        try{
            HttpResponse httpResponse = null;
            if(Method.POST.equals(method) || Method.PATCH.equals(method)){
                httpResponse = request.body(data).execute();
            }else{
                httpResponse = request.execute();
            }

            ret = httpResponse.body();
            status = httpResponse.getStatus();


            if(!httpResponse.isOk()){
                JSONArray retJsonArray = JSON.parseArray(ret);
                if(retJsonArray.size() <= 0){
                    return RestApiResult.newFail("请求失败：" + ret);
                }
                String retMsg = retJsonArray.getJSONObject(0).getString("message");
                return RestApiResult.newFail(retMsg);
            }

            return RestApiResult.newSuccessWithData(ret);
        }catch (Exception e){
            log.error(e.getMessage(),e);
        }finally{
            if(log.isInfoEnabled()){
                log.info("请求地址：" + url + "\n请求头："+ JsonKit.toJson(headerMap) +"\n请求参数：" + data + "\n返回值：" + ret + "\n返回状态：" + status);
            }
        }

        return RestApiResult.newFail("请求失败");
    }


    public String send(String uri, String data, Method method){
        return (String) sendToResult(uri, data, method).getData();
    }


    public String post(String uri,String data){
        SfTokenPojo tokenPojo = sfTokenBusi.getToken();
        if(tokenPojo == null){
            return null;
        }

        String url = new StringBuffer(tokenPojo.getUrl()).append(uri).toString();
        HttpRequest request = HttpUtil.createPost(url);

        Map<String, String> headerMap = new HashMap<>();;
        headerMap.put(Header.AUTHORIZATION.getValue(),tokenPojo.getToken());
        headerMap.put(Header.ACCEPT.getValue(),"application/json");

        request.headerMap(headerMap,true);

        try{
            HttpResponse httpResponse = request.body(data).execute();
            String ret = httpResponse.body();
            int status = httpResponse.getStatus();

            if(log.isInfoEnabled()){
                log.info("请求地址：" + url + "\n请求头："+ JsonKit.toJson(headerMap) +"\n请求参数：" + data + "\n返回值：" + ret + "\n返回状态：" + status);
            }
            return ret;
        }catch (Exception e){
            log.error(e.getMessage(),e);
        }

        return null;
    }


    public RestApiResult getToResult(String uri,Map<String,Object> data){
        SfTokenPojo tokenPojo = sfTokenBusi.getToken();
        if(tokenPojo == null){
            return RestApiResult.newFail("token参数为空");
        }

        String url = new StringBuffer(tokenPojo.getUrl()).append(uri).toString();
        HttpRequest request = HttpUtil.createGet(url);

        Map<String, String> headerMap = new HashMap<>();;
        headerMap.put(Header.AUTHORIZATION.getValue(),tokenPojo.getToken());
        headerMap.put(Header.ACCEPT.getValue(),"application/json");

        request.headerMap(headerMap,true);

        try{
            HttpResponse httpResponse = request.form(data).execute();
            String ret = httpResponse.body();
            int status = httpResponse.getStatus();

            if(log.isInfoEnabled()){
                log.info("请求地址：" + url + "\n请求头："+ JsonKit.toJson(headerMap) +"\n请求参数：" + data + "\n返回值：" + ret + "\n返回状态：" + status);
            }

            if(!httpResponse.isOk()){
                return RestApiResult.newFail("请求失败，失败原因：" + ret);
            }

            return RestApiResult.newSuccessWithData(ret);
        }catch (Exception e){
            log.error(e.getMessage(),e);
        }

        return RestApiResult.newFail("请求失败");
    }

    public RestApiResult getToResult(String uri){
        Map<String,Object> data = new HashMap<>();
        return getToResult(uri,data);
    }



    public String get(String uri,Map<String,Object> data){
        return (String) getToResult(uri,data).getData();
    }


    public String get(String uri){
        Map<String,Object> data = new HashMap<>();
        return (String) getToResult(uri,data).getData();
    }


    public String patch(String uri,String data){
        return send(uri,data, Method.PATCH);
    }


    public String patch(String uri,Map<String,Object> data){
        return patch(uri, JSON.toJSONString(data));
    }


    public RestApiResult patchToResult(String uri,String data){
        return sendToResult(uri,data,Method.PATCH);
    }


    public RestApiResult patchToResult(String uri,Map<String,Object> data){
        return patchToResult(uri,JSON.toJSONString(data));
    }
}
