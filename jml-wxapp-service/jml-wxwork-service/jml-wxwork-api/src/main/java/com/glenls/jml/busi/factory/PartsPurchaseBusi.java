package com.glenls.jml.busi.factory;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.ObjUtil;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.constant.factory.PartsApprovalBtnEnum;
import com.glenls.jml.constant.factory.PartsApprovalStatusEnum;
import com.glenls.jml.kit.BeanModelKit;
import com.glenls.jml.kit.GeneratorSerNoKit;
import com.glenls.jml.model.factory.*;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.jml.pojo.factory.PartsPurchaseDetailsPojo;
import com.glenls.jml.pojo.factory.PartsPurchasePojo;
import com.glenls.jml.pojo.factory.PublicBtnPojo;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.Page;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


@Slf4j
public class PartsPurchaseBusi {
    @Inject
    private PartsPurchaseModel partsPurchaseDao;

    @Inject
    private PartsPurchaseDetailsModel partsPurchaseDetailsDao;

    private GeneratorSerNoKit generatorSerNoKit;

    private static String NAME_PREFIX = "LPJ";

    private static String ROLE_GM = "GM";
    @Inject
    private FactoryApprovalUserCfgModel factoryApprovalUserCfgDao;

    @Inject
    private PartsPurchaseApprovalHistoryModel partsPurchaseApprovalHistoryDao;

    @Inject
    FactoryTmpMsgBusi  factoryTmpMsgBusi;


    private static String OBJ_CODE = "LDBH";

    private static String OBJ_NAME = "零配件采购";

    private static String OBJ_PATH = "factory/pages/partsPurchase/Detailed?id=";

    private ThreadPoolExecutor sendFacTmplMsg = ThreadUtil.newExecutor(2, 50);

    public RestApiResult save(PartsPurchasePojo pojo, Map<String,Object> paramsMap) {
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        PartsPurchaseModel model =  BeanModelKit.printProperties(pojo, PartsPurchaseModel.class,true);
        if(ObjUtil.isEmpty(pojo.getPartsPurchaseDetailsList())){
            return RestApiResult.newFail("零配件采购明细不能为空");
        }
        if(pojo.getStatus().equals(PartsApprovalStatusEnum.DTJ.getCode())){
            model.set("approval_status", PartsApprovalStatusEnum.DTJ.getDesc());
        }
        paramsMap.put("objCode", OBJ_CODE);
        paramsMap.put("factoryType", OBJ_NAME);
        if (StringUtils.isEmpty(pojo.getId())) {
            model.set("name", generatorSerNoKit.generateFactorySN(model._getTableName(), NAME_PREFIX));
            JmlKit.setSaveModel(model,paramsMap);
            JmlKit.setFJobTypeAndProdLineOrDept(model,paramsMap);
            if(pojo.getStatus().equals(PartsApprovalStatusEnum.SPZ.getCode())){
                model.set("approval_status", PartsApprovalStatusEnum.SPZ.getDesc());
                if(getApprovalStaffId(paramsMap).isFail()){
                    return getApprovalStaffId(paramsMap);
                }
                model.set("current_approval_staff_id",getApprovalStaffId(paramsMap).getData());
            }
            model.save();
            if(pojo.getStatus().equals(PartsApprovalStatusEnum.SPZ.getCode())){
                if(staffPojo.isFactRoleSE()){
                    pojo.setHistoryStatus("员工提交，主管正在审批");
                }
                if(staffPojo.isFactRoleGM()){
                    pojo.setHistoryStatus("员工提交，厂长正在审批");
                }
                pojo.setId(model.get("id").toString());
                saveApprovalHistory(pojo, paramsMap);
            }
            savePartsList(pojo, model.get("id"), paramsMap);
            paramsMap.put("pagePath", OBJ_PATH+model.get("id"));
            paramsMap.put("createName",staffPojo.getStaffName());
            paramsMap.put("name", model.get("name"));
            paramsMap.put("sendStaffId",model.get("current_approval_staff_id"));
            sendFacTmplMsg.execute(() -> factoryTmpMsgBusi.sendATmplMsg(paramsMap));
            return RestApiResult.newSuccess("提交成功", model.get("id"));
        }
        if(pojo.getStatus().equals(PartsApprovalStatusEnum.SPZ.getCode())){
            model.set("approval_status", PartsApprovalStatusEnum.SPZ.getDesc());
            if(getApprovalStaffId(paramsMap).isFail()){
                return getApprovalStaffId(paramsMap);
            }
            model.set("current_approval_staff_id",getApprovalStaffId(paramsMap).getData());
            if(staffPojo.isFactRoleSE()){
                pojo.setHistoryStatus("员工提交，主管正在审批");
            }
            if(staffPojo.isFactRoleGM()){
                pojo.setHistoryStatus("员工提交，厂长正在审批");
            }
            saveApprovalHistory(pojo, paramsMap);
            PartsPurchaseModel partsPurchaseModel = partsPurchaseDao.queryDetails(pojo.getId());
            paramsMap.put("pagePath", OBJ_PATH+pojo.getId());
            paramsMap.put("createName",partsPurchaseModel.get("createdStaffName"));
            paramsMap.put("name", partsPurchaseModel.get("name"));
            paramsMap.put("sendStaffId",model.get("current_approval_staff_id"));
            sendFacTmplMsg.execute(() -> factoryTmpMsgBusi.sendATmplMsg(paramsMap));
        }
        savePartsList(pojo, model.get("id"), paramsMap);
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("提交成功",model.get("id"));
    }


    private void saveApprovalHistory(PartsPurchasePojo pojo, Map<String,Object> paramsMap) {
        PartsPurchaseApprovalHistoryModel historyModel = new PartsPurchaseApprovalHistoryModel();
        historyModel.set("parts_purchase_id", pojo.getId());
        historyModel.set("approval_status", pojo.getHistoryStatus());
        historyModel.set("remark", pojo.getRemark());
        JmlKit.setSaveModel(historyModel,paramsMap);
        historyModel.save();
    }



    public RestApiResult approval(PartsPurchasePojo pojo, Map<String,Object> paramsMap) {

        PartsPurchaseModel model = partsPurchaseDao.queryDetails(pojo.getId());
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        model.set("status",pojo.getStatus());
        if(pojo.getStatus().equals(PartsApprovalStatusEnum.YTG.getCode()) && staffPojo.isFactRoleGMS()){
            pojo.setHistoryStatus("厂长审批已通过");
            paramsMap.put("status", "厂长审批已通过");
            model.set("status",PartsApprovalStatusEnum.YTG.getCode());
            model.set("approval_status", PartsApprovalStatusEnum.YTG.getDesc());
        }else {
            pojo.setHistoryStatus("主管审批已通过，待厂长审批");
            paramsMap.put("status", "主管审批已通过，待厂长审批");
            model.set("approval_status", PartsApprovalStatusEnum.SPZ.getDesc());
            model.set("status",PartsApprovalStatusEnum.SPZ.getCode());
            model.set("current_approval_staff_id",getApprovalStaffId(paramsMap).getData());
        }
        if(pojo.getStatus().equals(PartsApprovalStatusEnum.YJJ.getCode())){
            if(staffPojo.isFactRoleGM()){
                pojo.setHistoryStatus("主管已拒绝");
                paramsMap.put("status", "主管已拒绝");
            }
            if(staffPojo.isFactRoleGMS()){
                pojo.setHistoryStatus("厂长已拒绝");
                paramsMap.put("status", "厂长已拒绝");
            }
            model.set("status",PartsApprovalStatusEnum.YJJ.getCode());
            model.set("approval_status",PartsApprovalStatusEnum.YJJ.getDesc());
            model.set("current_approval_staff_id", "");
        }
        saveApprovalHistory(pojo, paramsMap);
        SFKit.updateModelSyncFlag(model);
        model.update();
        paramsMap.put("objCode", OBJ_CODE);
        paramsMap.put("factoryType", OBJ_NAME);
        paramsMap.put("pagePath", OBJ_PATH+model.get("id"));
        paramsMap.put("name", model.get("name"));
        paramsMap.put("sendStaffId", model.get("createdStaffId"));
        paramsMap.put("staffName",staffPojo.getStaffName());
        sendFacTmplMsg.execute(() -> factoryTmpMsgBusi.sendBTmplMsg(paramsMap));
        return RestApiResult.newSuccess("审批零配件采购成功", model.get("id"));
    }


    private RestApiResult getApprovalStaffId(Map<String,Object> paramsMap) {
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        String ApprovalRoleCode = staffPojo.getFactoryMRole();
        if(staffPojo.isFactRoleGM()){
            ApprovalRoleCode = "GM";
        }
        if(ObjUtil.isEmpty(factoryApprovalUserCfgDao.queryApprovalStaffId(ApprovalRoleCode))){
            return RestApiResult.newFail("该角色未配置审批人，请联系管理员");
        }
        return RestApiResult.newSuccess("获取审批人成功",factoryApprovalUserCfgDao.queryApprovalStaffId(ApprovalRoleCode).get("approvalStaffId"));
    }


    private void savePartsList(PartsPurchasePojo pojo, String purchaseId, Map<String,Object> params) {
        if (CollUtil.isEmpty(pojo.getPartsPurchaseDetailsList())) return;
        for(PartsPurchaseDetailsPojo partsPurchaseDetailsPojo : pojo.getPartsPurchaseDetailsList()){
            PartsPurchaseDetailsModel model = BeanModelKit.printProperties(partsPurchaseDetailsPojo, PartsPurchaseDetailsModel.class, true);
            model.set("parts_purchase_id", purchaseId);
            if(StringUtils.isEmpty(partsPurchaseDetailsPojo.getId())){
                JmlKit.setSaveModel(model,params);
                model.save();
            }else {
                SFKit.updateModelSyncFlag(model);
                model.update();
            }
        }
    }


    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap) {
        Page<PartsPurchaseModel> partsPurchasePage = partsPurchaseDao.queryPageBy(pageNo, pageSize, paramsMap);
        List<PartsPurchaseModel> partsPurchaseList = partsPurchasePage.getList();
        for (PartsPurchaseModel partsPurchaseModel : partsPurchaseList) {
            if (ObjUtil.isNotEmpty(partsPurchaseDetailsDao.queryListBy(partsPurchaseModel.get("id").toString()))) {
                List<PartsPurchaseDetailsModel> partsPurchaseDetailsList = partsPurchaseDetailsDao.queryListBy(partsPurchaseModel.get("id").toString());
                partsPurchaseModel.put("partsPurchaseDetailsList", partsPurchaseDetailsList);
            }
        }
        return RestApiResult.newSuccess("获取零配件采购成功", partsPurchaseDao.queryPageBy(pageNo, pageSize, paramsMap));
    }


    public RestApiResult queryDetails( Map<String,Object> paramsMap) {
        if (StringUtils.isEmpty(paramsMap.get("id").toString())) {
            return RestApiResult.newFail("零配件采购Id不能为空");
        }
        List<PublicBtnPojo> btnList = new ArrayList<>();
        PartsPurchaseModel model = partsPurchaseDao.queryDetails(paramsMap.get("id").toString());
        model.put("partsPurchaseDetailsList", partsPurchaseDetailsDao.queryListBy(model.get("id").toString()));
        model.put("historyApprovalList", partsPurchaseApprovalHistoryDao.queryListBy(model.get("id").toString()));
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        String approvalStatus = model.get("approvalStatus");
        String createdStaffId = model.get("createdStaffId");
        String currentApprovalStaffId = model.get("currentApprovalStaffId");
        boolean isDraftOrRejected = 
            PartsApprovalStatusEnum.DTJ.getDesc().equals(approvalStatus) || 
            PartsApprovalStatusEnum.YJJ.getDesc().equals(approvalStatus);
        
        boolean isCreator = createdStaffId != null && createdStaffId.equals(staffPojo.getStaffId());
        
        if (isDraftOrRejected && isCreator) {
            addButton(btnList, PartsApprovalBtnEnum.BTN_SAVE);
            addButton(btnList, PartsApprovalBtnEnum.BTN_SUBMIT);
        }
        
        boolean isPendingApproval = 
            currentApprovalStaffId != null && 
            currentApprovalStaffId.equals(staffPojo.getStaffId()) && 
            PartsApprovalStatusEnum.SPZ.getDesc().equals(approvalStatus);
        
        if (isPendingApproval) {
            addButton(btnList, PartsApprovalBtnEnum.BTN_PASS);
            addButton(btnList, PartsApprovalBtnEnum.BTN_REJECT);
        }

        if(btnList.size() > 0){
            model.put("btnList",btnList);
        }
        return RestApiResult.newSuccess("获取零配件采购明细成功", model);
    }

    public static void addButton(List<PublicBtnPojo> btnList, PartsApprovalBtnEnum btn) {
        PublicBtnPojo btnPojo = new PublicBtnPojo();
        btnPojo.setBtnCode(btn.getCode());
        btnPojo.setBtnName(btn.getDesc());
        btnList.add(btnPojo);
    }


}
