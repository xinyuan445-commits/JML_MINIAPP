package com.glenls.jml.busi;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.ObjUtil;
import cn.hutool.core.util.StrUtil;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.constant.CaseCommType;
import com.glenls.jml.kit.SendWxTmplMsgKit;
import com.glenls.jml.model.CaseAcceptanceHistoryModel;
import com.glenls.jml.model.CaseModel;
import com.glenls.jml.model.CaseStageCfgModel;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.Db;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.ObjectUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


@Slf4j
public class CaseAcceptanceHistoryBusi {

    @Inject
    private CaseAcceptanceHistoryModel caseAcceptanceHistoryDao;
    @Inject
    private CaseStageCfgModel caseStageCfgDao;

    @Inject
    private CaseModel caseDao;


    private ThreadPoolExecutor sendTmplMsg = ThreadUtil.newExecutor(2, 50);

    public RestApiResult updateStage(Map<String, Object> paramsMap) {
        CaseAcceptanceHistoryModel historyModel = caseAcceptanceHistoryDao.queryUpdateStageBy(paramsMap);
        if (ObjUtil.isEmpty(historyModel)) {
            return RestApiResult.newFail("未找到相关的阶段，请联系管理员");
        }

        if (CaseCommType.CLOSE.getCode().equals(paramsMap.get("stageCode"))) {
            historyModel.set("acceptance_staff_id", paramsMap.get("staffId"));
            historyModel.set("acceptance_staff_name", paramsMap.get("staffName"));
        }
        historyModel.set("show_related", JmlKit.FLAG_1);
        historyModel.set("show_list", JmlKit.FLAG_1);
        historyModel.update();
        paramsMap.put("flag", CaseCommType.MSG_TYPE_STAGE.getCode());


        sendTmplMsg.execute(() -> {
            try{
                Thread.sleep(2000);
                sendTmplMsg(paramsMap);
            }catch (Exception e){
                log.error(e.getMessage(), e);
            }
        });


        return RestApiResult.newSuccess("阶段修改成功", historyModel.get("acceptance_staff_id"));
    }



    public RestApiResult saveStageList(Map<String, Object> paramsMap) {
        List<CaseStageCfgModel> listCaseStage = caseStageCfgDao.queryListByServiceType(paramsMap);
        if (CollUtil.isEmpty(listCaseStage)) {
           caseDao.deleteById(paramsMap.get("caseId"));
            return RestApiResult.newFail("未配置相关的流程，请联系管理员");
        }

        for (CaseStageCfgModel checkModel : listCaseStage) {
            if (ObjUtil.isEmpty(checkModel.get("acceptance_staff_id")) &&
                    !(checkModel.get("stage_code").equals(CaseCommType.NEW.getCode()) ||
                            checkModel.get("stage_code").equals(CaseCommType.CLOSE.getCode()))) {
                caseDao.deleteById(paramsMap.get("caseId"));
                return RestApiResult.newFail("未配置相关的流程人员，请联系管理员");
            }
        }


        List<CaseAcceptanceHistoryModel> acceptanceHistoryModelList = new ArrayList<>();
        for (CaseStageCfgModel stageCfgModel : listCaseStage) {
            CaseAcceptanceHistoryModel historyModel = new CaseAcceptanceHistoryModel();
            historyModel.set("case_id", paramsMap.get("caseId"));
            historyModel.set("sort", stageCfgModel.get("sort"));
            historyModel.set("case_stage_name", stageCfgModel.get("stage_name"));
            historyModel.set("case_stage_code", stageCfgModel.get("stage_code"));
            historyModel.set("acceptance_staff_id", stageCfgModel.get("acceptance_staff_id"));
            historyModel.set("acceptance_staff_name", stageCfgModel.get("acceptance_staff_name"));
            historyModel.set("acceptance_status", stageCfgModel.get("acceptance_status"));
            historyModel.set("acceptance_role_name", stageCfgModel.get("acceptance_role_name"));
            historyModel.set("show_list", stageCfgModel.get("show_list"));
            historyModel.set("show_related", JmlKit.FLAG_0);

            if (CaseCommType.NEW.getCode().equals(stageCfgModel.get("stage_code"))) {

                historyModel.set("show_related", JmlKit.FLAG_1);
                historyModel.set("acceptance_staff_id", paramsMap.get("staffId"));
                historyModel.set("acceptance_staff_name", paramsMap.get("staffName"));
                historyModel.set("acceptance_role_name", CaseCommType.EE.getDesc());
            }
            JmlKit.setSaveModel(historyModel, paramsMap);
            acceptanceHistoryModelList.add(historyModel);
        }
        if (!acceptanceHistoryModelList.isEmpty()) {
            Db.batchSave(acceptanceHistoryModelList, AppKit.BATCH_SIZE);
        }
        return RestApiResult.newSuccess();
    }


    public List<CaseAcceptanceHistoryModel> queryHistoryShowList(String caseId) {
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("caseId", caseId);
        return caseAcceptanceHistoryDao.queryHistoryShowList(paramsMap);
    }


    public List<CaseAcceptanceHistoryModel> queryHistoryShowRelated(String caseId) {
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("caseId", caseId);
        return caseAcceptanceHistoryDao.queryHistoryShowRelated(paramsMap);
    }


    public void sendTmplMsg(Map<String, Object> paramsMap) {
        log.info("--多线程开启推送微信模板消息---");
        List<CaseAcceptanceHistoryModel> acceptanceHistoryModelList = caseAcceptanceHistoryDao.querySendTmplInfoBy(paramsMap);
        CaseAcceptanceHistoryModel salesOpenIdModel = caseAcceptanceHistoryDao.querySalesOpenIdInfoBy(paramsMap);
        log.info(acceptanceHistoryModelList.size()+"---发送人list---");

        String flag = paramsMap.get("flag").toString();

        if (CollUtil.isNotEmpty(acceptanceHistoryModelList) && CaseCommType.MSG_TYPE_STAGE.getCode().equals(flag)){
            log.info("--阶段变更发送模板消息---");
            Map<String, Object> tmplParamsMap = new HashMap<>();
            String stageCode = paramsMap.get("stageCode").toString();
            for (CaseAcceptanceHistoryModel tmplModel : acceptanceHistoryModelList) {
                String caseStageCode = tmplModel.get("case_stage_code");
                tmplParamsMap.put("id", tmplModel.get("id"));
                tmplParamsMap.put("openId", tmplModel.get("openid"));
                tmplParamsMap.put("createStaffName", tmplModel.get("createStaffName"));
                tmplParamsMap.put("submitTime", tmplModel.get("submitTime"));
                tmplParamsMap.put("accName", tmplModel.get("accName"));
                tmplParamsMap.put("name", tmplModel.get("name"));
                tmplParamsMap.put("approvalStatus", tmplModel.get("approval_status"));
                tmplParamsMap.put("caseStage", tmplModel.get("case_stage"));
                tmplParamsMap.put("serviceType", tmplModel.get("service_type"));
                tmplParamsMap.put("returnStaffName", tmplModel.get("returnStaffName"));
                String ret = null;
                String serverType = tmplModel.get("service_type").toString();


                if (CaseCommType.SERVICE_TYPE_SHFW.getDesc().equals(serverType)) {
                    switch (stageCode) {

                        case "FKYJ":

                            tmplParamsMap.put("currentStage", "需要销售助理审核");
                            if (CaseCommType.NEW.getCode().equals(caseStageCode)) {
                                ret = SendWxTmplMsgKit.sendNoticeTmplMsg(tmplParamsMap).getJson().toString();
                                log.info("提交 -> 反馈意见->角色:"+tmplModel.get("acceptance_role_name")+"发送人员"+tmplModel.get("acceptanceStaffName")+" - 通知消息：" + ret);
                            }

                            if (CaseCommType.FKYJ.getCode().equals(caseStageCode)) {
                                ret = SendWxTmplMsgKit.sendRemindTmplMsg(tmplParamsMap).getJson().toString();
                                 log.info("提交 -> 反馈意见->角色:"+tmplModel.get("acceptance_role_name")+"发送人员"+tmplModel.get("acceptanceStaffName")+" - 提醒消息：" + ret);
                            }

                            break;

                        case "CLFA":

                            if (CaseCommType.FKYJ.getCode().equals(caseStageCode)) {
                                ret = SendWxTmplMsgKit.sendNoticeTmplMsg(tmplParamsMap).getJson().toString();
                                log.info("售后服务：销售助理信息提交 -> 处理方案->角色:"+tmplModel.get("acceptance_role_name")+"发送人员"+tmplModel.get("acceptanceStaffName")+" - 通知：" + ret);
                            }

                            if (CaseCommType.NEW.getCode().equals(caseStageCode) || CaseCommType.ZLYJ.getCode().equals(caseStageCode) || CaseCommType.CLFA.getCode().equals(caseStageCode)) {
                                tmplParamsMap.put("currentStage", "需要销售总监审核");
                                ret = SendWxTmplMsgKit.sendRemindTmplMsg(tmplParamsMap).getJson().toString();
                                log.info("售后服务：销售助理信息提交 -> 处理方案->角色:"+tmplModel.get("acceptance_role_name")+"发送人员"+tmplModel.get("acceptanceStaffName")+" - 提醒：" + ret);
                            }
                            break;

                        case "ZLYJ":

                            tmplParamsMap.put("currentStage", "需要质量部审核");
                            if (CaseCommType.ZLYJ.getCode().equals(caseStageCode)) {
                                ret = SendWxTmplMsgKit.sendNoticeTmplMsg(tmplParamsMap).getJson().toString();
                                log.info("售后服务：质量部给出方案 -> 质量部意见->角色:"+tmplModel.get("acceptance_role_name")+"，发送人员"+tmplModel.get("acceptanceStaffName")+" - 通知：" + ret);

                                if (ObjectUtils.isNotEmpty(salesOpenIdModel)) {
                                    tmplParamsMap.put("openId", salesOpenIdModel.get("openid"));
                                    ret = SendWxTmplMsgKit.sendRemindTmplMsg(tmplParamsMap).getJson().toString();
                                     log.info("售后服务：质量部给出方案 -> 质量部意见->角色:销售人员，发送人员："+salesOpenIdModel.get("salesStaffName")+" - 提醒：" + ret);
                                }
                            }

                            if (CaseCommType.CLFA.getCode().equals(caseStageCode) || CaseCommType.FKYJ.getCode().equals(caseStageCode)) {
                                ret = SendWxTmplMsgKit.sendRemindTmplMsg(tmplParamsMap).getJson().toString();
                                 log.info("售后服务：质量部给出方案 -> 质量部意见->角色:"+tmplModel.get("acceptance_role_name")+"，发送人员"+tmplModel.get("acceptanceStaffName")+" - 提醒：" + ret);

                            }
                            break;

                        case "ECSP":

                            tmplParamsMap.put("currentStage", "需要二次审核");
                            if (CaseCommType.CLFA.getCode().equals(caseStageCode)) {
                                ret = SendWxTmplMsgKit.sendNoticeTmplMsg(tmplParamsMap).getJson().toString();
                                 log.info("售后服务：销售总监给出方案 -> 二次审批->角色:"+tmplModel.get("acceptance_role_name")+"，发送人员"+tmplModel.get("acceptanceStaffName")+" - 通知：" + ret);
                            }

                            if (CaseCommType.NEW.getCode().equals(caseStageCode) || CaseCommType.ZLYJ.getCode().equals(caseStageCode) || CaseCommType.FKYJ.getCode().equals(caseStageCode)
                                    || CaseCommType.ECSP.getCode().equals(caseStageCode)) {
                                ret = SendWxTmplMsgKit.sendRemindTmplMsg(tmplParamsMap).getJson().toString();
                                 log.info("售后服务：销售总监给出方案 -> 二次审批->角色:"+tmplModel.get("acceptance_role_name")+"，发送人员"+tmplModel.get("acceptanceStaffName")+" - 提醒：" + ret);
                            }
                            break;

                        case "CLOSE":
                            if(ObjUtil.isNotEmpty(tmplModel.get("approval_status"))){
                                tmplParamsMap.put("currentStage", CaseCommType.PASS.getDesc().equals(tmplModel.get("approval_status").toString()) ? "二次审核通过" : "二次审核拒绝");
                            }else {
                                tmplParamsMap.put("currentStage", "无需审核");
                            }
                            if (CaseCommType.ECSP.getCode().equals(caseStageCode)) {
                                ret = SendWxTmplMsgKit.sendNoticeTmplMsg(tmplParamsMap).getJson().toString();
                                 log.info("售后服务：关总审核结束 -> 结案 ->角色:"+tmplModel.get("acceptance_role_name")+"，发送人员"+tmplModel.get("acceptanceStaffName")+" - 通知：" + ret);
                            }
                            if (CaseCommType.CLFA.getCode().equals(caseStageCode) || CaseCommType.NEW.getCode().equals(caseStageCode) || CaseCommType.ZLYJ.getCode().equals(caseStageCode)
                                    || CaseCommType.FKYJ.getCode().equals(caseStageCode)) {
                                ret = SendWxTmplMsgKit.sendRemindTmplMsg(tmplParamsMap).getJson().toString();
                                 log.info("售后服务：关总审核结束 -> 结案 ->角色:"+tmplModel.get("acceptance_role_name")+"，发送人员"+tmplModel.get("acceptanceStaffName")+" - 提醒：" + ret);
                            }
                            break;
                    }

                } else {

                    tmplParamsMap.put("currentStage", "无需审核");
                    switch (stageCode) {

                        case "FKYJ":

                            if (CaseCommType.NEW.getCode().equals(caseStageCode)) {
                                ret = SendWxTmplMsgKit.sendNoticeTmplMsg(tmplParamsMap).getJson().toString();
                                 log.info("非售后服务：提交 -> 反馈意见，人员："+tmplModel.get("acceptanceStaffName")+"通知：" + ret);
                            }

                            if (CaseCommType.FKYJ.getCode().equals(caseStageCode)) {
                                ret = SendWxTmplMsgKit.sendRemindTmplMsg(tmplParamsMap).getJson().toString();
                                 log.info("非售后服务：提交 -> 反馈意见，人员："+tmplModel.get("acceptanceStaffName")+"提醒：" + ret);
                            }

                            break;

                        case "CLOSE":

                            if (CaseCommType.FKYJ.getCode().equals(caseStageCode)) {
                                ret = SendWxTmplMsgKit.sendNoticeTmplMsg(tmplParamsMap).getJson().toString();
                                 log.info("非售后服务：->角色："+tmplModel.get("acceptance_role_name")+"，人员："+tmplModel.get("acceptanceStaffName")+"通知：" + ret);
                            }

                            if (CaseCommType.NEW.getCode().equals(caseStageCode)) {
                                ret = SendWxTmplMsgKit.sendRemindTmplMsg(tmplParamsMap).getJson().toString();
                                 log.info("非售后服务：->角色："+tmplModel.get("acceptance_role_name")+"，人员："+tmplModel.get("acceptanceStaffName")+"提醒：" + ret);
                            }
                            break;
                    }
                }
            }
        }

        if(CollUtil.isNotEmpty(acceptanceHistoryModelList) && CaseCommType.MSG_TYPE_CLOSE.getCode().equals(flag)){
            log.info("--结案关闭操作发送模板消息---");
            Map<String, Object> tmplParamsMap = new HashMap<>();
            for (CaseAcceptanceHistoryModel tmplModel : acceptanceHistoryModelList) {
                tmplParamsMap.put("id", tmplModel.get("id"));
                tmplParamsMap.put("openId", tmplModel.get("openid"));
                tmplParamsMap.put("submitTime", tmplModel.get("submitTime"));
                tmplParamsMap.put("accName", tmplModel.get("accName"));
                tmplParamsMap.put("name", tmplModel.get("name"));
                tmplParamsMap.put("createStaffName", tmplModel.get("createStaffName"));
                String ret = null;
                String caseStageCode = tmplModel.get("case_stage_code");
                if(!CaseCommType.CLOSE.getCode().equals(caseStageCode)){
                    ret = SendWxTmplMsgKit.sendCloseTmplMsg(tmplParamsMap).getJson();
                     log.info("结案关闭 -> 关闭，->角色："+tmplModel.get("acceptance_role_name")+"，人员："+tmplModel.get("acceptanceStaffName")+"通知：" + ret);
                }
            }
        }

        if(CollUtil.isNotEmpty(acceptanceHistoryModelList) && CaseCommType.MSG_TYPE_RETURN.getCode().equals(flag)){
            log.info("--退回操作发送模板消息---");
            Map<String, Object> tmplParamsMap = new HashMap<>();
            for (CaseAcceptanceHistoryModel tmplModel : acceptanceHistoryModelList) {
                tmplParamsMap.put("id", tmplModel.get("id"));
                tmplParamsMap.put("openId", tmplModel.get("openid"));
                tmplParamsMap.put("submitTime", tmplModel.get("submitTime"));
                tmplParamsMap.put("createStaffName", tmplModel.get("createStaffName"));
                tmplParamsMap.put("serviceType", tmplModel.get("service_type"));
                tmplParamsMap.put("returnStaffName", tmplModel.get("returnStaffName"));
                tmplParamsMap.put("name", tmplModel.get("name"));
                String ret = null;
                String caseStageCode = tmplModel.get("case_stage_code");
                if (CaseCommType.NEW.getCode().equals(caseStageCode) || CaseCommType.FKYJ.getCode().equals(caseStageCode)) {
                    ret = SendWxTmplMsgKit.sendReturnTmplMsg(tmplParamsMap).getJson().toString();
                     log.info("退回操作 ->角色："+tmplModel.get("acceptance_role_name")+"，人员："+tmplModel.get("acceptanceStaffName")+"通知：" + ret);
                }
            }
        }

    }




}