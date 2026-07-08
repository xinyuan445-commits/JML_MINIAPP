package com.glenls.jml.kit;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.kit.HttpKit;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;


@Slf4j
public class BaiduMapKit {

    
    public static final String BAIDU_MAP_URL = "https:
    public static final String BAIDU_REV_MAP_URL = "https:

    public static final String BAIDU_MAP_AK = "nDiejM3iymv0rKEeHLHUIFdeiZX1Tu9x";
    
    
    public static RestApiResult getLngAndLatByAddr(String address){
        try {
            JSONObject jsonObject = new JSONObject();
            String ret = HttpKit.get(BAIDU_MAP_URL+"?address="+address+"&output=json&ak="+BAIDU_MAP_AK);
            if(StringUtils.isNotEmpty(ret)){
                jsonObject = JSON.parseObject(ret);
            }
            if(jsonObject.get("status").toString().equals(JmlKit.FLAG_0)){
                System.out.println(jsonObject.get("result"));
                JSONObject JSONLocation = JSON.parseObject(jsonObject.get("result").toString());
                System.out.println(JSONLocation.get("location"));
                return RestApiResult.newSuccess("获取数据成功",JSONLocation.get("location"));
            }else{
                return RestApiResult.newFail(jsonObject.get("msg").toString());
            }
        }catch (Exception e){
            log.error(e.getMessage(),e);
        }

        return RestApiResult.newFail("地址解析失败");
    }

    
    

    public static RestApiResult getAddrByLngAndLat(String lng, String lat){
        JSONObject jsonObject = new JSONObject();
        String ret = HttpKit.get(BAIDU_REV_MAP_URL+"?ak="+BAIDU_MAP_AK+"&output=json&coordtype=wgs84ll&location="+lat+","+lng);
        if(StringUtils.isNotEmpty(ret)){
            jsonObject = JSON.parseObject(ret);
        }
        if(jsonObject.get("status").toString().equals(JmlKit.FLAG_0)){
            JSONObject JSONAddr = JSON.parseObject(jsonObject.get("result").toString());
            System.out.println(JSONAddr.get("formatted_address"));
            return RestApiResult.newSuccess("获取地址成功",JSONAddr.get("formatted_address"));
        }else {
            System.out.println(jsonObject.get("message"));
            return RestApiResult.newFail(jsonObject.get("message").toString());
        }

    }

    public static void main(String[] args) {
        BaiduMapKit.getAddrByLngAndLat("121.2383","31.3703");
    }
}
