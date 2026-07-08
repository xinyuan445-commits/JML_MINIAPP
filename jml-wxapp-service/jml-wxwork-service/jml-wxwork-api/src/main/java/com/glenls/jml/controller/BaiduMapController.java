package com.glenls.jml.controller;

import com.glenls.jml.kit.BaiduMapKit;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import io.jboot.web.controller.annotation.RequestMapping;


@RequestMapping("/api/baiduMap")
public class BaiduMapController extends Base4JmlAuthController {


    public void getAddrByLngAndLat(){
        renderJson(BaiduMapKit.getAddrByLngAndLat(getPara("lng"),getPara("lat")));
    }
}
