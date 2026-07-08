package com.glenls.jml.busi;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.ObjUtil;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.constant.CaseCommType;
import com.glenls.jml.model.*;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.Db;
import com.jfinal.plugin.activerecord.Page;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


public class InternalTicketBusi {

    @Inject
    private InternalTicketModel ticketDao;

    @Inject
    private InternalTicketAcceptanceHistoryModel ticketAcceptanceHistoryDao;

    @Inject
    private CaseStageCfgModel caseStageCfgDao;


    
    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        Page<InternalTicketModel> ticketPage = ticketDao.queryPageBy(pageNo,pageSize,paramsMap);
        List<InternalTicketModel> ticketList = ticketPage.getList();
        for(InternalTicketModel ticketModel : ticketList){
            Map<String,Object> queryParamsMap = new HashMap<>();
            queryParamsMap.put("ticketId",ticketModel.get("id"));
            ticketModel.put("stageList",ticketAcceptanceHistoryDao.queryHistoryShowList(queryParamsMap));
        }
        return RestApiResult.newSuccess("获取客诉分页列表成功",ticketPage);
    }

    
    public RestApiResult queryDetails(Map<String,Object> paramsMap){

        RestApiResult restApiResult = RestApiResult.newSuccess();
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("内部工单Id不能为空");
        }
        Map<String,Object> retMap = new HashMap<>();
        InternalTicketModel basicModel = ticketDao.queryDetails(paramsMap.get("id").toString());
        retMap.put("basic",basicModel);
        
        Map<String,Object> queryParamMap = new HashMap<String,Object>();
        queryParamMap.put("stageCode",basicModel.get("stage_code"));
        queryParamMap.put("ticketId",basicModel.get("id"));

        List<InternalTicketAcceptanceHistoryModel> stageList = ticketAcceptanceHistoryDao.queryHistoryShowList(queryParamMap);
        retMap.put("stageList",stageList);

        List<InternalTicketAcceptanceHistoryModel> historyRelatedList = ticketAcceptanceHistoryDao.queryHistoryShowRelated(queryParamMap);
        retMap.put("historyRelatedList",historyRelatedList);

        if(!CaseCommType.CLOSE.getCode().equals(basicModel.get("stage_code"))){
            InternalTicketAcceptanceHistoryModel nextStageModel =  ticketAcceptanceHistoryDao.queryNextStage(queryParamMap);
            if(ObjUtil.isEmpty(nextStageModel)){
                return RestApiResult.newFail("内部工单明细未找到对应的阶段，请联系管理员");
            }
            retMap.put("btnName",nextStageModel.get("acceptance_status"));
            retMap.put("btnCode",nextStageModel.get("stage_code"));
        }

        restApiResult.setData(retMap);
        return restApiResult;

    }

    
    public RestApiResult save(InternalTicketModel model, Map<String,Object> paramsMap){
        String stageCode = model.get("stage_code");
        
        if(StringUtils.isEmpty(model.get("id"))){
            JmlKit.setSaveModel(model,paramsMap);
            if(ObjUtil.isEmpty(CaseCommType.getDescByCode(stageCode))){
                return RestApiResult.newFail("内部工单保存未找到对应的阶段，请联系管理员");
            }
            model.set("ticket_stage", CaseCommType.getDescByCode(stageCode));
            model.set("current_acceptance_staff_id",paramsMap.get("staffId"));
            model.save();

            Map<String,Object> histroyMap = new HashMap<String,Object>();
            histroyMap.put("flowCode", CaseCommType.INTIK.getCode());
            histroyMap.put("areaCode", model.get("area_code"));
            histroyMap.put("ticketId", model.get("id"));
            histroyMap.putAll(paramsMap);

            RestApiResult saveHistoryApiResult = saveStageList(histroyMap);
            if(saveHistoryApiResult.isFail()){
                return RestApiResult.newFail(saveHistoryApiResult.getMsg());
            }
            if(CaseCommType.PROC.getCode().equals(stageCode)){
                histroyMap.put("stageCode",stageCode);
                RestApiResult updateHistoryApiResult = updateStage(histroyMap);
                if(updateHistoryApiResult.isFail()){
                    return RestApiResult.newFail(updateHistoryApiResult.getMsg());
                }
                model.set("current_acceptance_staff_id",updateHistoryApiResult.getData());
                model.set("ticket_stage", CaseCommType.getDescByCode(stageCode));
                model.update();
            }
            return RestApiResult.newSuccess("新增内部工单成功",model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改内部工单成功",model.get("id"));
    }
    
    public RestApiResult internalTicketDo(InternalTicketModel model,Map<String,Object> paramsMap){
        Map<String,Object> histroyMap = new HashMap<String,Object>();
        String stageCode = model.get("stage_code");
        histroyMap.put("ticketId", model.get("id"));
        histroyMap.put("stageCode",stageCode);
        histroyMap.putAll(paramsMap);
        RestApiResult updateHistoryApiResult = updateStage(histroyMap);
        if(updateHistoryApiResult.isFail()){
            return RestApiResult.newFail(updateHistoryApiResult.getMsg());
        }
        if(CaseCommType.CLOSE.getCode().equals(stageCode)){
            model.set("close_staff_id",histroyMap.get("staffId"));
            model.set("close_time",AppKit.now4DB());
            model.set("ticket_stage", CaseCommType.getDescByCode(stageCode));
            model.set("stage_code",stageCode);
        }else{
            model.set("current_acceptance_staff_id",updateHistoryApiResult.getData());
            model.set("ticket_stage", CaseCommType.getDescByCode(stageCode));
            model.set("stage_code", stageCode);
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("受理成功");
    }

    
    public RestApiResult saveStageList(Map<String,Object> paramsMap){
        List<CaseStageCfgModel> listCaseStage = caseStageCfgDao.queryListByFlowCode(paramsMap);
        if(CollUtil.isEmpty(listCaseStage)){
            return RestApiResult.newFail("未配置相关的流程，请联系管理员");
        }

        List<InternalTicketAcceptanceHistoryModel> acceptanceHistoryModelList = new ArrayList<>();
        for(CaseStageCfgModel stageCfgModel : listCaseStage){
            InternalTicketAcceptanceHistoryModel historyModel = new InternalTicketAcceptanceHistoryModel();
            historyModel.set("ticket_id",paramsMap.get("ticketId"));
            historyModel.set("sort",stageCfgModel.get("sort"));
            historyModel.set("stage_name",stageCfgModel.get("stage_name"));
            historyModel.set("stage_code",stageCfgModel.get("stage_code"));
            historyModel.set("acceptance_staff_id", stageCfgModel.get("acceptance_staff_id"));
            historyModel.set("acceptance_staff_name", stageCfgModel.get("acceptance_staff_name"));
            historyModel.set("acceptance_status", stageCfgModel.get("acceptance_status"));
            historyModel.set("acceptance_role_name", stageCfgModel.get("acceptance_role_name"));
            historyModel.set("show_related",JmlKit.FLAG_0);
            
            if(CaseCommType.NEW.getCode().equals(stageCfgModel.get("stage_code"))){
                
                historyModel.set("show_related",JmlKit.FLAG_1);
                historyModel.set("sync_status",JmlKit.FLAG_1);
                historyModel.set("acceptance_staff_id",paramsMap.get("staffId"));
                historyModel.set("acceptance_staff_name",paramsMap.get("staffName"));
                historyModel.set("acceptance_role_name", CaseCommType.EE.getDesc());
            }
            JmlKit.setSaveModel(historyModel,paramsMap);
            acceptanceHistoryModelList.add(historyModel);
        }
        if(!acceptanceHistoryModelList.isEmpty()){
            Db.batchSave(acceptanceHistoryModelList, AppKit.BATCH_SIZE);
        }
        return RestApiResult.newSuccess();
    }





    
    public RestApiResult updateStage(Map<String,Object> paramsMap){
        InternalTicketAcceptanceHistoryModel historyModel = ticketAcceptanceHistoryDao.queryUpdateStageBy(paramsMap);
        if(ObjUtil.isEmpty(historyModel)){
            return RestApiResult.newFail("未找到相关的阶段，请联系管理员");
        }
        
        if(CaseCommType.CLOSE.getCode().equals(paramsMap.get("stageCode"))){
            historyModel.set("acceptance_staff_id",paramsMap.get("staffId"));
            historyModel.set("acceptance_staff_name",paramsMap.get("staffName"));
        }
        historyModel.set("show_related",JmlKit.FLAG_1);
        historyModel.set("sync_status",JmlKit.FLAG_1);
        historyModel.update();
        return RestApiResult.newSuccess("阶段修改成功",historyModel.get("acceptance_staff_id"));
    }

    
    public RestApiResult deleteTicket(String id){
       InternalTicketModel model = ticketDao.findById(id);
       if(ObjUtil.isEmpty(model)){
           return RestApiResult.newFail("未找到对于的内部工单，请联系管理员");
       }
       if(!CaseCommType.NEW.getCode().equals(model.get("stage_code"))){
           return RestApiResult.newFail("当前状态不允许删除，请联系管理员");
       }
        ticketAcceptanceHistoryDao.deleteByTicketId(id);
        return ticketDao.deleteById(id) ? RestApiResult.newSuccess("删除成功") : RestApiResult.newFail("删除失败");
    }




}
