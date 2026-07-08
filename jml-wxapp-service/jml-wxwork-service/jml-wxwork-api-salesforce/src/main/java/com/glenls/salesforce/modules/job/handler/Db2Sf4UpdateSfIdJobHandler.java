package com.glenls.salesforce.modules.job.handler;

import com.glenls.salesforce.modules.db2sf4updatesfid.busi.CommUpdateSfIdBusi;
import com.glenls.salesforce.modules.sf2db4update.busi.SF2DBUpdateBusi;
import com.jfinal.aop.Aop;
import com.jfinal.aop.Inject;
import com.xxl.job.core.handler.IJobHandler;


public class Db2Sf4UpdateSfIdJobHandler extends IJobHandler {

    @Inject
    private CommUpdateSfIdBusi commUpdateSfIdBusi = Aop.get(CommUpdateSfIdBusi.class);

    @Override
    public void execute() throws Exception {
        commUpdateSfIdBusi.updateSalesReportByRemId();
    }
}
