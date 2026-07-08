package com.glenls.jml.kit;

import cn.hutool.core.util.StrUtil;
import com.alibaba.fastjson.JSONObject;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.jfinal.kit.HttpKit;
import org.apache.commons.lang3.StringUtils;

import java.util.HashMap;
import java.util.Map;


public class QQMapKit {

    public static String TX_MAP_API_URL = "https:
    public static String TX_MAP_API_KEY ="OKTBZ-JOFKN-TPWF2-S72BS-LC5IZ-WTBHN";


    public static RestApiResult getAddrByLngAndLat(String lng, String lat){
        if(StrUtil.isEmpty(lng) || StrUtil.isEmpty(lat)){
            return RestApiResult.newFail("经纬度为空");
        }
        String reqUrl = TX_MAP_API_URL+lat+","+lng+"&key="+TX_MAP_API_KEY;
        String address=null;
        JSONObject retJson  = JSONObject.parseObject(HttpKit.get(reqUrl));
        try {
            JSONObject resultJson = JSONObject.parseObject(retJson.getString("result"));
            address = resultJson.getString("address");
        }catch (Exception e){
            return RestApiResult.newFail("请开启微信的定位功能！"+retJson);
        }
        return RestApiResult.newSuccess("获取地理位置位置成功",address);
    }


    public static void main(String[] args) {
        getAddrByLngAndLat("116.307490","39.984154");
    }

}
