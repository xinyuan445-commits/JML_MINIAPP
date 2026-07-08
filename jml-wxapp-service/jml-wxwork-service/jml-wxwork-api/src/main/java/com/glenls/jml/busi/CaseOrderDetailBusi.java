package com.glenls.jml.busi;

import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.model.CaseModel;
import com.glenls.jml.model.CaseOrderDetailModel;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.aop.Inject;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.Map;


public class CaseOrderDetailBusi {
    @Inject
    private CaseOrderDetailModel caseOrderDetailDao;



    public RestApiResult queryDetails(Map<String,Object> paramsMap){
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("客诉订单明细Id不能为空");
        }
        return RestApiResult.newSuccess("获取客诉订单明细成功",caseOrderDetailDao.queryDetails(paramsMap.get("id").toString()));
    }


    public RestApiResult save(CaseOrderDetailModel model, Map<String,Object> paramsMap){
        if(StringUtils.isEmpty(model.get("id"))){
            JmlKit.setSaveModel(model,paramsMap);
            model.save();
            return RestApiResult.newSuccess("新增客诉订单明细成功",model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改客诉订单明细成功",model.get("id"));
    }
}
