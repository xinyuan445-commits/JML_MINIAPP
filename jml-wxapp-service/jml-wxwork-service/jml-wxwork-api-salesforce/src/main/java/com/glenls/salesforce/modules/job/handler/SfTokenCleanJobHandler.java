package com.glenls.salesforce.modules.job.handler;

import com.glenls.salesforce.modules.db2sf.busi.ConfDbSfBusi;
import com.glenls.salesforce.modules.pub.busi.SfTokenBusi;
import com.glenls.salesforce.modules.sf2db.busi.SF2DBBusi;
import com.jfinal.aop.Aop;
import com.jfinal.aop.Inject;
import com.xxl.job.core.context.XxlJobHelper;
import com.xxl.job.core.handler.IJobHandler;
import io.jboot.Jboot;
import lombok.extern.slf4j.Slf4j;


@Slf4j
public class SfTokenCleanJobHandler extends IJobHandler {

    @Override
    public void execute() throws Exception {
        String params = XxlJobHelper.getJobParam();
        Jboot.getRedis().del(SfTokenBusi.key, ConfDbSfBusi.key);
    }



}
