package com.glenls.jml.validator.salesReport;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.model.SalesReportModel;
import com.jfinal.aop.Inject;
import com.jfinal.core.Controller;
import org.apache.commons.lang3.StringUtils;


public class SalesReportSaveValidator  extends ValidatorBase4Pub {
    @Inject
    private SalesReportModel salesReportModel;
    protected void validate(Controller c) {
        super.validate(c);
        if(SalesReportModel.TYPE_BFKH.equals(c.getPara("salesReport.type")) && StringUtils.isEmpty(c.getPara("salesReport.account_id"))){
            this.addError(ERROR_KEY,"工作报告类型是客户拜访的，拜访公司必填");
        }
    }

}
