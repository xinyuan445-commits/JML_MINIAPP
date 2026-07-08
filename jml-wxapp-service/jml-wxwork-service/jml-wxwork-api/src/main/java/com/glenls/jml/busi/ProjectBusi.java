package com.glenls.jml.busi;

import com.glenls.commons.lang.idegen.TimeIdGeneratorKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.model.ProjectModel;
import com.glenls.jml.model.RelatedCfgModel;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.aop.Inject;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


public class ProjectBusi {
    
    @Inject
    private ProjectModel projectDao;
    @Inject
    private RelatedCfgBusi relatedCfgBusi;


    public RestApiResult queryPage(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("获取项目分页列表成功",projectDao.queryPage(pageNo,pageSize,paramsMap));
    }


    public RestApiResult queryDetails(Map<String,Object> paramsMap){
        RestApiResult restApiResult = RestApiResult.newSuccess();
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("项目Id不能为空");
        }
        Map<String,Object> retMap = new HashMap<>();
        retMap.put("basic",projectDao.queryDetails(paramsMap.get("id").toString()));

        paramsMap.put("tableName",projectDao._getTableName());
        paramsMap.put("id",paramsMap.get("id").toString());
        List<RelatedCfgModel> relatedCfgModelList= relatedCfgBusi.queryRelatedList(paramsMap);
        retMap.put("relatedList",relatedCfgModelList);
        restApiResult.setData(retMap);
        return restApiResult;
    }


    public RestApiResult save(ProjectModel model,Map<String,Object> paramsMap){
        if(StringUtils.isEmpty(model.get("id"))){
            JmlKit.setSaveModel(model,paramsMap);
            model.save();
            return RestApiResult.newSuccess("新增项目成功",model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改项目成功",model.get("id"));
    }
    
    
    
}
