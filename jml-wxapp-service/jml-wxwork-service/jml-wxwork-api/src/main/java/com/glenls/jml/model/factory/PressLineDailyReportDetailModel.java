package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_press_line_daily_report_detail",primaryKey = "id")
public class PressLineDailyReportDetailModel extends DbXmlModel4Jboot<PressLineDailyReportDetailModel> implements IBean {

    public List<PressLineDailyReportDetailModel> queryListBy(String pressLineDailyReportId) {
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("pressLineDailyReportId", pressLineDailyReportId);
        return findForXml("pressLineDailyReportDetail.queryListBy", paramsMap);
    }

    public PressLineDailyReportDetailModel sumQtyBy(String pressLineDailyReportId){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("pressLineDailyReportId", pressLineDailyReportId);
        return findFirstForXml("pressLineDailyReportDetail.sumQtyBy", paramsMap);
    }

}
