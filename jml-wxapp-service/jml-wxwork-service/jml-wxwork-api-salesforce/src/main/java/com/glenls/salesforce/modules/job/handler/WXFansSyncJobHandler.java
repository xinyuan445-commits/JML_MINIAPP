package com.glenls.salesforce.modules.job.handler;

import com.glenls.jml.weixin.weixin.busi.OpenWxFansBusi;
import com.jfinal.aop.Aop;
import com.jfinal.aop.Inject;
import com.xxl.job.core.context.XxlJobHelper;
import com.xxl.job.core.handler.IJobHandler;
import lombok.extern.slf4j.Slf4j;


@Slf4j
public class WXFansSyncJobHandler extends IJobHandler {

    @Inject
    private OpenWxFansBusi openWxFansBusi = Aop.get(OpenWxFansBusi.class);

    @Override
    public void execute() throws Exception {
        String params = XxlJobHelper.getJobParam();
        openWxFansBusi.sync();
    }



}
