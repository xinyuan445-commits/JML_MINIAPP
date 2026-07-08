package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_marketing_lead_and_contact",primaryKey = "id")
public class MarketingLeadAndContactModel extends DbXmlModel4Jboot<MarketingLeadAndContactModel> implements IBean {


    public List<MarketingLeadAndContactModel> queryListBy(Map<String,Object> paramsMap){
        return findForXml("marketingLeadAndContact.queryListBy",paramsMap);
    }


    public int updateMarketingLeadBy(Map<String,Object> paramsMap){
        return updateForXml("marketingLeadAndContact.updateMarketingLeadBy",paramsMap);

    }


    public int updateMarketingContactId(Map<String,Object> paramsMap){
        return updateForXml("marketingLeadAndContact.updateMarketingContactId",paramsMap);
    }


    public MarketingLeadAndContactModel queryMarketIdByLeadId(String leadId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("leadId",leadId);
        return findFirstForXml("marketingLeadAndContact.queryMarketIdByLeadId",paramsMap);
    }


}
