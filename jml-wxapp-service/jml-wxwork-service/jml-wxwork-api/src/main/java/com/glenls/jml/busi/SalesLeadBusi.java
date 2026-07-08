package com.glenls.jml.busi;

import cn.hutool.core.util.ObjUtil;
import cn.hutool.core.util.StrUtil;
import com.glenls.commons.lang.idegen.TimeIdGeneratorKit;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.kit.BaiduMapKit;
import com.glenls.jml.model.*;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.Db;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.*;


public class SalesLeadBusi {

    @Inject
    private SalesLeadModel salesLeadDao;

    @Inject
    private AccountModel accountDao;
    @Inject
    private RelatedCfgBusi relatedCfgBusi;




    public RestApiResult queryPage(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("获取销售线索分页列表成功",salesLeadDao.queryPage(pageNo,pageSize,paramsMap));
    }


    public RestApiResult queryDetails(Map<String,Object> paramsMap){
        RestApiResult restApiResult = RestApiResult.newSuccess();
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("销售线索Id不能为空");
        }
        Map<String,Object> retMap = new HashMap<>();
        SalesLeadModel model = salesLeadDao.queryDetails(paramsMap.get("id").toString());
        if(ObjectUtils.isEmpty(model)){
            return RestApiResult.newFail("无对应的销售线索信息，请联系管理员");
        }
        if (ObjectUtils.isNotEmpty(model.get("product"))) {
            List<String> productList = StrUtil.split(model.getStr("product"), ";");
            model.put("productList", productList);
        }
        retMap.put("basic",model);
        paramsMap.put("tableName",salesLeadDao._getTableName());
        paramsMap.put("id",paramsMap.get("id").toString());
        List<RelatedCfgModel> relatedCfgModelList= relatedCfgBusi.queryRelatedList(paramsMap);
        retMap.put("relatedList",relatedCfgModelList);
        restApiResult.setData(retMap);
        return restApiResult;

    }


    public RestApiResult save(SalesLeadModel model,Map<String,Object> paramsMap){
        if(StringUtils.isNotEmpty(model.get("address"))){
            RestApiResult result =  BaiduMapKit.getLngAndLatByAddr(model.get("address"));
            if(ObjectUtils.isNotEmpty(result.getData())){
                Map<String,String > lngLatMap = (Map<String, String>) result.getData();;
                model.set("longitude",lngLatMap.get("lng"));
                model.set("latitude",lngLatMap.get("lat"));
            }
        }
        model.set("source","自己挖掘");
        if(StringUtils.isEmpty(model.get("id"))){
            JmlKit.setSaveModel(model,paramsMap);
            model.set("status","新建");
            model.save();
            return RestApiResult.newSuccess("新增销售线索成功",model.get("id"));
        }
        model.set("update_staff_id",paramsMap.get("staffId"));
        JmlKit.removeUpdateModel(model);
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改销售线索成功",model.get("id"));
    }


    public RestApiResult queryListByStaff(Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("根据员工获取销售线索列表成功",salesLeadDao.queryListByStaff(paramsMap));
    }


    public RestApiResult convert(Map<String,Object> paramsMap){
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("销售线索Id不能为空");
        }

        SalesLeadModel model = salesLeadDao.findById(paramsMap.get("id").toString());
        if(ObjUtil.isEmpty(model.get("company"))){
            return RestApiResult.newFail("销售线索公司为空，无法转换");
        }
        if(ObjUtil.isEmpty(model.get("product"))){
            return RestApiResult.newFail("销售线索产品为空，无法转换");
        }
        if(ObjectUtils.isNotEmpty(model) && JmlKit.FLAG_0.equals(model.getStr("is_converted"))){
            
            AccountModel existAccountModel = accountDao.queryExistByName(model.get("company"));
            AccountModel newAccountModel = new AccountModel();
            if(existAccountModel !=null){
                newAccountModel.set("id",existAccountModel.get("id"));
            }else{
                JmlKit.setSaveModel(newAccountModel,paramsMap);
                newAccountModel.set("name",model.get("company"));
                newAccountModel.set("phone",model.get("company_phone"));
                newAccountModel.set("province",model.get("province"));
                newAccountModel.set("city",model.get("city"));
                newAccountModel.set("address",model.get("address"));
                newAccountModel.set("sales_lead_id",model.get("id"));

                newAccountModel.set("longitude",model.get("longitude"));

                newAccountModel.set("latitude",model.get("latitude"));

                newAccountModel.set("area_code",model.get("area_code"));

                newAccountModel.set("district",model.get("district"));

                newAccountModel.set("is_new",JmlKit.FLAG_1);
                newAccountModel.set("convert_remark","转换人："+paramsMap.get("staffId"));
                newAccountModel.save();
            }
            ContactModel contactModel = new ContactModel();
            JmlKit.setSaveModel(contactModel,paramsMap);
            contactModel.set("name",model.get("name"));
            contactModel.set("area_code",model.get("area_code"));
            contactModel.set("district",model.get("district"));
            contactModel.set("account_id",newAccountModel.get("id"));
            contactModel.set("email",model.get("email"));
            contactModel.set("mobile_phone",model.get("mobile_phone"));
            contactModel.set("province",model.get("province"));
            contactModel.set("city",model.get("city"));
            contactModel.set("wechat",model.get("wechat"));
            contactModel.set("is_new",JmlKit.FLAG_1);
            contactModel.set("sales_lead_id",model.get("id"));
            contactModel.set("convert_remark","转换人："+paramsMap.get("staffId"));
            contactModel.save();
            OpportunityModel opportunityModel = new OpportunityModel();
            JmlKit.setSaveModel(opportunityModel,paramsMap);

            opportunityModel.set("account_id",newAccountModel.get("id"));
            opportunityModel.set("name",model.get("company").toString()+'-'+model.get("product").toString());

            opportunityModel.set("sales_lead_id",model.get("id"));
            opportunityModel.set("area_code",model.get("area_code"));
            opportunityModel.set("district",model.get("district"));
            opportunityModel.set("convert_remark","转换人："+paramsMap.get("staffId"));
            opportunityModel.set("is_new",JmlKit.FLAG_1);
            opportunityModel.save();
            model.set("is_converted",JmlKit.FLAG_1);
            SFKit.updateModelSyncFlag(model);
            model.update();
            return RestApiResult.newSuccess("销售线索转化成功",newAccountModel.get("id"));
        }
        return RestApiResult.newFail("无对应的销售线索或该销售线索已转换，请联系管理员");
    }


    public RestApiResult changeStatus(Map<String,Object> paramsMap){
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("销售线索Id不能为空");
        }
        if(ObjectUtils.isEmpty(paramsMap.get("status"))){
            return RestApiResult.newFail("状态不能为空");
        }
        SalesLeadModel model = salesLeadDao.findById(paramsMap.get("id").toString());
        if(ObjectUtils.isNotEmpty(model)){
            model.set("status",paramsMap.get("status"));
            model.set("update_staff_id",paramsMap.get("staffId"));
            SFKit.updateModelSyncFlag(model);
            model.update();
            return RestApiResult.newSuccess("状态切换成功");
        }else {
            return RestApiResult.newFail("无对应的销售线索，请联系管理员");
        }

    }




}
