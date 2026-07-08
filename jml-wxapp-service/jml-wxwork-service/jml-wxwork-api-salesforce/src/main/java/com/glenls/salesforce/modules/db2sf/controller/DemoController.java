package com.glenls.salesforce.modules.db2sf.controller;

import cn.hutool.core.collection.CollUtil;
import com.glenls.commons.jfinal.ineterceptor.CrossDomainInterceptor;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.salesforce.modules.db2sf.busi.DbToSFBusi;
import com.glenls.salesforce.modules.db2sf.busi.DbToSFScheduleBusi;
import com.glenls.salesforce.modules.pub.busi.SfTokenBusi;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.JbootController;
import io.jboot.web.controller.annotation.RequestMapping;


@RequestMapping("/api/job/demo")
@Before({CrossDomainInterceptor.class})
public class DemoController extends JbootController {

    @Inject
    private SfTokenBusi sfTokenBusi;

    @Inject
    private DbToSFBusi dbToSFBusi;

    @Inject
    private DbToSFScheduleBusi dbToSFScheduleBusi;



    public void token(){
        renderJson(sfTokenBusi.getToken());
    }


    public void sendToSF(){
        dbToSFBusi.sendByDbId(get("code"),get("id"));
        renderJson(RestApiResult.newSuccess());
    }


    public void send(){
        dbToSFBusi.send(get("code"), CollUtil.newArrayList(get("id").split(",")));
        renderJson(RestApiResult.newSuccess());
    }


    public void syncByCode(){
        dbToSFScheduleBusi.sync(get("code"));
        renderJson(RestApiResult.newSuccess());
    }

}
