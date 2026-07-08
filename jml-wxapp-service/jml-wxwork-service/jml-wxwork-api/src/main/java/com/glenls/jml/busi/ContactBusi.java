package com.glenls.jml.busi;

import com.glenls.commons.lang.idegen.TimeIdGeneratorKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.model.AccountModel;
import com.glenls.jml.model.ContactModel;
import com.glenls.jml.model.OpportunityModel;
import com.glenls.jml.model.RelatedCfgModel;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.aop.Inject;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


public class ContactBusi {
    @Inject
    private ContactModel contactDao;
    @Inject
    private RelatedCfgBusi relatedCfgBusi;



    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("获取联系人分页列表成功",contactDao.queryPageBy(pageNo,pageSize,paramsMap));
    }


    public RestApiResult queryDetails(Map<String,Object> paramsMap){
        RestApiResult restApiResult = RestApiResult.newSuccess();
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("联系人Id不能为空");
        }
        if(ObjectUtils.isNotEmpty(contactDao.findById(paramsMap.get("id")))){
            ContactModel contactModel = new ContactModel();
            contactModel.set("id",paramsMap.get("id"));
            contactModel.set("is_new",JmlKit.FLAG_0);
            contactModel.update();
        }
        Map<String,Object> retMap = new HashMap<>();
        ContactModel basicModel = contactDao.queryDetails(paramsMap.get("id").toString());
        retMap.put("basic",basicModel);
        
        retMap.put("isEdit",JmlKit.checkEdit(paramsMap,basicModel));
        
        paramsMap.put("tableName",contactDao._getTableName());
        paramsMap.put("id",paramsMap.get("id").toString());
        List<RelatedCfgModel> relatedCfgModelList= relatedCfgBusi.queryRelatedList(paramsMap);
        retMap.put("relatedList",relatedCfgModelList);
        restApiResult.setData(retMap);
        return restApiResult;
    }


    public RestApiResult save(ContactModel model,Map<String,Object> paramsMap){
        if(StringUtils.isEmpty(model.get("id"))){
            JmlKit.setSaveModel(model,paramsMap);
            model.save();
            return RestApiResult.newSuccess("新增联系人成功",model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改联系人成功",model.get("id"));
    }


    public RestApiResult queryListByStaff(Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("根据员工获取联系人列表成功",contactDao.queryListByStaff(paramsMap));
    }
    
}
