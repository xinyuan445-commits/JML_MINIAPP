package com.glenls.jml.controller;

import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.jml.busi.ReimbursementBusi;
import com.glenls.jml.model.ReimbursementDetailModel;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.modules.pub.validator.StaffAuthValidator;
import com.glenls.jml.pojo.ReimbursementInPojo;
import com.glenls.jml.validator.reimbursement.ReimbursementSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Clear;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;

import java.io.File;
import java.util.HashMap;
import java.util.Map;


@RequestMapping("/api/reimbursement")
public class ReimbursementController extends Base4JmlAuthController {


    @Inject
    private ReimbursementBusi reimbursementBusi;


    public void queryPage(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        renderJson(reimbursementBusi.queryPage(getPageNo(),getPageSize(),paramsMap));
    }


    public void queryDetails(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(reimbursementBusi.queryDetails(paramsMap));
    }


    public void queryReimDetails(){
        renderJson(reimbursementBusi.queryReimDetails(getPara("id")));
    }


    @Before({ReimbursementSaveValidator.class})
    public void saveReimbursement(){
        Map<String,Object> paramsMap = initQueryMap();
        ReimbursementInPojo pojo = getAttr("pojo");
        renderJson(reimbursementBusi.saveReimbursement(pojo,paramsMap));
    }


    public void saveReimDetails(){
        ReimbursementDetailModel model = getModel(ReimbursementDetailModel.class,"reimDetails");
        renderJson(reimbursementBusi.saveReimDetails(model));
    }


    public void queryReimDetailsPageBy(){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("contactId",getPara("contactId"));
        renderJson(reimbursementBusi.queryReimDetailsPageBy(getPageNo(),getPageSize(),paramsMap));
    }


    @Clear({StaffAuthValidator.class})
    public void sfDownloadZip(){
        Map<String,Object> paramsMap = new HashMap<>();
        RestApiResult result = reimbursementBusi.downloadZipFile(getPara("reimId"));
        if(result.isSuccess()){
            renderFile((File) result.getData());
            return;
        }
        renderJson(result);
    }


    public void submitReim(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(reimbursementBusi.submitReim(paramsMap));
    }


    public void deleteReim(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(reimbursementBusi.deleteReim(paramsMap));
    }

}
