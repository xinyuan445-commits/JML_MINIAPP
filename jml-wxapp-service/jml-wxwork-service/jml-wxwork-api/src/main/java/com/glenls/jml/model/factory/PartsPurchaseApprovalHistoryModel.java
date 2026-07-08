package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_parts_purchase_approval_history",primaryKey = "id")
public class PartsPurchaseApprovalHistoryModel extends DbXmlModel4Jboot<PartsPurchaseApprovalHistoryModel> implements IBean {


    public List<PartsPurchaseApprovalHistoryModel> queryListBy(String partsPurchaseId) {
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("partsPurchaseId", partsPurchaseId);
        return findForXml("partsPurchaseApprovalHistory.queryListBy", paramsMap);
    }
}
