package com.glenls.jml.busi;

import cn.hutool.core.util.StrUtil;
import com.glenls.commons.lang.idegen.TimeIdGeneratorKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.kit.BaiduMapKit;
import com.glenls.jml.model.*;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.aop.Inject;
import com.jfinal.i18n.Res;
import com.jfinal.plugin.activerecord.BaseModel;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


public class AccountBusi {
    @Inject
    private AccountModel accountDao;
    @Inject
    private RelatedCfgBusi relatedCfgBusi;

    @Inject
    private ContactModel contactDao;

    @Inject
    private OpportunityModel opportunityDao;



    public RestApiResult queryPage(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("获取公司分页列表成功",accountDao.queryPage(pageNo,pageSize,paramsMap));
    }


    public RestApiResult queryDetails(Map<String,Object> paramsMap){
        RestApiResult restApiResult = RestApiResult.newSuccess();
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("公司Id不能为空");
        }
        if(ObjectUtils.isNotEmpty(accountDao.findById(paramsMap.get("id")))){
           AccountModel accountModel = new AccountModel();
           accountModel.set("id",paramsMap.get("id"));
           accountModel.set("is_new",JmlKit.FLAG_0);
           accountModel.update();
        }
        Map<String,Object> retMap = new HashMap<>();
        
        AccountModel model = accountDao.queryDetails(paramsMap.get("id").toString());
        if(ObjectUtils.isEmpty(model)){
            return RestApiResult.newFail("无对应的公司信息，请联系管理员");
        }
        if (ObjectUtils.isNotEmpty(model.get("customer_product"))) {
            List<String> customerProductList = StrUtil.split(model.getStr("customer_product"), ";");
            model.put("customerProductList", customerProductList);
        }
        retMap.put("basic",model);
        
        retMap.put("isEdit",JmlKit.checkEdit(paramsMap,model));

        
        paramsMap.put("tableName",accountDao._getTableName());
        paramsMap.put("id",paramsMap.get("id").toString());
        List<RelatedCfgModel>  relatedCfgModelList= relatedCfgBusi.queryRelatedList(paramsMap);
        retMap.put("relatedList",relatedCfgModelList);
        restApiResult.setData(retMap);
        return restApiResult;
    }


    public RestApiResult save(AccountModel model,Map<String,Object> paramsMap){
        if(StringUtils.isNotEmpty(model.get("address"))){
            RestApiResult result =  BaiduMapKit.getLngAndLatByAddr(model.get("address"));
            if(ObjectUtils.isNotEmpty(result.getData())){
                Map<String,String > lngLatMap = (Map<String, String>) result.getData();;
                model.set("longitude",lngLatMap.get("lng"));
                model.set("latitude",lngLatMap.get("lat"));
            }
        }
        if(StringUtils.isEmpty(model.get("id"))){
            JmlKit.setSaveModel(model,paramsMap);
            model.save();
            return RestApiResult.newSuccess("新增公司成功",model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改公司成功",model.get("id"));
    }


    public RestApiResult queryListByStaff(Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("根据员工获取公司列表成功",accountDao.queryListByStaff(paramsMap));
    }


    public RestApiResult queryListByAccountId(Map<String,Object> paramsMap){
        RestApiResult restApiResult = RestApiResult.newSuccess();
        Map<String,Object> retMap = new HashMap<>();
        
        retMap.put("contactList",contactDao.queryListByStaff(paramsMap));
        retMap.put("oppList",opportunityDao.queryListByStaff(paramsMap));
        restApiResult.setData(retMap);
        return restApiResult;
    }



}
