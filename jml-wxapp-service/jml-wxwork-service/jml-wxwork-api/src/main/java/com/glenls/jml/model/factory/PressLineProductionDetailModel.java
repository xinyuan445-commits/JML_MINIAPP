package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_press_line_production_detail",primaryKey = "id")
public class PressLineProductionDetailModel  extends DbXmlModel4Jboot<PressLineProductionDetailModel> implements IBean {

    public List<PressLineProductionDetailModel> queryListBy(String pressLineProductionId) {
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("pressLineProductionId", pressLineProductionId);
        return findForXml("pressLineProductionDetail.queryListBy", paramsMap);
    }
}
