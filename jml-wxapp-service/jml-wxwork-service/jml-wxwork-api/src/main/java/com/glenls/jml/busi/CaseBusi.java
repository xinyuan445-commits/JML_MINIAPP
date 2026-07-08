package com.glenls.jml.busi;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.ObjUtil;
import cn.hutool.core.util.StrUtil;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.constant.CaseCommType;
import com.glenls.jml.kit.GeneratorSerNoKit;
import com.glenls.jml.model.*;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.jml.pojo.jmlcase.*;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.Db;
import com.jfinal.plugin.activerecord.Model;
import com.jfinal.plugin.activerecord.Page;
import jdk.nashorn.internal.runtime.logging.Logger;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


@Slf4j
public class CaseBusi {

    @Inject
    private CaseModel caseDao;

    @Inject
    private CaseAcceptanceHistoryBusi caseAcceptanceHistoryBusi;

    @Inject
    private CaseApprovalHistoryModel caseApprovalHistoryDao;

    @Inject
    private CaseStageCfgModel caseStageCfgDao;

    @Inject
    private CaseAcceptanceHistoryModel caseAcceptanceHistoryDao;

    @Inject
    private CaseOrderDetailModel caseOrderDetailDao;
    @Inject
    private CaseQaOpinionModel caseQaOpinionDao;
    @Inject
    private CaseSolutionModel caseSolutionDao;

    private ThreadPoolExecutor sendTmplMsg = ThreadUtil.newExecutor(2, 50);
    @Inject
    private ContactModel contactDao;

    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        Page<CaseModel> casePage = caseDao.queryPageBy(pageNo,pageSize,paramsMap);
        List<CaseModel> listCase = casePage.getList();
        for (CaseModel caseModel:listCase){
            List<CaseAcceptanceHistoryModel> caseStageList = caseAcceptanceHistoryBusi.queryHistoryShowList(caseModel.get("id"));
            caseModel.put("stageList",caseStageList);
            caseModel.put("isEdit",checkEdit(paramsMap,caseModel));
        }
        return RestApiResult.newSuccess("获取客诉分页列表成功",casePage);
    }


    public RestApiResult queryDetails(Map<String,Object> paramsMap){
        RestApiResult restApiResult = RestApiResult.newSuccess();
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("客诉Id不能为空");
        }
        String caseId = paramsMap.get("id").toString();
        Map<String,Object> retMap = new HashMap<>();
        CaseModel basicModel = caseDao.queryDetails(caseId);
        retMap.put("basic",basicModel);

        List<CaseAcceptanceHistoryModel> stageList=  caseAcceptanceHistoryBusi.queryHistoryShowList(caseId);
        retMap.put("stageList",stageList);

        

        List<CaseApprovalHistoryModel> historyRelatedList= caseApprovalHistoryDao.queryListBy(caseId);
        retMap.put("historyRelatedList",historyRelatedList);

        
        List<CaseOrderDetailModel> orderDetailList = caseOrderDetailDao.queryListBy(caseId);
        retMap.put("orderDetailList",orderDetailList);

        
        retMap.put("qaOpinion",caseQaOpinionDao.queryDetails(caseId));

        
        List<CaseSolutionModel> solutionList= caseSolutionDao.querySolutionRole(caseId);
        for(CaseSolutionModel roleModel:solutionList){
            roleModel.put("solutionInfo",caseSolutionDao.queryListBy(caseId,roleModel.get("solution_role")));
        }
        retMap.put("solutionList",solutionList);
        
        retMap.put("isEdit",checkEdit(paramsMap,basicModel));


        Map<String,Object> nextStageParamMap = new HashMap<String,Object>();
        nextStageParamMap.put("stageCode",basicModel.get("caseStageCode"));
        nextStageParamMap.put("caseId",basicModel.get("id"));
        if(!CaseCommType.CLOSE.getCode().equals(basicModel.get("caseStageCode")) && JmlKit.FLAG_0.equals(basicModel.get("sfCreated"))){
            CaseAcceptanceHistoryModel nextStageModel =  caseAcceptanceHistoryDao.queryNextStage(nextStageParamMap);
            if(ObjUtil.isEmpty(nextStageModel)){
                return RestApiResult.newFail("客诉明细未找到对应的阶段，请联系管理员");
            }
            retMap.put("btnName",nextStageModel.get("acceptance_status"));
            retMap.put("btnCode",nextStageModel.get("case_stage_code"));
            retMap.put("showBtn",checkStageBtn(basicModel,paramsMap));
        }
        if(ObjectUtils.isNotEmpty(basicModel) && ObjectUtils.isNotEmpty(basicModel.get("accountId"))){
            paramsMap.put("accountId",basicModel.get("accountId"));
            retMap.put("contactList",contactDao.queryListByStaff(paramsMap));
        }

        restApiResult.setData(retMap);
        return restApiResult;
    }


    private String checkStageBtn(CaseModel model,Map<String,Object> paramsMap){
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        boolean isAdmin = JmlKit.FLAG_1.equals(staffPojo.getIsAdmin());
        boolean isSameStaffId = paramsMap.get("staffId").equals(model.get("currentAcceptanceStaffId"));
        return isSameStaffId || isAdmin ? JmlKit.FLAG_1 : JmlKit.FLAG_0;
    }


    public static String checkEdit(Map<String,Object> paramsMap,CaseModel model){
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        String createdStaffId = model.get("created_staff_id");
        String salesStaffId = model.get("salesStaffId");
        log.info("--staffPojo.isRoleSR()----"+staffPojo.isRoleSR());
        log.info("--createdStaffId----"+createdStaffId);
        log.info("--salesStaffId----"+salesStaffId);
        if(staffPojo.isRoleSR() && staffPojo.getStaffId().equals(salesStaffId)){
            return JmlKit.FLAG_1;
        }
        if(staffPojo.isRoleSR() && !staffPojo.getStaffId().equals(createdStaffId)){
            return JmlKit.FLAG_0;
        }
        return JmlKit.FLAG_1;
    }


    public RestApiResult saveNew(CasePojo casePojo, Map<String,Object> paramsMap){

        String stageCode = casePojo.getCaseStageCode();
        
        Map<String,Object> approvalHistoryMap = new HashMap<>();
        approvalHistoryMap.putAll(paramsMap);
        approvalHistoryMap.put("caseStage",CaseCommType.getDescByCode(stageCode));
        approvalHistoryMap.put("stageCode",stageCode);


        CaseModel caseModel = getCaseModel(casePojo);

        if(casePojo.getServiceType().equals(CaseCommType.SERVICE_TYPE_SHFW.getDesc())){
            if(StrUtil.isEmpty(casePojo.getFeedbackType())){
                return RestApiResult.newFail("反馈类型不能为空");
            }
            if(StrUtil.isEmpty(casePojo.getFeedbackPersonType())){
                return RestApiResult.newFail("反馈人类型不能为空");
            }
            if (StrUtil.isEmpty(casePojo.getSheetStatus())) {
                return RestApiResult.newFail("板材类型不能为空");
            }
            if(StrUtil.isEmpty(casePojo.getOnsiteInspection())){
                return RestApiResult.newFail("是否现场勘查不能为空");
            }
            if(CollUtil.isEmpty(casePojo.getDetailList())){
                return RestApiResult.newFail("服务类型为：售后服务时，售后服务订单明细不能为空");
            }
        }
        List<CaseOrderDetailModel> detailInsertModelList = new ArrayList<>();
        List<CaseOrderDetailModel> detailUpdateModelList = new ArrayList<>();
        if(CollUtil.isNotEmpty(casePojo.getDetailList())){
            for(CaseOrderDetailPojo detailPojo : casePojo.getDetailList()){
                CaseOrderDetailModel detailModel = getOrderDetailModel(detailPojo);
                if(StrUtil.isEmpty(detailPojo.getSalesDesc())){
                    return RestApiResult.newFail("销售描述不能为空");
                }
                if(StrUtil.isEmpty(detailPojo.getOnSiteImg1())){
                    return RestApiResult.newFail("现场图片不能为空");
                }
                if(StrUtil.isEmpty(detailPojo.getNoImg1())){
                    return RestApiResult.newFail("侧边喷码（批号）不能为空");
                }
                if(StrUtil.isEmpty(detailPojo.getBreakImg1())){
                    return RestApiResult.newFail("损坏的具体照片不能为空");
                }
                if(StrUtil.isEmpty(detailPojo.getId())){
                    JmlKit.setSaveModel(detailModel,paramsMap);
                    detailInsertModelList.add(detailModel);
                }else{
                    JmlKit.removeUpdateModel(detailModel);
                    detailModel.set("id",detailPojo.getId());
                    detailModel.set("update_staff_id",paramsMap.get("staffId"));
                    detailUpdateModelList.add(detailModel);
                }
            }
        }
        if(StrUtil.isNotEmpty(casePojo.getFactoryCode())){
            caseModel.set("factory",CaseCommType.getDescByCode(casePojo.getFactoryCode()));
        }
        
        if(StrUtil.isEmpty(casePojo.getId())){
            approvalHistoryMap.put("approvalStatus","销售新建");
            JmlKit.setSaveModel(caseModel,paramsMap);

            if (ObjUtil.isEmpty(CaseCommType.getDescByCode(stageCode))) {
                return RestApiResult.newFail("客诉保存未找到对应的阶段，请联系管理员");
            }

            caseModel.set("created_handing_start_time",AppKit.now4DB());

            caseModel.set("current_acceptance_staff_id",paramsMap.get("staffId"));

            caseModel.set("name", GeneratorSerNoKit.generateSerialNumber("jml_case","C"));
            caseModel.save();

            approvalHistoryMap.put("caseId", caseModel.get("id"));


            Map<String,Object> histroyMap = new HashMap<>();
            histroyMap.put("serviceType", caseModel.get("service_type"));
            histroyMap.put("caseId", caseModel.get("id"));
            log.info("---paramsMap--"+paramsMap);
            histroyMap.putAll(paramsMap);
            histroyMap.put("areaCode", caseModel.get("area_code"));
            log.info("---histroyMap--"+histroyMap);
            RestApiResult saveHistoryApiResult = caseAcceptanceHistoryBusi.saveStageList(histroyMap);
            if(saveHistoryApiResult.isFail()){
                return RestApiResult.newFail(saveHistoryApiResult.getMsg());
            }

            if(ObjUtil.isNotEmpty(approvalHistoryMap) && !caseApprovalHistoryDao.checkNewCntBy(caseModel.get("id"))){
                saveApprovalHistory(approvalHistoryMap);
            }

            if(CaseCommType.FKYJ.getCode().equals(stageCode)){
                approvalHistoryMap.put("approvalStatus","销售提交");
                histroyMap.put("stageCode",stageCode);
                RestApiResult updateHistoryApiResult = caseAcceptanceHistoryBusi.updateStage(histroyMap);
                if(updateHistoryApiResult.isFail()){
                    return RestApiResult.newFail(updateHistoryApiResult.getMsg());
                }
                caseModel.set("created_handing_end_time",AppKit.now4DB());
                caseModel.set("feedback_start_time",AppKit.now4DB());
                caseModel.set("current_acceptance_staff_id",updateHistoryApiResult.getData());
                caseModel.set("case_stage", CaseCommType.getDescByCode(stageCode));
                SFKit.updateModelSyncFlag(caseModel);
                caseModel.update();
                saveApprovalHistory(approvalHistoryMap);
            }

        }else{
            JmlKit.removeUpdateModel(caseModel);
            caseModel.set("id",casePojo.getId());
            caseModel.set("update_staff_id",paramsMap.get("staffId"));
            caseModel.update();
        }

        if(detailInsertModelList.size()>0){
            detailInsertModelList.forEach(detailModel ->
                    detailModel.set("case_id",caseModel.get("id"))
            );
            Db.batchSave(detailInsertModelList, AppKit.BATCH_SIZE);
        }
        if(detailUpdateModelList.size()>0){
            detailUpdateModelList.forEach(detailModel -> saveOrderDetailHistory(detailModel,paramsMap));
            Db.batchUpdate(detailUpdateModelList, AppKit.BATCH_SIZE);
        }


        return RestApiResult.newSuccess("客服服务保存成功",caseModel.get("id"));
    }


    private static CaseModel getCaseModel(CasePojo casePojo){
        CaseModel caseModel = new CaseModel();
        caseModel.set("case_stage_code",casePojo.getCaseStageCode());
        caseModel.set("case_stage",CaseCommType.getDescByCode(casePojo.getCaseStageCode()));
        caseModel.set("account_id",casePojo.getAccountId());
        caseModel.set("contact_name",casePojo.getContactName());
        caseModel.set("contact_phone",casePojo.getContactPhone());
        caseModel.set("service_type",casePojo.getServiceType());
        caseModel.set("create_remark",casePojo.getCreateRemark());
        caseModel.set("sales_staff_id",casePojo.getSalesStaffId());
        caseModel.set("attachment",casePojo.getAttachment());
        caseModel.set("attachment_name",casePojo.getAttachmentName());
        caseModel.set("area_code",casePojo.getAreaCode());
        caseModel.set("district",casePojo.getDistrict());
        caseModel.set("onsite_inspection",casePojo.getOnsiteInspection());
        caseModel.set("feedback_person_type",casePojo.getFeedbackPersonType());
        caseModel.set("feedback_type",casePojo.getFeedbackType());
        caseModel.set("sheet_status",casePojo.getSheetStatus());
        caseModel.set("contact_id",casePojo.getContactId());
        return caseModel;
    }


    private static CaseOrderDetailModel getOrderDetailModel(CaseOrderDetailPojo detailPojo) {
        CaseOrderDetailModel detailModel = new CaseOrderDetailModel();
        detailModel.set("product_name",detailPojo.getProductName());
        detailModel.set("sales_desc",detailPojo.getSalesDesc());
        detailModel.set("case_class",detailPojo.getCaseClass());
        detailModel.set("order_no",detailPojo.getOrderNo());
        detailModel.set("buy_date",detailPojo.getBuyDate());
        detailModel.set("delivery_warehouse",detailPojo.getDeliveryWarehouse());
        detailModel.set("spec",detailPojo.getSpec());
        detailModel.set("buy_qty",detailPojo.getBuyQty());
        detailModel.set("unit_price",detailPojo.getUnitPrice());
        detailModel.set("total_price",detailPojo.getTotalPrice());
        detailModel.set("bad_qty",detailPojo.getBadQty());
        detailModel.set("bad_remark",detailPojo.getBadRemark());
        detailModel.set("demands",detailPojo.getDemands());
        detailModel.set("on_site_img1",detailPojo.getOnSiteImg1());
        detailModel.set("no_img1",detailPojo.getNoImg1());
        detailModel.set("break_img1",detailPojo.getBreakImg1());
        detailModel.set("other_img1",detailPojo.getOtherImg1());
        detailModel.set("other_img2",detailPojo.getOtherImg2());
        detailModel.set("other_img3",detailPojo.getOtherImg3());
        detailModel.set("sales_desc",detailPojo.getSalesDesc());
        detailModel.set("inventory_code",detailPojo.getInventoryCode());
        detailModel.set("side_code",detailPojo.getSideCode());
        return detailModel;
    }


    private void saveApprovalHistory(Map<String,Object> paramsMap){
            CaseApprovalHistoryModel model = new CaseApprovalHistoryModel();
            model.set("case_id",paramsMap.get("caseId"));
            model.set("case_stage",paramsMap.get("caseStage"));
            model.set("case_stage_code",paramsMap.get("stageCode"));
            model.set("approval_status",paramsMap.get("approvalStatus"));
            model.set("remark",paramsMap.get("remark"));
            JmlKit.setSaveModel(model,paramsMap);
            SFKit.updateModelSyncFlag(model);
            model.save();
    }

    public RestApiResult caseDoNew(CasePojo casePojo,Map<String,Object> paramsMap){
        String stageCode = casePojo.getCaseStageCode();
        String caseId = casePojo.getId();

        
        Map<String,Object> approvalHistoryMap = new HashMap<>();
        approvalHistoryMap.putAll(paramsMap);
        approvalHistoryMap.put("caseId",caseId);
        approvalHistoryMap.put("stageCode",stageCode);
        approvalHistoryMap.put("caseStage",CaseCommType.getDescByCode(stageCode));
        
        Map<String,Object> histroyMap = new HashMap<>();
        histroyMap.put("caseId",caseId);
        histroyMap.put("stageCode",stageCode);
        histroyMap.put("caseStage",CaseCommType.getDescByCode(stageCode));
        histroyMap.putAll(paramsMap);

        CaseModel model = new CaseModel();
        model.set("id",caseId);

        if(StrUtil.isNotEmpty(casePojo.getFeedbackRemark())){
            model.set("feedback_remark",casePojo.getFeedbackRemark());
        }

        List<CaseSolutionDetailPojo> listSolution = casePojo.getSolutionList();

        if(CaseCommType.FKYJ.getCode().equals(stageCode) ){

            model.set("created_handing_end_time",AppKit.now4DB());

            model.set("feedback_start_time",AppKit.now4DB());
            approvalHistoryMap.put("approvalStatus","销售提交");
        }



        if(CaseCommType.CLFA.getCode().equals(stageCode) && JmlKit.FLAG_0.equals(casePojo.getQaNeed())){

            if(checkSaOrderDetail(caseId).isFail()){
                return checkSaOrderDetail(caseId);
            }
            model.set("feedback_class",casePojo.getFeedbackClass());
            model.set("feedback_img1",casePojo.getFeedbackImg1());
            model.set("feedback_img2",casePojo.getFeedbackImg2());
            model.set("feedback_img3",casePojo.getFeedbackImg3());
            model.set("feedback_remark",casePojo.getFeedbackRemark());
            model.set("factory_code",casePojo.getFactoryCode());

            model.set("created_handing_end_time",AppKit.now4DB());

            model.set("feedback_start_time",AppKit.now4DB());
            RestApiResult  updateFMResult = updateFMAcceptanceInfo(model);
            if(updateFMResult.isFail()){
                return RestApiResult.newFail(updateFMResult.getMsg());
            }
            approvalHistoryMap.put("approvalStatus","销售助理反馈意见");
        }

        if(CaseCommType.CLFA.getCode().equals(stageCode) && JmlKit.FLAG_1.equals(casePojo.getQaNeed())){
            if(CollUtil.isEmpty(listSolution)){
                return RestApiResult.newFail("质量部门方案信息不能不为空");
            }
            List<CaseSolutionModel> detailInsertModelList = new ArrayList<>();
            for(CaseSolutionDetailPojo detailPojo : listSolution){

                if(checkSolution(listSolution).isFail()){
                    return checkSolution(listSolution);
                }

                detailPojo.setSolutionRole("质量部门");
                detailPojo.setCaseId(caseId);

                if(caseSolutionDao.checkSolutionRole(detailPojo)>0){
                   return RestApiResult.newFail("质量部门方案已经存在");
                }
                CaseSolutionModel caseSolutionModel = getCaseSolutionModel(detailPojo);
                JmlKit.setSaveModel(caseSolutionModel,paramsMap);
                detailInsertModelList.add(caseSolutionModel);
            }
            if(detailInsertModelList.size()>0){
                detailInsertModelList = mergeSolutionList(detailInsertModelList,caseId);
                Db.batchSave(detailInsertModelList, AppKit.BATCH_SIZE);
            }
            approvalHistoryMap.put("approvalStatus","质量部提交方案");
        }

        boolean checkFlag;
        if(CaseCommType.SMT.getCode().equals(stageCode)){
            CaseModel caseCheckModel = caseDao.findById(caseId);
            if(caseCheckModel.get("case_stage_code").equals(CaseCommType.ZLYJ.getCode())){
                return RestApiResult.newFail("质量部还未给出意见，不能操作");
            }
            model.set("feedback_end_time",AppKit.now4DB());
            model.set("deal_handing_start_time",AppKit.now4DB());
            if(CollUtil.isEmpty(listSolution)){
                return RestApiResult.newFail("销售总监方案信息不能不为空");
            }
            List<CaseSolutionModel> detailInsertModelList = new ArrayList<>();
            for(CaseSolutionDetailPojo detailPojo : listSolution){

                if(checkSolution(listSolution).isFail()){
                    return checkSolution(listSolution);
                }
                detailPojo.setSolutionRole("销售总监");
                detailPojo.setCaseId(caseId);

                if(caseSolutionDao.checkSolutionRole(detailPojo)>0){
                    return RestApiResult.newFail("销售总监方案已经存在");
                }
                CaseSolutionModel caseSolutionModel = getCaseSolutionModel(detailPojo);
                JmlKit.setSaveModel(caseSolutionModel,paramsMap);
                detailInsertModelList.add(caseSolutionModel);
            }
            if(detailInsertModelList.size()>0){
                detailInsertModelList = mergeSolutionList(detailInsertModelList,caseId);
                Db.batchSave(detailInsertModelList, AppKit.BATCH_SIZE);
            }

            model.set("deal_handing_end_time",AppKit.now4DB());
            List<CaseStageCfgModel> checkFiledList = caseStageCfgDao.queryCheckFiled();
            List<CaseSolutionModel> solutionCheckList = caseSolutionDao.queryCheckFiledList(caseId);
            checkFlag = true;
            if(CollUtil.isNotEmpty(checkFiledList) && CollUtil.isNotEmpty(solutionCheckList)){
                Map<String,Object> checkStageMap = new HashMap<>();
                for(CaseStageCfgModel caseStageCfgModel:checkFiledList){
                    String checkFiled = caseStageCfgModel.get("condition_filed");
                    for(CaseSolutionModel solutionModel : solutionCheckList){
                        if(ObjUtil.isNotEmpty(solutionModel.get(checkFiled)) && checkFlag){
                            checkStageMap.put("checkFiled",checkFiled);
                            checkStageMap.put("checkValue",solutionModel.get(checkFiled));
                            CaseStageCfgModel checkStage = caseStageCfgDao.queryCheckStage(checkStageMap);
                            String resultStage = checkStage.get("stage_code");
                            histroyMap.put("stageCode", resultStage);
                            if(!CaseCommType.CLOSE.getCode().equals(resultStage)){
                                checkFlag = false;
                                break;
                            }
                        }
                    }
                }
                if(checkFlag){
                    approvalHistoryMap.put("approvalStatus","销售总监提交方案-无需二次审批");
                    if(ObjUtil.isNotEmpty(approvalHistoryMap)){
                        saveApprovalHistory(approvalHistoryMap);
                    }
                    return updateCloseStage(model,histroyMap);
                }
            }else{
                model.set("approval_start_time",AppKit.now4DB());
                approvalHistoryMap.put("approvalStatus","销售总监提交方案-需要二次审批");
                if(ObjUtil.isNotEmpty(approvalHistoryMap)){
                    saveApprovalHistory(approvalHistoryMap);
                }
                histroyMap.put("stageCode", CaseCommType.CLOSE.getCode());
                return updateCloseStage(model,histroyMap);
            }
            approvalHistoryMap.put("approvalStatus","销售总监提交方案");

        }
        stageCode = histroyMap.get("stageCode").toString();


        if(StrUtil.isNotEmpty(casePojo.getApprovalStatus()) ){
            model.set("approval_start_time",AppKit.now4DB());
            model.set("approval_status",casePojo.getApprovalStatus());
            model.set("approval_remark",casePojo.getApprovalRemark());
            if(CollUtil.isEmpty(listSolution)){
                return RestApiResult.newFail("总经理方案信息不能不为空");
            }
            List<CaseSolutionModel> detailInsertModelList = new ArrayList<>();
            for(CaseSolutionDetailPojo detailPojo : listSolution){

                if(checkSolution(listSolution).isFail()){
                    return checkSolution(listSolution);
                }
                detailPojo.setSolutionRole("总经理");
                detailPojo.setCaseId(caseId);

                if(caseSolutionDao.checkSolutionRole(detailPojo) > 0){
                    return RestApiResult.newFail("总经理方案已经存在");
                }
                CaseSolutionModel caseSolutionModel = getCaseSolutionModel(detailPojo);
                JmlKit.setSaveModel(caseSolutionModel,paramsMap);
                detailInsertModelList.add(caseSolutionModel);
            }
            if(detailInsertModelList.size()>0){
                detailInsertModelList = mergeSolutionList(detailInsertModelList,caseId);
                Db.batchSave(detailInsertModelList, AppKit.BATCH_SIZE);
            }
            approvalHistoryMap.put("approvalStatus","总经理"+casePojo.getApprovalStatus());
            approvalHistoryMap.put("remark","总经理填写方案");
        }


        RestApiResult updateHistoryApiResult = caseAcceptanceHistoryBusi.updateStage(histroyMap);
        if(updateHistoryApiResult.isFail()){
            return RestApiResult.newFail(updateHistoryApiResult.getMsg());
        }
        model.set("current_acceptance_staff_id",updateHistoryApiResult.getData());
        model.set("case_stage", CaseCommType.getDescByCode(stageCode));
        model.set("case_stage_code", stageCode);
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        if(ObjUtil.isNotEmpty(approvalHistoryMap)){
            saveApprovalHistory(approvalHistoryMap);
        }
        return RestApiResult.newSuccess("受理成功");
    }


    private RestApiResult checkSaOrderDetail(String caseId) {
       List<CaseOrderDetailModel> detailList = caseOrderDetailDao.queryListBy(caseId);
       if(CollUtil.isEmpty(detailList)){
           return RestApiResult.newFail("销售助理完善产品明细时，订单明细不能为空");
       }
       for(CaseOrderDetailModel detailModel : detailList){
           if(ObjUtil.isEmpty(detailModel.get("salesDesc"))){
               return RestApiResult.newFail("销售助理完善产品明细时，销售描述不能为空");
           }
           if(ObjUtil.isEmpty(detailModel.get("productName"))){
               return RestApiResult.newFail("销售助理完善产品明细时，产品名称不能为空");
           }
           if(ObjUtil.isEmpty(detailModel.get("caseClass"))){
               return RestApiResult.newFail("销售助理完善产品明细时，事件分类不能为空");
           }
          if(ObjUtil.isEmpty(detailModel.get("onSiteImg"))){
            return RestApiResult.newFail("销售助理完善产品明细时，现场图片不能为空");
          }
            if(ObjUtil.isEmpty(detailModel.get("noImg"))){
                return RestApiResult.newFail("销售助理完善产品明细时，带有编号的照片不能为空");
            }
            if(ObjUtil.isEmpty(detailModel.get("breakImg"))){
                return RestApiResult.newFail("销售助理完善产品明细时，损坏的具体照片不能为空");
            }
            if(ObjUtil.isEmpty(detailModel.get("orderNo"))){
                return RestApiResult.newFail("销售助理完善产品明细时，订单号不能为空");
            }
            if(ObjUtil.isEmpty(detailModel.get("badQty"))){
                return RestApiResult.newFail("销售助理完善产品明细时，发现不良品数不能为空");
            }
           if(ObjUtil.isEmpty(detailModel.get("badRemark"))){
               return RestApiResult.newFail("销售助理完善产品明细时，不良品描述不能为空");
           }
           if(ObjUtil.isEmpty(detailModel.get("demands"))){
               return RestApiResult.newFail("销售助理完善产品明细时，客户诉求不能为空");
           }

       }
        return RestApiResult.newSuccess();
    }



    public RestApiResult checkSolution(List<CaseSolutionDetailPojo> solutionList){
        for(CaseSolutionDetailPojo detailPojo : solutionList){
            if(StrUtil.isEmpty(detailPojo.getSolutionType())){
                return RestApiResult.newFail("处理方案不能为空，请点击【修改】进行方案填写");
            }
            if(CaseCommType.SOLUTION_TYPE_TH.getCode().equals(detailPojo.getSolutionType())){
                if(ObjUtil.isEmpty(detailPojo.getReturnNum())){
                    return RestApiResult.newFail("方案为：退货时，退货数量不能为空");
                }
            }
            if(CaseCommType.SOLUTION_TYPE_SP.getCode().equals(detailPojo.getSolutionType())){
                if(ObjUtil.isEmpty(detailPojo.getClaimantAmount())){
                    return RestApiResult.newFail("方案为：索赔时，索赔金额不能为空");
                }
            }
            if(CaseCommType.SOLUTION_TYPE_ZR.getCode().equals(detailPojo.getSolutionType())){
                if(ObjUtil.isEmpty(detailPojo.getDiscountsAmount())){
                    return RestApiResult.newFail("方案为：折让时，折让金额不能为空");
                }
            }
            if(CaseCommType.SOLUTION_TYPE_FG.getCode().equals(detailPojo.getSolutionType())){
                if(ObjUtil.isEmpty(detailPojo.getReworkNum())){
                    return RestApiResult.newFail("方案为：返工时，返工数量不能为空");
                }
            }
            if(CaseCommType.SOLUTION_TYPE_HH.getCode().equals(detailPojo.getSolutionType())){
                if(ObjUtil.isEmpty(detailPojo.getExchangeNum())){
                    return RestApiResult.newFail("方案为：换货时，换货数量不能为空");
                }
            }
            if(CaseCommType.SOLUTION_TYPE_BYSL.getCode().equals(detailPojo.getSolutionType())){
                if(StrUtil.isEmpty(detailPojo.getUndoReason())){
                    return RestApiResult.newFail("方案为：不予受理时，不予受理原因不能为空");
                }
            }
        }
        return RestApiResult.newSuccess();
    }



     public RestApiResult caseClose(CasePojo casePojo,Map<String,Object> paramsMap){
         if(StrUtil.isEmpty(casePojo.getCloseReason())){
             return RestApiResult.newFail("结案原因不能为空");
         }
         CaseModel model = caseDao.findById(casePojo.getId());
         if(ObjUtil.isEmpty(model)){
             return RestApiResult.newFail("客服服务信息未找到");
         }

         if(CaseCommType.QA_STATUS_N.getDesc().equals(model.get("qa_status")) && model.get("service_type").equals(CaseCommType.SERVICE_TYPE_SHFW.getDesc())){
             return RestApiResult.newFail("质量部未处理，不能结案");
         }

        model.set("is_closed",JmlKit.FLAG_1);
        model.set("close_reason",casePojo.getCloseReason());
        model.set("replenish_invoice_no",casePojo.getReplenishInvoiceNo());
        model.set("close_staff_id",paramsMap.get("staffId"));
        model.set("case_stage",CaseCommType.CLOSE.getDesc());
        model.set("close_time",AppKit.now4DB());
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();

         Map<String,Object> sendMap = new HashMap<>();
         sendMap.put("caseId",model.get("id"));
         sendMap.put("flag",CaseCommType.MSG_TYPE_CLOSE.getCode());
         sendTmplMsg.execute(() -> caseAcceptanceHistoryBusi.sendTmplMsg(sendMap));
        return RestApiResult.newSuccess("结案成功");
     }


    private static CaseSolutionModel getCaseSolutionModel(CaseSolutionDetailPojo detailPojo) {
        CaseSolutionModel caseSolutionModel = new CaseSolutionModel();
        caseSolutionModel.set("case_id", detailPojo.getCaseId());
        caseSolutionModel.set("order_detail_id", detailPojo.getOrderDetailId());
        caseSolutionModel.set("return_num", detailPojo.getReturnNum());
        caseSolutionModel.set("exchange_num", detailPojo.getExchangeNum());
        caseSolutionModel.set("rework_num", detailPojo.getReworkNum());
        caseSolutionModel.set("discounts_amount", detailPojo.getDiscountsAmount());
        caseSolutionModel.set("claimant_amount", detailPojo.getClaimantAmount());
        caseSolutionModel.set("solution_type", detailPojo.getSolutionType());
        caseSolutionModel.set("undo_reason", detailPojo.getUndoReason());
        caseSolutionModel.set("solution_role", detailPojo.getSolutionRole());
        caseSolutionModel.set("judge",detailPojo.getJudge());
        caseSolutionModel.set("judge_desc",detailPojo.getJudgeDesc());
        caseSolutionModel.set("problem_type",detailPojo.getProblemType());
        return caseSolutionModel;
    }



    public RestApiResult deleteCase(String id){
        CaseModel model = caseDao.findById(id);
        if(ObjUtil.isEmpty(model)){
            return RestApiResult.newFail("未找到对于的客诉，请联系管理员");
        }
        if(!CaseCommType.NEW.getCode().equals(model.get("case_stage_code"))){
            return RestApiResult.newFail("当前状态不允许删除，请联系管理员");
        }

        caseAcceptanceHistoryDao.deleteByCaseId(id);
        return caseDao.deleteById(id) ? RestApiResult.newSuccess("删除成功") : RestApiResult.newFail("删除失败");
    }





    public RestApiResult updateFMAcceptanceInfo(CaseModel model){
        String factoryCode = model.get("factory_code");
        String stageCode = model.get("case_stage_code");

        if(StrUtil.isEmpty(factoryCode)){
            return RestApiResult.newFail("处理方案阶段工厂信息不能为空");
        }

        if(StrUtil.isNotEmpty(CaseCommType.getDescByCode(factoryCode))){
            model.set("factory", CaseCommType.getDescByCode(factoryCode));
        }
        Map<String,Object> paramMap = new HashMap<String,Object>();
        paramMap.put("factoryCode",factoryCode);
        CaseStageCfgModel stageCfgModel = caseStageCfgDao.queryFactoryAcceptance(paramMap);
        if(ObjUtil.isEmpty(stageCfgModel)){
            return RestApiResult.newFail("该工厂未配置对应的受理人，请联系管理员");
        }

        paramMap.put("stageCode",stageCode);
        paramMap.put("caseId",model.get("id"));
        caseAcceptanceHistoryDao.updateFMBy(paramMap);
        return RestApiResult.newSuccess();
    }


    public RestApiResult updateCloseStage(CaseModel model,Map<String,Object> histroyMap){
        RestApiResult updateHistoryApiResult = caseAcceptanceHistoryBusi.updateStage(histroyMap);
        if(updateHistoryApiResult.isFail()){
            return RestApiResult.newFail(updateHistoryApiResult.getMsg());
        }
        caseAcceptanceHistoryDao.updateCloseStage(histroyMap);
        model.set("case_stage_code",histroyMap.get("stageCode"));
        model.set("update_staff_id",histroyMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("受理成功");
    }




    public RestApiResult saveSolution(List<CaseSolutionDetailPojo> listPojo, Map<String,Object> paramsMap){
        if(CollUtil.isEmpty(listPojo)){
            return RestApiResult.newFail("方案信息不能不为空");
        }
        List<CaseSolutionModel> detailInsertModelList = new ArrayList<>();
        for(CaseSolutionDetailPojo detailPojo : listPojo){
            CaseSolutionModel caseSolutionModel = getCaseSolutionModel(detailPojo);
            detailInsertModelList.add(caseSolutionModel);
        }
        if(detailInsertModelList.size()>0){
            Db.batchSave(detailInsertModelList, AppKit.BATCH_SIZE);
        }
        return RestApiResult.newSuccess("解决方案保存成功");
    }



    public RestApiResult saveOpinion(CaseQaOpinionPojo pojo, Map<String,Object> paramsMap){
        CaseQaOpinionModel model = new CaseQaOpinionModel();
        model.set("case_id",pojo.getCaseId());
        model.set("cause_analysis",pojo.getCauseAnalysis());
        model.set("corrective_action",pojo.getCorrectiveAction());
        model.set("preventive_measure",pojo.getPreventiveMeasure());
        model.set("expected_completion_date",pojo.getExpectedCompletionDate());
        String submitStatus = pojo.getSubmitStatus();
        if(StrUtil.isNotEmpty(submitStatus) && JmlKit.FLAG_1.equals(pojo.getSubmitStatus())){
            model.set("submit_status",pojo.getSubmitStatus());
            SFKit.updateModelSyncFlag(model);
        }
        if(StrUtil.isEmpty(pojo.getId())){
            JmlKit.setSaveModel(model,paramsMap);
            model.save();
        }else{
            model.set("id",pojo.getId());
            model.set("update_staff_id",paramsMap.get("staffId"));
            model.update();
        }

        CaseModel caseModel = caseDao.findById(pojo.getCaseId());
        if(!ObjUtil.isEmpty(caseModel) && StrUtil.isEmpty(pojo.getId())){
            caseModel.set("qa_handling_start_time",AppKit.now4DB());
            SFKit.updateModelSyncFlag(caseModel);
            caseModel.update();
        }

        if(JmlKit.FLAG_1.equals(pojo.getSubmitStatus())){
            caseModel.set("qa_status","已受理");
            caseModel.set("qa_handling_end_time",AppKit.now4DB());
            SFKit.updateModelSyncFlag(caseModel);
            caseModel.update();
        }


        return RestApiResult.newSuccess("质量部意见保存成功",model.get("id"));
    }


    public RestApiResult deleteOrderDetail(String id){
        return caseOrderDetailDao.deleteById(id) ? RestApiResult.newSuccess("删除成功") : RestApiResult.newFail("删除失败");

    }



    public RestApiResult caseReturn(CaseReturnInPojo pojo, Map<String,Object> paramsMap){
        CaseModel caseModel = new CaseModel();
        String caseId = pojo.getCaseId();
        caseModel.set("id",caseId);
        caseModel.set("case_stage",CaseCommType.NEW.getDesc());
        caseModel.set("case_stage_code",CaseCommType.NEW.getCode());
        caseModel.set("return_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(caseModel);
        caseModel.update();
        
        Map<String,Object> approvalHistoryMap = new HashMap<>();
        approvalHistoryMap.putAll(paramsMap);
        approvalHistoryMap.put("caseId",caseId);
        approvalHistoryMap.put("remark",pojo.getRemark());
        approvalHistoryMap.put("approvalStatus","销售助理退回");
        approvalHistoryMap.put("caseStage",CaseCommType.FKYJ.getDesc());
        approvalHistoryMap.put("stageCode",CaseCommType.FKYJ.getCode());
        if(ObjUtil.isNotEmpty(approvalHistoryMap)){
            saveApprovalHistory(approvalHistoryMap);
        }
        Map<String,Object> sendMap = new HashMap<>();
        sendMap.put("caseId",caseModel.get("id"));
        sendMap.put("flag",CaseCommType.MSG_TYPE_RETURN.getCode());
        sendTmplMsg.execute(() -> caseAcceptanceHistoryBusi.sendTmplMsg(sendMap));
        return RestApiResult.newSuccess("退回成功",caseId);
    }



    public RestApiResult updateOrderDetail(CaseOrderDetailPojo detailPojo, Map<String,Object> paramsMap) {
        CaseOrderDetailModel detailModel =  getOrderDetailModel(detailPojo);
        detailModel.set("id",detailPojo.getId());
        detailModel.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(detailModel);

        saveOrderDetailHistory(detailModel,paramsMap);
        return detailModel.update() ? RestApiResult.newSuccess("修改成功") : RestApiResult.newFail("修改失败");
    }
    private void saveOrderDetailHistory(CaseOrderDetailModel detailModel,Map<String,Object> paramsMap){
        CaseOrderDetailModel oldModel = caseOrderDetailDao.findById(detailModel.get("id"));

        if(!detailModel.get("sales_desc").equals(oldModel.get("sales_desc"))){
            ObjectChangeHistoryModel model = new ObjectChangeHistoryModel();
            model.set("object_code",detailModel._getTableName());
            model.set("object_id",detailModel.get("id"));
            model.set("field_code","sales_desc");
            model.set("field_name","销售描述");
            model.set("old_val",oldModel.get("sales_desc"));
            model.set("new_val",detailModel.get("sales_desc"));
            model.set("created_staff_id",paramsMap.get("staffId"));
            model.save();
        }

    }



    public RestApiResult submitQa(CasePojo casePojo,Map<String,Object> paramsMap){
        if(StrUtil.isEmpty(casePojo.getId())){
            return RestApiResult.newFail("客服服务id不能为空");
        }
        String caseId = casePojo.getId();
        Map<String,Object> histroyMap = new HashMap<>();
        histroyMap.put("caseId",caseId);
        histroyMap.put("stageCode",CaseCommType.ZLYJ.getCode());
        RestApiResult updateHistoryApiResult = caseAcceptanceHistoryBusi.updateStage(histroyMap);
        if(updateHistoryApiResult.isFail()){
            return RestApiResult.newFail(updateHistoryApiResult.getMsg());
        }
        CaseModel caseModel = new CaseModel();
        caseModel.set("id",caseId);
        caseModel.set("current_acceptance_staff_id",updateHistoryApiResult.getData());
        caseModel.set("case_stage_code",CaseCommType.ZLYJ.getCode());
        caseModel.set("case_stage",CaseCommType.ZLYJ.getDesc());
        caseModel.set("qa_need",JmlKit.FLAG_1);
        SFKit.updateModelSyncFlag(caseModel);
        caseModel.update();

        Map<String,Object> approvalHistoryMap = new HashMap<>();
        approvalHistoryMap.putAll(paramsMap);
        approvalHistoryMap.put("caseId",caseId);
        approvalHistoryMap.put("stageCode",CaseCommType.ZLYJ.getCode());
        approvalHistoryMap.put("caseStage",CaseCommType.ZLYJ.getDesc());
        approvalHistoryMap.put("approvalStatus","提交质量部受理");
        saveApprovalHistory(approvalHistoryMap);
        return RestApiResult.newSuccess("提交质量部受理成功");
    }


    private List<CaseSolutionModel> mergeSolutionList(List<CaseSolutionModel> solutionModelList, String caseId) {
        List<CaseOrderDetailModel> listOrderDetail = caseOrderDetailDao.queryListBy(caseId);
        if (solutionModelList.size() > listOrderDetail.size()) {
            int removeCount = solutionModelList.size() - listOrderDetail.size();
            for (int i = 0; i < removeCount; i++) {
                solutionModelList.remove(solutionModelList.size() - 1);
            }
        }
        return solutionModelList;
    }


}
