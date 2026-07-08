package com.glenls.jml.controller.factory;

import com.glenls.jml.busi.factory.FactoryNoticeBusi;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;

import java.text.ParseException;
import java.util.Map;


@RequestMapping("/api/factoryNotice")
public class FactoryNoticeController extends Base4JmlAuthController {

    @Inject
    private FactoryNoticeBusi factoryNoticeBusi;


    public void queryNoticeDay() throws ParseException {
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("date",getPara("date"));
        renderJson(factoryNoticeBusi.queryFactoryNotice(paramsMap));
    }

    public void queryNoticeInfoByDay2() {
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("day",getPara("day"));
        renderJson(factoryNoticeBusi.queryNoticeInfoByDay2(paramsMap));
    }


    public void queryNoticeInfoByDB() {
        Map<String,Object> paramsMap = initQueryMap();
        renderJson(factoryNoticeBusi.queryNoticeInfoByDB(paramsMap));
    }


}
