package com.glenls.salesforce.modules.job.handler;

import com.glenls.salesforce.modules.db2sf.busi.DbToSFScheduleBusi;
import com.jfinal.aop.Aop;
import com.jfinal.aop.Inject;
import com.xxl.job.core.context.XxlJobHelper;
import com.xxl.job.core.handler.IJobHandler;
import lombok.extern.slf4j.Slf4j;


@Slf4j
public class Db2SfJobHandler extends IJobHandler {

    @Inject
    private DbToSFScheduleBusi dbToSFScheduleBusi = Aop.get(DbToSFScheduleBusi.class);

    @Override
    public void execute() throws Exception {
        String params = XxlJobHelper.getJobParam();
        dbToSFScheduleBusi.sync(params);
    }



}
