package com.glenls.jml.busi;

import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.model.MileageCertificationModel;
import com.glenls.jml.model.OpportunityModel;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.aop.Inject;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.Map;



public class MileageCertificationBusi {
    @Inject
    private MileageCertificationModel mileageCertificationModel;


    public RestApiResult queryPage(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("获取里程认证分页列表成功",mileageCertificationModel.queryPageBy(pageNo,pageSize,paramsMap));
    }


    public RestApiResult queryDetails(String id){
        if(StringUtils.isEmpty(id)){
            return RestApiResult.newFail("里程认证Id不能为空");
        }
        return RestApiResult.newSuccess("获取里程认证明细成功",mileageCertificationModel.queryDetails(id));
    }


    public RestApiResult queryUnEndMileageCer(Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("获取未完成里程认证成功",mileageCertificationModel.queryUnEndMileageCer(paramsMap));
    }


    public RestApiResult save(MileageCertificationModel model, Map<String,Object> paramsMap){
        if(StringUtils.isEmpty(model.get("id"))){
            JmlKit.setSaveModel(model,paramsMap);
            model.set("start_time", AppKit.now4DB());
            model.save();
            return RestApiResult.newSuccess("新增里程认证成功",model.get("id"));
        }

        JmlKit.removeUpdateModel(model);
        MileageCertificationModel mileageCerModel = mileageCertificationModel.findById(model.get("id"));
        if(ObjectUtils.isEmpty(mileageCerModel)){
            return RestApiResult.newFail("里程认证不存在");
        }
        if(model.getDouble("end_mileage") <= mileageCerModel.getDouble("start_mileage")){
            return RestApiResult.newFail("结束里程认证不能小于开始里程认证");
        }
        mileageCerModel.set("update_staff_id",paramsMap.get("staffId"));
        mileageCerModel.set("end_mileage",model.get("end_mileage"));
        mileageCerModel.set("end_odometer_img",model.get("end_odometer_img"));
        mileageCerModel.set("end_longitude",model.get("end_longitude"));
        mileageCerModel.set("end_latitude",model.get("end_latitude"));
        mileageCerModel.set("end_address",model.get("end_address"));
        mileageCerModel.set("status",model.get("status"));
        mileageCerModel.set("end_time", AppKit.now4DB());
        mileageCerModel.set("mileage",model.getDouble("end_mileage") - mileageCerModel.getDouble("start_mileage"));
        SFKit.updateModelSyncFlag(mileageCerModel);
        mileageCerModel.update();
        return RestApiResult.newSuccess("修改里程认证成功",model.get("id"));
    }


    public RestApiResult deleteMileageCer(String id){
        return mileageCertificationModel.deleteById(id) ? RestApiResult.newSuccess("删除成功") : RestApiResult.newFail("删除失败");
    }
}
