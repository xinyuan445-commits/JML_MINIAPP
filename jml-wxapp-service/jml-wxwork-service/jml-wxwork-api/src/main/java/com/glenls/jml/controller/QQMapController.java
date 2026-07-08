package com.glenls.jml.controller;

import com.glenls.jml.kit.BaiduMapKit;
import com.glenls.jml.kit.QQMapKit;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import io.jboot.web.controller.annotation.RequestMapping;


@RequestMapping("/api/qqMap")
public class QQMapController  extends Base4JmlAuthController {

    
    public void getAddrByLngAndLat(){
       renderJson(QQMapKit.getAddrByLngAndLat(getPara("lng"),getPara("lat")));
    }

}
