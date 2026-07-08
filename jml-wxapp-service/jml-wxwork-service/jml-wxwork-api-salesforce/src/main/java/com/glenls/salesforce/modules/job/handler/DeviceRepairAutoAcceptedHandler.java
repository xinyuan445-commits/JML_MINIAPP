package com.glenls.salesforce.modules.job.handler;

import com.glenls.api.modules.jml.busi.DeviceRepairBusi;
import com.jfinal.aop.Aop;
import com.jfinal.aop.Inject;
import com.xxl.job.core.handler.IJobHandler;


public class DeviceRepairAutoAcceptedHandler  extends IJobHandler {
    private DeviceRepairBusi deviceRepairBusi = Aop.get(DeviceRepairBusi.class);
    @Override
    public void execute() throws Exception {
        deviceRepairBusi.autoAssignRepair();
    }
}
