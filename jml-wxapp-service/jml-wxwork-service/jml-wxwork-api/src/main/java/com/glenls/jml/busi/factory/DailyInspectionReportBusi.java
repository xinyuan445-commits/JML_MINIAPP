package com.glenls.jml.busi.factory;

import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.ObjUtil;
import com.alibaba.druid.util.StringUtils;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.constant.factory.DailyInspectionStatusEnum;
import com.glenls.jml.kit.BeanModelKit;
import com.glenls.jml.kit.GeneratorSerNoKit;
import com.glenls.jml.model.factory.DailyInspectionReportModel;
import com.glenls.jml.model.factory.NitrogenLogModel;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.jml.pojo.factory.DailyInspectionReportPojo;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.utils.StrUtil;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


public class DailyInspectionReportBusi {
    @Inject
    private DailyInspectionReportModel dailyInspectionReportDao;
    @Inject
    private GeneratorSerNoKit generatorSerNoKit;

    private static String NAME_PREFIX = "MRXJ";


    private static String TYPE_EB_SKIN = "ebSkin";

    private static String TYPE_PRESS  = "press";

    private static String TYPE_CHAMFER = "chamfer";

    private static String TYPE_PRINT_LINE = "printLine";

    @Inject
    FactoryTmpMsgBusi  factoryTmpMsgBusi;


    private static String OBJ_CODE = "XJBB";

    private static String OBJ_NAME = "巡检报表";

    private static String OBJ_PATH = "factory/pages/dailyInspection/Detailed?id=";

    private ThreadPoolExecutor sendFacTmplMsg = ThreadUtil.newExecutor(2, 50);


    public RestApiResult save(DailyInspectionReportPojo pojo, Map<String,Object> paramsMap) {
        DailyInspectionReportModel model = BeanModelKit.printProperties(pojo, DailyInspectionReportModel.class, true);
        model.set("inspector_staff_id", paramsMap.get("staffId"));
        if (StringUtils.isEmpty(model.get("id"))) {
            model.set("name", generatorSerNoKit.generateFactorySN(model._getTableName(), NAME_PREFIX));
            JmlKit.setSaveModel(model, paramsMap);
            if(StringUtils.isEmpty(pojo.getInspectionStatus())){
                model.set("inspection_status", DailyInspectionStatusEnum.STATUS_DTJ.getDesc());
            }
            model.save();
            if(ObjUtil.isNotEmpty(pojo.getInspectionStatus()) && pojo.getInspectionStatus().equals(DailyInspectionStatusEnum.STATUS_DQR.getDesc())){
                List<String> confirmIds = new ArrayList<String>();
                StaffPojo staffPojo =  (StaffPojo) paramsMap.get("staff");
                paramsMap.put("objCode", OBJ_CODE);
                paramsMap.put("factoryType", OBJ_NAME);
                paramsMap.put("pagePath", OBJ_PATH+model.get("id"));
                paramsMap.put("name", model.get("name"));
                paramsMap.put("createName",staffPojo.getStaffName());
                if(StrUtil.isNotEmpty(pojo.getEbSkinConfirmStaffId())){
                    confirmIds.add(pojo.getEbSkinConfirmStaffId());
                }
                if(StrUtil.isNotEmpty(pojo.getPressConfirmStaffId())){
                    confirmIds.add(pojo.getPressConfirmStaffId());
                }
                if(StrUtil.isNotEmpty(pojo.getChamferConfirmStaffId())){
                    confirmIds.add(pojo.getChamferConfirmStaffId());
                }
                if(StrUtil.isNotEmpty(pojo.getPrintLineConfirmStaffId())){
                    confirmIds.add(pojo.getPrintLineConfirmStaffId());
                }
                paramsMap.put("confirmIds", confirmIds);
                sendFacTmplMsg.execute(() -> factoryTmpMsgBusi.sendATmplMsg(paramsMap));
            }
            return RestApiResult.newSuccess("新增每日巡检报表成功", model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id", paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改每日巡检报表单成功", model.get("id"));
    }


    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap) {
        Page<DailyInspectionReportModel> page = dailyInspectionReportDao.queryPageBy(pageNo, pageSize, paramsMap);
        List<DailyInspectionReportModel> list = page.getList();
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        for (DailyInspectionReportModel model : list) {
            checkEdit(model, staffPojo);
            model.put("checkAll", dailyInspectionReportDao.countCheckAll(model.get("id")));
        }
        return RestApiResult.newSuccess("获取每日巡检报表成功",page);
    }


    public RestApiResult queryDetails(Map<String,Object> paramsMap) {
        String id = paramsMap.get("id").toString();
        if (StringUtils.isEmpty(id)) {
            return RestApiResult.newFail("每日巡检报表Id不能为空");
        }
        DailyInspectionReportModel model = dailyInspectionReportDao.queryDetails(id);
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        checkConfirmAndEdit(model, staffPojo);
        model.put("checkEbSkin", dailyInspectionReportDao.countCheckEbSkin(id));
        model.put("checkPress", dailyInspectionReportDao.countCheckPress(id));
        model.put("checkChamfer", dailyInspectionReportDao.countCheckChamfer(id));
        model.put("checkPrintLine", dailyInspectionReportDao.countPrintLine(id));
        return RestApiResult.newSuccess("获取每日巡检报表明细成功", model);
    }


    private void checkConfirmAndEdit(DailyInspectionReportModel model, StaffPojo staffPojo) {
        if (model == null || staffPojo == null) {
            return;
        }
        String ebSkinConfirmStaffId = model.get("ebSkinConfirmStaffId");
        String pressConfirmStaffId = model.get("pressConfirmStaffId");
        String chamferConfirmStaffId = model.get("chamferConfirmStaffId");
        String printLineConfirmStaffId = model.get("printLineConfirmStaffId");
        String createdStaffId = model.get("createdStaffId");
        String status = model.get("inspectionStatus");

        if (ebSkinConfirmStaffId != null && ebSkinConfirmStaffId.equals(staffPojo.getStaffId())
                && JmlKit.FLAG_0.equals(model.get("ebSkinConfirmStatus"))) {
            model.put("isEbConfirm", JmlKit.FLAG_1);
        } else {
            model.put("isEbConfirm", JmlKit.FLAG_0);
        }

        if (pressConfirmStaffId != null && pressConfirmStaffId.equals(staffPojo.getStaffId())
                && JmlKit.FLAG_0.equals(model.get("pressConfirmStatus"))) {
            model.put("isPressConfirm", JmlKit.FLAG_1);
        } else {
            model.put("isPressConfirm", JmlKit.FLAG_0);
        }

        if (chamferConfirmStaffId != null && chamferConfirmStaffId.equals(staffPojo.getStaffId())
                && JmlKit.FLAG_0.equals(model.get("chamferConfirmStatus"))) {
            model.put("isChamferConfirm", JmlKit.FLAG_1);
        } else {
            model.put("isChamferConfirm", JmlKit.FLAG_0);
        }

        if (printLineConfirmStaffId != null && printLineConfirmStaffId.equals(staffPojo.getStaffId())
                && JmlKit.FLAG_0.equals(model.get("printLineConfirmStatus"))) {
            model.put("isPrintConfirm", JmlKit.FLAG_1);
        } else {
            model.put("isPrintConfirm", JmlKit.FLAG_0);
        }

        if (createdStaffId.equals(staffPojo.getStaffId())
                && DailyInspectionStatusEnum.STATUS_DTJ.getDesc().equals(status)) {
            model.put("isEdit", JmlKit.FLAG_1);
        } else {
            model.put("isEdit", JmlKit.FLAG_0);
        }
    }



    private void checkEdit(DailyInspectionReportModel model, StaffPojo staffPojo) {
        if (model == null || staffPojo == null) {
            return;
        }
        String createdStaffId = model.get("createdStaffId");
        String status = model.get("inspectionStatus");

        if (createdStaffId.equals(staffPojo.getStaffId())
                && DailyInspectionStatusEnum.STATUS_DTJ.getDesc().equals(status)) {
            model.put("isEdit", JmlKit.FLAG_1);
        } else {
            model.put("isEdit", JmlKit.FLAG_0);
        }
    }


    public RestApiResult confirm(Map<String,Object> paramsMap) {
        DailyInspectionReportModel model = dailyInspectionReportDao.queryDetails(paramsMap.get("id").toString());
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        paramsMap.put("objCode", OBJ_CODE);
        paramsMap.put("factoryType", OBJ_NAME);
        paramsMap.put("pagePath", OBJ_PATH+model.get("id"));
        paramsMap.put("name", model.get("name"));
        paramsMap.put("sendStaffId", model.get("inspectorStaffId"));
        paramsMap.put("sendStaffName",staffPojo.getStaffName());
        if(staffPojo.getStaffId().equals(model.get("ebSkinConfirmStaffId")) && JmlKit.FLAG_0.equals(model.get("ebSkinConfirmStatus")) && TYPE_EB_SKIN.equals(paramsMap.get("type"))){
           model.set("eb_skin_confirm_status", JmlKit.FLAG_1);
           model.set("eb_skin_confirm_time", AppKit.now4DB());
           paramsMap.put("status", "肤感线、EB线已确认");
           sendFacTmplMsg.execute(()->factoryTmpMsgBusi.sendBTmplMsg(paramsMap));
        }
        if(staffPojo.getStaffId().equals(model.get("pressConfirmStaffId")) && JmlKit.FLAG_0.equals(model.get("pressConfirmStatus")) && TYPE_PRESS.equals(paramsMap.get("type"))){
           model.set("press_confirm_status", JmlKit.FLAG_1);
           model.set("press_confirm_time", AppKit.now4DB());
           paramsMap.put("status", "压贴线已确认");
           sendFacTmplMsg.execute(()->factoryTmpMsgBusi.sendBTmplMsg(paramsMap));
        }
        if(staffPojo.getStaffId().equals(model.get("chamferConfirmStaffId")) && JmlKit.FLAG_0.equals(model.get("chamferConfirmStatus")) && TYPE_CHAMFER.equals(paramsMap.get("type"))){
            model.set("chamfer_confirm_status", JmlKit.FLAG_1);
            model.set("chamfer_confirm_time", AppKit.now4DB());
            paramsMap.put("status", "倒角线已确认");
            sendFacTmplMsg.execute(()->factoryTmpMsgBusi.sendBTmplMsg(paramsMap));
        }
        if(staffPojo.getStaffId().equals(model.get("printLineConfirmStaffId")) && JmlKit.FLAG_0.equals(model.get("printLineConfirmStatus")) && TYPE_PRINT_LINE.equals(paramsMap.get("type"))){
            model.set("print_line_confirm_status", JmlKit.FLAG_1);
            model.set("print_line_confirm_time", AppKit.now4DB());
            paramsMap.put("status", "打印线已确认");
            sendFacTmplMsg.execute(()->factoryTmpMsgBusi.sendBTmplMsg(paramsMap));
        }
        model.update();
        if(dailyInspectionReportDao.checkAllConfirmed(model.get("id"))>0){
            model.set("inspection_status", DailyInspectionStatusEnum.STATUS_YQR.getDesc());
        }

        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id", paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("确认成功");
    }



}
