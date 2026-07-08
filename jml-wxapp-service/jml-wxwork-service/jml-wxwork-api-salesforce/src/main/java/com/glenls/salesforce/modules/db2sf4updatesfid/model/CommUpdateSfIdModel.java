package com.glenls.salesforce.modules.db2sf4updatesfid.model;

import com.glenls.commons.jfinal.plugins.sqlxml.plugin.activerecord.DbXmlModel;
import com.jfinal.plugin.activerecord.IBean;


public class CommUpdateSfIdModel extends DbXmlModel<CommUpdateSfIdModel> implements IBean {

    public int updateSalesReportByRemId(){
        return updateForXml("jmlDbUpdateSFIdComm.updateSRRemIdSfIdByRemId");
    }
}
