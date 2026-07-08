package com.glenls.jml.busi;

import com.glenls.commons.lang.idegen.TimeIdGeneratorKit;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.model.AccountAddressModel;
import com.glenls.jml.model.AccountModel;
import com.glenls.jml.model.OpportunityModel;
import com.glenls.jml.model.RelatedCfgModel;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.aop.Inject;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


public class OpportunityBusi {
    @Inject
    private OpportunityModel opportunityDao;
    @Inject
    private RelatedCfgBusi relatedCfgBusi;
    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("获取机会分页列表成功",opportunityDao.queryPageBy(pageNo,pageSize,paramsMap));
    }


    public RestApiResult queryDetails(Map<String,Object> paramsMap){
        RestApiResult restApiResult = RestApiResult.newSuccess();
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("机会Id不能为空");
        }
        if(ObjectUtils.isNotEmpty(opportunityDao.findById(paramsMap.get("id")))){
            OpportunityModel opportunityModel = new OpportunityModel();
            opportunityModel.set("id",paramsMap.get("id"));
            opportunityModel.set("is_new",JmlKit.FLAG_0);
            opportunityModel.update();
        }
        Map<String,Object> retMap = new HashMap<>();
        retMap.put("basic",opportunityDao.queryDetails(paramsMap.get("id").toString()));
        
        paramsMap.put("tableName",opportunityDao._getTableName());
        paramsMap.put("id",paramsMap.get("id").toString());
        List<RelatedCfgModel> relatedCfgModelList= relatedCfgBusi.queryRelatedList(paramsMap);
        retMap.put("relatedList",relatedCfgModelList);
        restApiResult.setData(retMap);
        return restApiResult;
    }


    public RestApiResult save(OpportunityModel model,Map<String,Object> paramsMap){
        if(StringUtils.isEmpty(model.get("id"))){
            JmlKit.setSaveModel(model,paramsMap);
            model.save();
            return RestApiResult.newSuccess("新增机会成功",model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改机会成功",model.get("id"));
    }


    public RestApiResult queryListByStaff(Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("根据员工获取联系人列表成功",opportunityDao.queryListByStaff(paramsMap));
    }


    public RestApiResult changeStage(Map<String,Object> paramsMap){
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("机会Id不能为空");
        }
        if(ObjectUtils.isEmpty(paramsMap.get("stage"))){
            return RestApiResult.newFail("机会阶段不能为空");
        }
        
        if(opportunityDao.STAGE_DSGB.equals(paramsMap.get("stage")) && (ObjectUtils.isEmpty(paramsMap.get("loss_cause")) || ObjectUtils.isEmpty(paramsMap.get("loss_desc")))){
            return RestApiResult.newFail("机会阶段为：丢失并关闭时，丢失原因、丢失原因描述不能为空");
        }
        OpportunityModel model = opportunityDao.findById(paramsMap.get("id").toString());
        if(ObjectUtils.isNotEmpty(model)){
            model.set("stage",paramsMap.get("stage"));
            model.set("loss_cause",paramsMap.get("loss_cause"));
            model.set("loss_desc",paramsMap.get("loss_desc"));
            model.set("update_staff_id",paramsMap.get("staffId"));
            
            if(opportunityDao.STAGE_DSGB.equals(paramsMap.get("stage")) || opportunityDao.STAGE_HTQD.equals(paramsMap.get("stage"))){
                model.set("close_date", AppKit.today());
            }
            SFKit.updateModelSyncFlag(model);
            model.update();
            return RestApiResult.newSuccess("状态切换成功");
        }else {
            return RestApiResult.newFail("无对应的机会信息，请联系管理员");
        }
    }
    
}
