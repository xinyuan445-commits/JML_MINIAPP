package com.glenls.jml.busi;

import cn.hutool.core.util.StrUtil;
import com.glenls.commons.lang.idegen.TimeIdGeneratorKit;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.jml.kit.DownZipImgKit;
import com.glenls.jml.kit.SendWeComMsgKit;
import com.glenls.jml.model.ReimbursementDetailModel;
import com.glenls.jml.model.ReimbursementModel;
import com.glenls.jml.model.RelatedCfgModel;
import com.glenls.jml.model.SalesReportModel;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.jml.pojo.ReimbursementDetailInPojo;
import com.glenls.jml.pojo.ReimbursementInPojo;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.Db;
import com.jfinal.plugin.activerecord.tx.Tx;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


public class ReimbursementBusi {
    @Inject
    private ReimbursementModel reimbursementDao;

    @Inject
    private ReimbursementDetailModel reimbursementDetailDao;
    @Inject
    private RelatedCfgBusi relatedCfgBusi;

    @Inject
    private SalesReportModel salesReportDao;

    public RestApiResult queryPage(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("获取报销分页列表成功",reimbursementDao.queryPage(pageNo,pageSize,paramsMap));
    }


    public RestApiResult queryDetails(Map<String,Object> paramsMap){
        RestApiResult restApiResult = RestApiResult.newSuccess();
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("报销Id不能为空");
        }
        Map<String,Object> retMap = new HashMap<>();
        retMap.put("basic",reimbursementDao.queryDetails(paramsMap.get("id").toString()));
        retMap.put("detailList",reimbursementDetailDao.queryListBy(paramsMap.get("id").toString()));
        paramsMap.put("tableName",reimbursementDao._getTableName());
        paramsMap.put("id",paramsMap.get("id").toString());
        List<RelatedCfgModel> relatedCfgModelList= relatedCfgBusi.queryRelatedList(paramsMap);
        retMap.put("relatedList",relatedCfgModelList);
        restApiResult.setData(retMap);
        return restApiResult;
    }


    @Before(Tx.class)
    public RestApiResult saveReimbursement(ReimbursementInPojo pojo,Map<String,Object> paramsMap){
        double totalAmount = 0.00;

        if(pojo.getDetailList().size()>0){
            for(ReimbursementDetailInPojo detailInPojo : pojo.getDetailList()){
                totalAmount += detailInPojo.getAmount();
            }
        }

        ReimbursementModel reimModel = new ReimbursementModel();
        reimModel.set("start_date",pojo.getStartDate());
        reimModel.set("end_date",pojo.getEndDate());
        reimModel.set("area_code",pojo.getAreaCode());
        reimModel.set("district",pojo.getDistrict());
        reimModel.set("remark",pojo.getRemark());
        reimModel.set("amount",totalAmount);
        JmlKit.setSaveModel(reimModel,paramsMap);
        if(StringUtils.isEmpty(pojo.getId())){
            JmlKit.setSaveModel(reimModel,paramsMap);
            reimModel.save();
        }else{
            JmlKit.removeUpdateModel(reimModel);
            reimModel.set("id",pojo.getId());
            reimModel.set("update_staff_id",paramsMap.get("staffId"));
            
            reimModel.update();
        }
        
        if (StringUtils.isNotEmpty(pojo.getSalesReportIds())) {
            List<String> reportIdList = StrUtil.split(pojo.getSalesReportIds(), ",");

            Map<String,Object> salesReportParamsMap = new HashMap<>();
            salesReportParamsMap.put("reimId",reimModel.get("id"));
            salesReportParamsMap.put("reportIdList",reportIdList);
            salesReportParamsMap.put("staffId",paramsMap.get("staffId"));

            salesReportDao.updateReportReimId(salesReportParamsMap);
        }
        if(pojo.getDetailList().size()>0){
            List<ReimbursementDetailModel> detailInsertModelList = new ArrayList<>();
            List<ReimbursementDetailModel> detailUpdateModelList = new ArrayList<>();
            for(ReimbursementDetailInPojo detailInPojo : pojo.getDetailList()){
                ReimbursementDetailModel detailModel = new ReimbursementDetailModel();
                detailModel.set("amount",detailInPojo.getAmount());
                detailModel.set("reimbursement_id",reimModel.get("id"));
                detailModel.set("item",detailInPojo.getItem());
                detailModel.set("remark",detailInPojo.getRemark());
                detailModel.set("invites",detailInPojo.getInvites());
                detailModel.set("contact_id",detailInPojo.getContactId());
                detailModel.set("img1",detailInPojo.getImg1());
                detailModel.set("img2",detailInPojo.getImg2());
                detailModel.set("tax",detailInPojo.getTax());
                detailModel.set("untaxed_amount",detailInPojo.getUntaxed_amount());
                detailModel.set("occur_date",detailInPojo.getOccur_date());
                detailModel.set("category",detailInPojo.getCategory());
                if(StringUtils.isEmpty(detailInPojo.getId())){
                    JmlKit.setSaveModel(detailModel,paramsMap);
                    detailInsertModelList.add(detailModel);
                }else{
                    JmlKit.removeUpdateModel(detailModel);
                    detailModel.set("id",detailInPojo.getId());
                    detailModel.set("update_staff_id",paramsMap.get("staffId"));
                    
                    detailUpdateModelList.add(detailModel);
                }
            }
            if(detailInsertModelList.size()>0){
                Db.batchSave(detailInsertModelList, AppKit.BATCH_SIZE);
            }
            if(detailUpdateModelList.size()>0){
                Db.batchUpdate(detailUpdateModelList, AppKit.BATCH_SIZE);
            }
        }
        return RestApiResult.newSuccess("费用报销保存成功",reimModel.get("id"));
    }


    public RestApiResult saveReimDetails(ReimbursementDetailModel model){
        if(StringUtils.isEmpty(model.get("id"))){
            model.set("id", TimeIdGeneratorKit.genTimeNo());
            model.save();
            return RestApiResult.newSuccess("新增费用明细成功",model.get("id"));
        }
        model.remove("created_staff_id");
        
        model.update();
        return RestApiResult.newSuccess("修改费用明细成功",model.get("id"));
    }


    public RestApiResult queryReimDetails(String id){
        if(StringUtils.isEmpty(id)){
            return RestApiResult.newFail("报销Id不能为空");
        }
        return RestApiResult.newSuccess("获取报销明细成功",reimbursementDetailDao.queryDetails(id));
    }


    public RestApiResult queryReimDetailsPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("获取报销明细分页列表成功",reimbursementDetailDao.queryPageBy(pageNo,pageSize,paramsMap));
    }


    public RestApiResult downloadZipFile(String reimId){


        if(StringUtils.isEmpty(reimId)){
            return RestApiResult.newFail("报销Id不能为空");
        }
        List<ReimbursementDetailModel> reimDetailModelList = reimbursementDetailDao.queryListBy(reimId);
        if(reimDetailModelList.size() == 0){
            return RestApiResult.newFail("无对应的报销明细数据，无法下载");
        }
        List<String> imgList = new ArrayList<>();
        for(ReimbursementDetailModel model : reimDetailModelList){
            if(ObjectUtils.isNotEmpty(model.get("img1"))){
                imgList.add(model.getStr("img1"));
            }
            if(ObjectUtils.isNotEmpty(model.get("img2"))){
                imgList.add(model.getStr("img2"));
            }
        }
        if(imgList.size() == 0){
            return RestApiResult.newFail("无对应的报销明细文件，无法下载");
        }

        File zipFile =  DownZipImgKit.getZipFile(imgList);

        return RestApiResult.newSuccessWithData(zipFile);
    }


    public RestApiResult submitReim(Map<String,Object> paramsMap){
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("费用报销Id不能为空");
        }
        ReimbursementModel reimModel = reimbursementDao.findById(paramsMap.get("id"));
        if(ObjectUtils.isEmpty(reimModel)){
            return RestApiResult.newFail("未找到费用报销记录，无法提交");
        }

        if(!paramsMap.get("staffId").equals(reimModel.get("created_staff_id"))){
            return RestApiResult.newFail("只能提交自己的费用报销");
        }
        reimbursementDao.submintReim(paramsMap.get("id").toString());
        reimbursementDetailDao.submintReimDetail(paramsMap.get("id").toString());
        return RestApiResult.newSuccess("报销提交成功");
    }


    public RestApiResult deleteReim(Map<String,Object> paramsMap){
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("费用报销Id不能为空");
        }
        ReimbursementModel reimModel = reimbursementDao.findById(paramsMap.get("id"));
        if(ObjectUtils.isEmpty(reimModel)){
            return RestApiResult.newFail("未找到费用报销记录，无法提交");
        }

        if(!paramsMap.get("staffId").equals(reimModel.get("created_staff_id"))){
            return RestApiResult.newFail("只能删除自己的费用报销");
        }
        reimbursementDao.deleteReim(paramsMap.get("id").toString());
        reimbursementDetailDao.deleteReimDetail(paramsMap.get("id").toString());
        salesReportDao.updateReportReimIdNull(paramsMap.get("id").toString());

        return RestApiResult.newSuccess("费用报销删除成功");
    }
}
