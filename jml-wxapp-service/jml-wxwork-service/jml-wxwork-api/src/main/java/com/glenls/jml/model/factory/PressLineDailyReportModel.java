package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_press_line_daily_report",primaryKey = "id")
public class PressLineDailyReportModel  extends DbXmlModel4Jboot<PressLineDailyReportModel> implements IBean {

    
    public Page<PressLineDailyReportModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "pressLineDailyReport.queryPageBy",paramsMap);
    }

    
    public PressLineDailyReportModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("pressLineDailyReport.queryDetails",paramsMap);
    }

}
