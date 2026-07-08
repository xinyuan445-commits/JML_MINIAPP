package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_parts_purchase",primaryKey = "id")
public class PartsPurchaseModel  extends DbXmlModel4Jboot<PartsPurchaseModel> implements IBean {

    public Page<PartsPurchaseModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap) {
        return paginateForXml(pageNo, pageSize, "partsPurchase.queryPageBy", paramsMap);
    }


    public PartsPurchaseModel queryDetails(String id) {
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("id", id);
        return findFirstForXml("partsPurchase.queryDetails", id);
    }


    public int queryCntByDevRepairId(String deviceRepairId) {
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("deviceRepairId", deviceRepairId);
        return findFirstForXml("partsPurchase.queryCntByDevRepairId", paramsMap).getLong("cnt").intValue();
    }

}
