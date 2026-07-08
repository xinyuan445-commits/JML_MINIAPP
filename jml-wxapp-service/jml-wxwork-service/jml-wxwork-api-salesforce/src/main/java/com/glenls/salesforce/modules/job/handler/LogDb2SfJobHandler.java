package com.glenls.salesforce.modules.job.handler;

import com.glenls.salesforce.modules.db2sf.busi.DbToSFScheduleBusi;
import com.glenls.salesforce.modules.log.busi.LogDbSFBusi;
import com.jfinal.aop.Aop;
import com.jfinal.aop.Inject;
import com.xxl.job.core.context.XxlJobHelper;
import com.xxl.job.core.handler.IJobHandler;
import lombok.extern.slf4j.Slf4j;


@Slf4j
public class LogDb2SfJobHandler extends IJobHandler {

    @Inject
    private LogDbSFBusi logDbSFBusi = Aop.get(LogDbSFBusi.class);

    @Override
    public void execute() throws Exception {
        logDbSFBusi.bakData();
    }



}
