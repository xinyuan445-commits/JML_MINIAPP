package com.glenls.jml.busi;

import cn.hutool.core.util.StrUtil;
import com.glenls.commons.lang.idegen.TimeIdGeneratorKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.kit.BaiduMapKit;
import com.glenls.jml.model.AccountAddressModel;
import com.glenls.jml.model.AccountModel;
import com.glenls.jml.model.RelatedCfgModel;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.aop.Inject;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


public class AccountAddressBusi {
    
    @Inject
    private AccountAddressModel accountAddressDao;
    @Inject
    private RelatedCfgBusi relatedCfgBusi;


    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        if(paramsMap.get("accountId") == null){
            return RestApiResult.newFail("公司Id不能为空");
        }
        return RestApiResult.newSuccess("获取公司地址分页列表成功",accountAddressDao.queryPageBy(pageNo,pageSize,paramsMap));
    }


    public RestApiResult queryDetails(Map<String,Object> paramsMap){
        RestApiResult restApiResult = RestApiResult.newSuccess();
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("公司地址Id不能为空");
        }
        Map<String,Object> retMap = new HashMap<>();
        AccountAddressModel model = accountAddressDao.queryDetails(paramsMap.get("id").toString());
        retMap.put("basic",model);

        paramsMap.put("tableName",accountAddressDao._getTableName());
        paramsMap.put("id",paramsMap.get("id").toString());
        List<RelatedCfgModel>  relatedCfgModelList= relatedCfgBusi.queryRelatedList(paramsMap);
        retMap.put("relatedList",relatedCfgModelList);
        restApiResult.setData(retMap);
        return restApiResult;
    }


    public RestApiResult save(AccountAddressModel model,Map<String,Object> paramsMap){
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
            return RestApiResult.newSuccess("新增公司地址成功",model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改公司地址成功",model.get("id"));
    }
}
