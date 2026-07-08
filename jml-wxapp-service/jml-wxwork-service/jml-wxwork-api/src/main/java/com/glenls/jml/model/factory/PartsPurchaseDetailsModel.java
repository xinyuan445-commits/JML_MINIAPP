package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_parts_purchase_details",primaryKey = "id")
public class PartsPurchaseDetailsModel extends DbXmlModel4Jboot<PartsPurchaseDetailsModel> implements IBean {

    public List<PartsPurchaseDetailsModel> queryListBy(String partsPurchaseId) {
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("partsPurchaseId", partsPurchaseId);
        return findForXml("partsPurchaseDetails.queryListBy", paramsMap);
    }

}
