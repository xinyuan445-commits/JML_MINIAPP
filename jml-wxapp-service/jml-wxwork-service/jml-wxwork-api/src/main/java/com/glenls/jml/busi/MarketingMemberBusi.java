package com.glenls.jml.busi;

import com.glenls.commons.lang.idegen.TimeIdGeneratorKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.model.MarketingMemberModel;
import com.glenls.jml.model.RelatedCfgModel;
import com.glenls.jml.model.SalesLeadModel;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.aop.Inject;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


public class MarketingMemberBusi {

    @Inject
    private MarketingMemberModel marketingMemberDao;
    @Inject
    private RelatedCfgBusi relatedCfgBusi;

    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return  RestApiResult.newSuccess("获取市场活动成员列表成功",marketingMemberDao.queryPageBy(pageNo,pageSize,paramsMap));
    }


    public RestApiResult queryDetails(Map<String,Object> paramsMap){
        RestApiResult restApiResult = RestApiResult.newSuccess();
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("市场活动成员Id不能为空");
        }
        Map<String,Object> retMap = new HashMap<>();
        
        retMap.put("basic",marketingMemberDao.queryDetails(paramsMap.get("id").toString()));
        
        paramsMap.put("tableName",marketingMemberDao._getTableName());
        paramsMap.put("id",paramsMap.get("id").toString());
        List<RelatedCfgModel> relatedCfgModelList = relatedCfgBusi.queryRelatedList(paramsMap);
        retMap.put("relatedList",relatedCfgModelList);
        restApiResult.setData(retMap);
        return restApiResult;
    }


    public RestApiResult save(MarketingMemberModel model,Map<String,Object> paramsMap){
        if(ObjectUtils.isNotEmpty(model.get("sales_lead_id"))){
            SalesLeadModel leadModel = new SalesLeadModel();
            leadModel.set("id",model.get("sales_lead_id").toString());
            leadModel.set("source","市场活动");
            leadModel.set("update_staff_id",paramsMap.get("staffId"));
            SFKit.updateModelSyncFlag(leadModel);
            leadModel.update();
        }
        if(StringUtils.isEmpty(model.get("id"))){
            JmlKit.setSaveModel(model,paramsMap);
            model.save();
            return RestApiResult.newSuccess("新增市场活动成员成功",model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改市场活动成员成功",model.get("id"));
    }

}
