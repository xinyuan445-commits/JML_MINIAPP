package com.glenls.jml.busi.factory;

import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.ObjUtil;
import cn.hutool.core.util.StrUtil;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.constant.factory.DeviceRepairBtnEnum;
import com.glenls.jml.constant.factory.DeviceRepairStatusEnum;
import com.glenls.jml.constant.factory.JobAssigmentBtnEnum;
import com.glenls.jml.kit.BeanModelKit;
import com.glenls.jml.kit.GeneratorSerNoKit;
import com.glenls.jml.model.factory.*;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.jml.pojo.factory.DeviceRepairHistoryPojo;
import com.glenls.jml.pojo.factory.DeviceRepairProgressPojo;
import com.glenls.jml.pojo.factory.PublicBtnPojo;
import com.glenls.jml.pojo.factory.DeviceRepairPojo;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.Page;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


public class DeviceRepairBusi {
    @Inject
    private DeviceModel deviceDao;

    @Inject
    private DeviceRepairModel deviceRepairDao;

    @Inject
    private DeviceRepairProgressModel deviceRepairProgressDao;

    @Inject
    private DeviceRepairHistoryModel deviceRepairHistoryDao;

    @Inject
    private PartsPurchaseModel partsPurchaseDao;

    @Inject
    private DeviceRepairStaffModel deviceRepairStaffDao;


    @Inject
    private GeneratorSerNoKit generatorSerNoKit;

    private static String DR_NAME_PREFIX = "SBWX";

    private static String JZ_NAME_PREFIX = "WXJZ";



    
    public static final String FACT_SBE = "SBE";

    
    public static final String FACT_SBZ = "SBZ";

    @Inject
    FactoryTmpMsgBusi  factoryTmpMsgBusi;


    private static String OBJ_CODE = "SBX";

    private static String OBJ_NAME = "设备维修";

    private static String OBJ_PATH = "factory/pages/deviceRepair/Detailed?id=";

    private static String OBJ_PATH_List = "factory/pages/deviceRepair/Index";

    private ThreadPoolExecutor sendFacTmplMsg = ThreadUtil.newExecutor(2, 50);


    public RestApiResult submit(DeviceRepairPojo pojo, Map<String,Object> paramsMap) {

        if(StrUtil.isEmpty(pojo.getDeviceId())){
            return RestApiResult.newFail("设备不能为空");
        }
        if(StrUtil.isEmpty(pojo.getFaultDesc())){
            return RestApiResult.newFail("故障描述不能为空");
        }
        if(StrUtil.isEmpty(pojo.getLocation())){
            return RestApiResult.newFail("设备位置不能为空");
        }
        if(StrUtil.isEmpty(pojo.getImpactLevel())){
            return RestApiResult.newFail("故障影响程度不能为空");
        }

        DeviceRepairModel model = BeanModelKit.printProperties(pojo, DeviceRepairModel.class, true);
        model.set("name", generatorSerNoKit.generateFactorySN(model._getTableName(), DR_NAME_PREFIX));
        model.set("repair_status", DeviceRepairStatusEnum.DB.getDesc());
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");

        DeviceModel deviceModel = deviceDao.findById(pojo.getDeviceId());
        if(deviceModel == null){
            return RestApiResult.newFail("无对应的设备，请重新选择") ;
        }
        DeviceRepairStaffModel deviceRepairStaffModel = deviceRepairStaffDao.queryRepairStaffId(deviceModel.get("prod_line"));
        String repairStaffId = null;
        if(ObjUtil.isNotEmpty(deviceRepairStaffModel)){
            repairStaffId = deviceRepairStaffModel.get("repairStaffId");
            model.set("repairer_staff_id",repairStaffId);
            if(repairStaffId != null){
                if(repairStaffId.equals(staffPojo.getStaffId())){
                    model.set("repair_accepted",JmlKit.FLAG_1);
                }
            }
        }else {
            model.set("sbe_auto_accepted", JmlKit.FLAG_1);
        }
        JmlKit.setSaveModel(model, paramsMap);
        JmlKit.setFJobTypeAndProdLineOrDept(model, paramsMap);
        model.save();
        DeviceRepairHistoryPojo historyPojo = new DeviceRepairHistoryPojo();
        historyPojo.setDeviceRepairId(model.get("id").toString());
        historyPojo.setRemark("提交设备维修");
        saveRepairHistory(historyPojo, paramsMap);
        paramsMap.put("objCode", OBJ_CODE);
        if(repairStaffId !=null){
            paramsMap.put("sendStaffId", repairStaffId);
        }
        paramsMap.put("factoryType", OBJ_NAME);
        paramsMap.put("pagePath", OBJ_PATH_List);
        paramsMap.put("name", model.get("name"));
        paramsMap.put("createName",staffPojo.getStaffName());
        sendFacTmplMsg.execute(() -> factoryTmpMsgBusi.sendATmplMsg(paramsMap));
        return RestApiResult.newSuccess("提交设备维修成功", model.get("id"));
    }


    public RestApiResult queryDetails(Map<String,Object> paramsMap) {
        List<PublicBtnPojo> btnList = new ArrayList<>();
        if(StrUtil.isEmpty(paramsMap.get("id").toString())){
            return RestApiResult.newFail("id不能为空");
        }
        DeviceRepairModel model = deviceRepairDao.queryDetails(paramsMap.get("id").toString());
        if(ObjUtil.isEmpty(model)){
            return  RestApiResult.newFail("设备维修不存在");
        }


        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        if(DeviceRepairStatusEnum.DB.getDesc().equals(model.get("repairStatus"))
                && JmlKit.FLAG_0.equals(model.get("repairAccepted"))
                && (model.get("repairerStaffId") != null && model.get("repairerStaffId").equals(staffPojo.getStaffId()))
                && !staffPojo.getFactoryMRole().equals(FACT_SBZ)){
                model.put("showRepairAccept",JmlKit.FLAG_1);
        }

        if(staffPojo.getFactoryMRole().equals(FACT_SBZ) &&
                DeviceRepairStatusEnum.DB.getDesc().equals(model.get("repairStatus")) &&
                (( model.get("repairerStaffId") != null && staffPojo.getStaffId().equals(model.get("repairerStaffId"))) || (model.get("repairerStaffId") == null && model.get("sbeAutoAccepted").equals(JmlKit.FLAG_1)))){
            addButton(btnList, DeviceRepairBtnEnum.BTN_ASSIGN);
        }

        if(staffPojo.getFactoryMRole().equals(FACT_SBE) && staffPojo.getStaffId().equals(model.get("repairerStaffId"))
                && DeviceRepairStatusEnum.JXZ.getDesc().equals(model.get("repairStatus"))){
            addButton(btnList, DeviceRepairBtnEnum.BTN_REPAIR);
            addButton(btnList, DeviceRepairBtnEnum.BTN_COMPLETE);
        }


        if(staffPojo.getFactoryMRole().equals(FACT_SBZ) && DeviceRepairStatusEnum.YWC.getDesc().equals(model.get("repairStatus"))) {
            addButton(btnList, DeviceRepairBtnEnum.BTN_RE_ASSIGN);
            addButton(btnList, DeviceRepairBtnEnum.BTN_CANCEL);
            addButton(btnList, DeviceRepairBtnEnum.BTN_CONFIRM);
        }
        if(btnList.size()>0){
            model.put("btnList",btnList);
        }
        if(partsPurchaseDao.queryCntByDevRepairId(model.get("id").toString())>0){
            model.put("addPartsPurchase","0");
        }else {
            model.put("addPartsPurchase","1");
        }
        model.put("repairHistoryList",deviceRepairHistoryDao.queryListBy(model.get("id").toString()));
        model.put("repairProgressList",deviceRepairProgressDao.queryListBy(model.get("id").toString()));
        return RestApiResult.newSuccess("获取设备维修详情成功",model);
    }

    public static void addButton(List<PublicBtnPojo> btnList, DeviceRepairBtnEnum btn) {
        PublicBtnPojo btnPojo = new PublicBtnPojo();
        btnPojo.setBtnCode(btn.getCode());
        btnPojo.setBtnName(btn.getDesc());
        btnPojo.setBtnValue(btn.getValue());
        btnList.add(btnPojo);
    }


    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap) {
        Page<DeviceRepairModel> deviceRepairPage = deviceRepairDao.queryPageBy(pageNo, pageSize, paramsMap);
        List<DeviceRepairModel> deviceRepairModelList = deviceRepairPage.getList();
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        for (DeviceRepairModel model : deviceRepairModelList){
            if(staffPojo.getStaffId().equals(model.get("repairerStaffId"))
                    && DeviceRepairStatusEnum.DB.getDesc().equals(model.get("repairStatus"))
                    && JmlKit.FLAG_0.equals(model.get("repairAccepted"))
                    && !staffPojo.getFactoryMRole().equals(FACT_SBZ)){
                model.put("showRepairAccept",JmlKit.FLAG_1);
            }
        }
        return RestApiResult.newSuccess("获取设备维修列表成功",deviceRepairPage);
    }


    public RestApiResult accept(Map<String,Object> paramsMap) {
        DeviceRepairModel model = deviceRepairDao.findById(paramsMap.get("id").toString());
        model.set("repair_accepted",JmlKit.FLAG_1);
        model.set("repair_accepted_time", AppKit.now4DB());
        model.set("update_staff_id",paramsMap.get("staffId"));
        model.set("repair_status",DeviceRepairStatusEnum.JXZ.getDesc());
        SFKit.updateModelSyncFlag(model);
        model.update();
        DeviceRepairHistoryPojo historyPojo = new DeviceRepairHistoryPojo();
        historyPojo.setDeviceRepairId(model.get("id").toString());
        historyPojo.setRemark("员工接受维修工单");
        saveRepairHistory(historyPojo, paramsMap);

        return RestApiResult.newSuccess("接受设备维修成功");
    }



    public RestApiResult assign(DeviceRepairPojo pojo, Map<String,Object> paramsMap) {
        DeviceRepairModel model = BeanModelKit.printProperties(pojo, DeviceRepairModel.class, true);
        model.set("repair_status", DeviceRepairStatusEnum.JXZ.getDesc());
        model.set("assign_time", AppKit.now4DB());
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        DeviceRepairHistoryPojo historyPojo = new DeviceRepairHistoryPojo();
        historyPojo.setDeviceRepairId(model.get("id").toString());
        historyPojo.setRemark("分配维修员");
        saveRepairHistory(historyPojo, paramsMap);

        DeviceRepairModel deviceRepairModel = deviceRepairDao.queryDetails(model.get("id").toString());
        paramsMap.put("objCode", OBJ_CODE);
        paramsMap.put("factoryType", OBJ_NAME);
        paramsMap.put("pagePath", OBJ_PATH+model.get("id"));
        paramsMap.put("name", deviceRepairModel.get("name"));
        paramsMap.put("deviceName", deviceRepairModel.get("deviceName"));
        paramsMap.put("sendStaffId", deviceRepairModel.get("repairerStaffId"));
        paramsMap.put("createdTime", deviceRepairModel.get("createdTime"));
        paramsMap.put("staffName",deviceRepairModel.get("createdStaffName"));
        sendFacTmplMsg.execute(() -> factoryTmpMsgBusi.sendCTmplMsg(paramsMap));
        return RestApiResult.newSuccess("分配维修员成功",model.get("id"));
    }



    public RestApiResult repair(DeviceRepairProgressPojo pojo, Map<String,Object> paramsMap) {
        DeviceRepairProgressModel model = BeanModelKit.printProperties(pojo, DeviceRepairProgressModel.class, true);
        model.set("name",generatorSerNoKit.generateFactorySN(model._getTableName(),JZ_NAME_PREFIX));
        JmlKit.setSaveModel(model,paramsMap);
        model.save();
        DeviceRepairHistoryPojo historyPojo = new DeviceRepairHistoryPojo();
        historyPojo.setDeviceRepairId(pojo.getId());
        historyPojo.setRemark("添加维修进展");
        saveRepairHistory(historyPojo, paramsMap);
        return RestApiResult.newSuccess("添加维修进展成功",model.get("id"));
    }


    public RestApiResult complete(DeviceRepairPojo pojo, Map<String,Object> paramsMap) {

        DeviceRepairModel model = BeanModelKit.printProperties(pojo, DeviceRepairModel.class, true);
        if(deviceRepairProgressDao.queryListBy(model.get("id").toString()).size() == 0){
            return RestApiResult.newFail("请先添加维修进展");
        }
        if(ObjUtil.isEmpty(pojo.getSolution())){
            return RestApiResult.newFail("维修内容不能为空");
        }
        if(ObjUtil.isEmpty(pojo.getFaultAnalysis())){
            return RestApiResult.newFail("原因分析不能为空");
        }
        if(ObjUtil.isEmpty(pojo.getPreventionMethod())){
            return RestApiResult.newFail("预防措施不能为空");
        }
        if(ObjUtil.isEmpty(pojo.getReplacePart())){
            return RestApiResult.newFail("是否需要更换配件必选");
        }
        model.set("repair_status", DeviceRepairStatusEnum.YWC.getDesc());
        model.set("completion_time", AppKit.now4DB());
        model.set("completion_staff_id",paramsMap.get("staffId"));
        model.set("update_staff_id", paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        DeviceRepairHistoryPojo historyPojo = new DeviceRepairHistoryPojo();
        historyPojo.setDeviceRepairId(model.get("id").toString());
        historyPojo.setRemark("完成维修");
        saveRepairHistory(historyPojo, paramsMap);
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        DeviceRepairModel deviceRepairModel = deviceRepairDao.queryDetails(model.get("id").toString());
        paramsMap.put("objCode", OBJ_CODE);
        paramsMap.put("factoryType", OBJ_NAME);
        paramsMap.put("pagePath", OBJ_PATH+model.get("id"));
        paramsMap.put("name", deviceRepairModel.get("name"));
        paramsMap.put("sendStaffId", deviceRepairModel.get("repairerStaffId"));
        paramsMap.put("staffName",staffPojo.getStaffName());
        paramsMap.put("status",DeviceRepairStatusEnum.YWC.getDesc());
        sendFacTmplMsg.execute(() -> factoryTmpMsgBusi.sendBTmplMsg(paramsMap));
        return RestApiResult.newSuccess("完成维修成功", model.get("id"));
    }


    public RestApiResult cancel(DeviceRepairPojo pojo, Map<String,Object> paramsMap) {
        DeviceRepairModel model = BeanModelKit.printProperties(pojo, DeviceRepairModel.class, true);
        model.set("repair_status", DeviceRepairStatusEnum.YQX.getDesc());
        model.set("cancel_staff_id",paramsMap.get("staffId") );
        model.set("cancel_time",AppKit.now4DB());
        model.set("update_staff_id", paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        DeviceRepairHistoryPojo historyPojo = new DeviceRepairHistoryPojo();
        historyPojo.setDeviceRepairId(model.get("id").toString());
        historyPojo.setRemark("取消维修");
        saveRepairHistory(historyPojo, paramsMap);
        return RestApiResult.newSuccess("取消维修成功", model.get("id"));
    }


    public RestApiResult confirm(DeviceRepairPojo pojo, Map<String,Object> paramsMap) {
        DeviceRepairModel model = BeanModelKit.printProperties(pojo, DeviceRepairModel.class, true);
        model.set("repair_status", DeviceRepairStatusEnum.YRK.getDesc());
        model.set("confirmed_staff_id", paramsMap.get("staffId"));
        model.set("repair_confirmed", JmlKit.FLAG_1);
        model.set("confirmed_time", AppKit.now4DB());
        model.set("update_staff_id", paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        DeviceRepairHistoryPojo historyPojo = new DeviceRepairHistoryPojo();
        historyPojo.setDeviceRepairId(model.get("id").toString());
        historyPojo.setRemark("认可维修");
        saveRepairHistory(historyPojo, paramsMap);
        return RestApiResult.newSuccess("认可维修成功", model.get("id"));
    }


    private void saveRepairHistory(DeviceRepairHistoryPojo pojo, Map<String,Object> paramsMap) {
        DeviceRepairHistoryModel model = new DeviceRepairHistoryModel();
        model.set("remark", pojo.getRemark());
        model.set("device_repair_id", pojo.getDeviceRepairId());
        JmlKit.setSaveModel(model, paramsMap);
        model.save();
    }

    public RestApiResult queryDevices() {
        return RestApiResult.newSuccess("获取设备列表成功", deviceDao.queryList());
    }


}
