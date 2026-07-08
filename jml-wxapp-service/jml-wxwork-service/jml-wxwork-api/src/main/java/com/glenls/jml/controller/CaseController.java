package com.glenls.jml.controller;

import com.glenls.jml.busi.CaseBusi;
import com.glenls.jml.busi.CaseOrderDetailBusi;
import com.glenls.jml.busi.ObjectChangeHistoryBusi;
import com.glenls.jml.kit.GeneratorSerNoKit;
import com.glenls.jml.kit.SendWxTmplMsgKit;
import com.glenls.jml.model.ObjectChangeHistoryModel;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.pojo.jmlcase.*;
import com.glenls.jml.validator.jmlcase.*;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.tx.Tx;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@RequestMapping("/api/case")
public class CaseController extends Base4JmlAuthController {

    @Inject
    private CaseBusi caseBusi;

    @Inject
    private CaseOrderDetailBusi caseOrderDetailBusi;

    @Inject
    private ObjectChangeHistoryBusi objectChangeHistoryBusi;


    
    public void queryCasePage(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        paramsMap.put("flag",getPara("flag"));
        paramsMap.put("startDate",getPara("startDate"));
        paramsMap.put("endDate",getPara("endDate"));
        paramsMap.put("serviceType",getPara("serviceType"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));
        paramsMap.put("caseStageCode",getPara("caseStageCode"));
        renderJson(caseBusi.queryPageBy(getPageNo(),getPageSize(),paramsMap));
    }

    
    public void queryCaseDetails(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(caseBusi.queryDetails(paramsMap));
    }

    
    @Before({CaseSaveValidator.class, Tx.class})
    public void saveCase(){
        Map<String,Object> paramsMap = initQueryMap();
        CasePojo pojo = getAttr("pojo");
        renderJson(caseBusi.saveNew(pojo,paramsMap));
    }

    
    @Before({CaseSolutionSaveValidator.class})
    public void saveCaseSolution(){
        Map<String,Object> paramsMap = initQueryMap();
        List<CaseSolutionDetailPojo> listPojo = getAttr("listPojo");
        renderJson(caseBusi.saveSolution(listPojo,paramsMap));
    }




    
    public void queryCaseOrderDetails(){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",getPara("id"));
        renderJson(caseOrderDetailBusi.queryDetails(paramsMap));
    }



    
    public void deleteCase(){
        renderJson(caseBusi.deleteCase(getPara("id")));
    }

    
     @Before({CaseDoSaveValidator.class,Tx.class})
    public void caseDo(){
        Map<String,Object> paramsMap = initQueryMap();
        CasePojo pojo = getAttr("pojo");
        renderJson(caseBusi.caseDoNew(pojo,paramsMap));
    }
    public void sendTestTmpMsg(){
        String ret =  SendWxTmplMsgKit.sendTestTmpMsg().getJson();
        renderJson(ret);

    }

    
    @Before({CaseQaOpinionSaveValidator.class})
    public void saveOpinion(){
        Map<String,Object> paramsMap = initQueryMap();
        CaseQaOpinionPojo pojo = getAttr("pojo");
        renderJson(caseBusi.saveOpinion(pojo,paramsMap));
    }

    
    public void deleteCaseDetail(){
        renderJson(caseBusi.deleteOrderDetail(getPara("id")));
    }


    
    @Before({CaseCloseValidator.class})
    public void caseClose(){
        Map<String,Object> paramsMap = initQueryMap();
        CasePojo pojo = getAttr("pojo");
        renderJson(caseBusi.caseClose(pojo,paramsMap));
    }



    @Before({CaseReturnSaveValidator.class})
    public void caseReturn(){
        Map<String,Object> paramsMap = initQueryMap();
        CaseReturnInPojo pojo = getAttr("pojo");
        renderJson(caseBusi.caseReturn(pojo,paramsMap));
    }

    
    @Before({CaseOrderDetailValidator.class})
    public void updateOrderDetail(){
        Map<String,Object> paramsMap = initQueryMap();
        CaseOrderDetailPojo pojo = getAttr("pojo");
        renderJson(caseBusi.updateOrderDetail(pojo,paramsMap));
    }

    
    @Before({CaseSubmitQaValidator.class})
    public void submitQa(){
        Map<String,Object> paramsMap = initQueryMap();
        CasePojo pojo = getAttr("pojo");
        renderJson(caseBusi.submitQa(pojo,paramsMap));
    }

    public void test1(){
        Map<String,Object> paramsMap = initQueryMap();
        renderJson("success",paramsMap);

    }

    
    public void queryOrderDetailHistory(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("objectId",getPara("orderDetailId"));
        paramsMap.put("objectCode","jml_case_order_detail");
        renderJson(objectChangeHistoryBusi.queryListBy(paramsMap));
    }


}
