package com.glenls.wxwork.controller;

import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.wxwork.busi.WxWorkCustSyncBusi;
import com.glenls.wxwork.busi.WxWorkDeptSyncBusi;
import com.glenls.wxwork.validator.WxWorkSaveContactValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.core.Controller;
import io.jboot.web.controller.annotation.RequestMapping;
import lombok.extern.slf4j.Slf4j;


@RequestMapping("/openapi/wxwork")
@Slf4j
public class WexinWorkController extends Controller {

    @Inject
    private WxWorkCustSyncBusi wxWorkCustSyncBusi;

    @Inject
    private WxWorkDeptSyncBusi wxWorkDeptSyncBusi;

    public void syncDept(){
        wxWorkDeptSyncBusi.sync();
        renderJson(RestApiResult.newSuccess("同步成功"));
    }


    @Before({WxWorkSaveContactValidator.class})
    public void saveContact(){
        String userId = get("userId");
        String externalUserId = get("externalUserId");
        wxWorkCustSyncBusi.syncCustByExternalUserId(userId,externalUserId);

        renderJson(RestApiResult.newSuccess());
    }


    public void syncWxworkCust(){
        wxWorkCustSyncBusi.syncCustByUserId(get("userId"));
        renderJson(RestApiResult.newSuccess("同步微信企业客户"));
    }

    public void sync(){
        wxWorkCustSyncBusi.sync();
        renderJson(RestApiResult.newSuccess());
    }

}
