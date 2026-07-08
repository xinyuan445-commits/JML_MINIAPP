package com.glenls.api.modules.jml.busi;


import cn.hutool.core.thread.ThreadUtil;
import com.glenls.api.modules.jml.kit.JmlKit;
import com.glenls.api.modules.jml.model.DeviceRepairHistoryModel;
import com.glenls.api.modules.jml.model.DeviceRepairModel;
import com.glenls.api.modules.jml.model.FactoryApprovalUserCfgModel;
import com.glenls.commons.lang.idegen.TimeIdGeneratorKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.jfinal.aop.Inject;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


public class DeviceRepairBusi {

    @Inject
    private DeviceRepairModel deviceRepairDao;

    @Inject
    private FactoryApprovalUserCfgModel approvalUserCfgDao;

    private static String  SBE ="SBE";

    private static String OBJ_CODE = "SBX";

    private static String OBJ_NAME = "设备维修";

    private static String OBJ_PATH = "factory/pages/deviceRepair/Detailed?id=";

    private ThreadPoolExecutor sendFacTmplMsg = ThreadUtil.newExecutor(2, 50);

    @Inject
    private FactoryTmpMsgBusi factoryTmpMsgBusi;


    public RestApiResult autoAssignRepair() {
        List<DeviceRepairModel> deiceRepairModelList = deviceRepairDao.queryCreate15Min();
        if(deiceRepairModelList !=null && deiceRepairModelList.size()> 0){
            for (DeviceRepairModel model : deiceRepairModelList) {

                FactoryApprovalUserCfgModel staffModel = approvalUserCfgDao.queryApprovalStaffId(SBE);
                model.set("id", model.get("id"));
                model.set("repairer_staff_id",staffModel.get("approvalStaffId"));
                model.set("sync_status", JmlKit.FLAG_1);
                model.set("sbe_auto_accepted", JmlKit.FLAG_1);
                model.update();
                DeviceRepairHistoryModel historyModel = new DeviceRepairHistoryModel();
                historyModel.set("remark", "员工未接受，自动分配给设备部主管");
                historyModel.set("device_repair_id", model.get("id"));
                historyModel.set("created_staff_id", staffModel.get("approvalStaffId"));
                historyModel.set("update_staff_id", staffModel.get("approvalStaffId"));
                historyModel.set("id",TimeIdGeneratorKit.genTimeNo());
                historyModel.save();
                DeviceRepairModel deviceRepairModel = deviceRepairDao.queryDetails(model.get("id"));
                Map<String,Object> sendMap = new HashMap<>();
                sendMap.put("factoryType", OBJ_NAME);
                sendMap.put("pagePath", OBJ_PATH+deviceRepairModel.get("id"));
                sendMap.put("name", deviceRepairModel.get("name"));
                sendMap.put("sendStaffId", deviceRepairModel.get("repairerStaffId"));
                sendMap.put("createdTime", deviceRepairModel.get("createdTime"));
                sendMap.put("staffName",deviceRepairModel.get("createdStaffName"));
                sendMap.put("status",deviceRepairModel.get("repairStatus"));
                sendMap.put("objCode", OBJ_CODE);
                sendFacTmplMsg.execute(() -> factoryTmpMsgBusi.sendDTmplMsg(sendMap));
            }
        }
        return  RestApiResult.newSuccess("自动分配成功");
    }
}
