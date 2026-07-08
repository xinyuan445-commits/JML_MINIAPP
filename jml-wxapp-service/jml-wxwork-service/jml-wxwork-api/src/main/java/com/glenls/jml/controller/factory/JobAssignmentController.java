package com.glenls.jml.controller.factory;

import com.glenls.jml.busi.factory.JobAssignmentBusi;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.validator.factory.JobAssignmentCompleteValidator;
import com.glenls.jml.validator.factory.JobAssignmentConfirmValidator;
import com.glenls.jml.validator.factory.JobAssignmentSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.tx.Tx;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.Map;


@RequestMapping("/api/jobAssignment")
public class JobAssignmentController extends Base4JmlAuthController {
    @Inject
    private JobAssignmentBusi jobAssignmentBusi;

    @Before({JobAssignmentSaveValidator.class, Tx.class})
    public void save(){
        renderJson(jobAssignmentBusi.save(getAttr("pojo"),initQueryMap()));
    }


    public void queryPageBy() {
        Map<String, Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled", getPara("multiFiled"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));

        paramsMap.put("startDate", getPara("startDate"));
        paramsMap.put("endDate", getPara("endDate"));



        paramsMap.put("prodLineOrDept", getPara("prodLineOrDept"));
        renderJson(jobAssignmentBusi.queryPageBy(getPageNo(), getPageSize(), paramsMap));
    }


    public void queryDetails() {
        Map<String, Object> paramsMap = initQueryMap();
        paramsMap.put("id", getPara("id"));
        renderJson(jobAssignmentBusi.queryDetails(paramsMap));
    }


    @Before({JobAssignmentCompleteValidator.class, Tx.class})
    public void complete() {
        renderJson(jobAssignmentBusi.complete(getAttr("pojo"),initQueryMap()));
    }


    @Before({JobAssignmentConfirmValidator.class, Tx.class})
    public void confirm() {
        renderJson(jobAssignmentBusi.confirm(getAttr("pojo"),initQueryMap()));
    }


    public void deleteById() {
        Map<String, Object> paramsMap = initQueryMap();
        paramsMap.put("id", getPara("id"));
        renderJson(jobAssignmentBusi.deleteById(paramsMap));
    }


}
