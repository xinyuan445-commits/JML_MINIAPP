package com.glenls.salesforce.modules.job.handler;

import com.glenls.salesforce.modules.sf2db4update.busi.SF2DBUpdateBusi;
import com.jfinal.aop.Aop;
import com.jfinal.aop.Inject;
import com.xxl.job.core.context.XxlJobHelper;
import com.xxl.job.core.handler.IJobHandler;
import lombok.extern.slf4j.Slf4j;


@Slf4j
public class Sf2DbUpdateJobHandler extends IJobHandler {

    @Inject
    private SF2DBUpdateBusi sf2DbBusi = Aop.get(SF2DBUpdateBusi.class);

    @Override
    public void execute() throws Exception {
        String params = XxlJobHelper.getJobParam();
        sf2DbBusi.save(params);
    }



}
