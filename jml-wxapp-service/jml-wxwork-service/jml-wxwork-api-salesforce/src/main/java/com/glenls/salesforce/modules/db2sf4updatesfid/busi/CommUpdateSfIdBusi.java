package com.glenls.salesforce.modules.db2sf4updatesfid.busi;

import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.salesforce.modules.db2sf4updatesfid.model.CommUpdateSfIdModel;
import com.jfinal.aop.Inject;


public class CommUpdateSfIdBusi {

    @Inject
    private CommUpdateSfIdModel commUpdateDao;


    public RestApiResult updateSalesReportByRemId(){
        commUpdateDao.updateSalesReportByRemId();
        return RestApiResult.newSuccess();
    }
}
