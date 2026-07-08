package com.glenls.salesforce.modules.job.handler;

import com.glenls.salesforce.modules.log.busi.XxlJobLogCleanBusi;
import com.jfinal.aop.Aop;
import com.xxl.job.core.context.XxlJobHelper;
import com.xxl.job.core.handler.IJobHandler;
import lombok.extern.slf4j.Slf4j;


@Slf4j
public class XxlLogCleanJobHandler extends IJobHandler {

    private XxlJobLogCleanBusi xxlJobLogCleanBusi = Aop.get(XxlJobLogCleanBusi.class);

    @Override
    public void execute() throws Exception {
        String params = XxlJobHelper.getJobParam();
        xxlJobLogCleanBusi.clean();
    }



}
