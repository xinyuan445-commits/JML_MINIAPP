package com.glenls.api.modules.jml.controller;

import com.glenls.api.modules.jml.busi.DeviceRepairBusi;
import com.glenls.commons.jboot.controller.BaseController;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;


@RequestMapping("/api/core/device")
public class DeviceRepairController extends BaseController {
    @Inject
    private DeviceRepairBusi deviceRepairBusi;

    public void autoAssignRepair() {
        renderJson(deviceRepairBusi.autoAssignRepair());
    }
}
