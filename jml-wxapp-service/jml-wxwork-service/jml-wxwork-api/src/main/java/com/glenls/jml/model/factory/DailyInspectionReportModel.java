package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.Map;


@Table(tableName = "jml_daily_inspection_report",primaryKey = "id")
public class DailyInspectionReportModel extends DbXmlModel4Jboot<DailyInspectionReportModel> implements IBean {


    public Page<DailyInspectionReportModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap) {
        return paginateForXml(pageNo, pageSize, "dailyInspectionReport.queryPageBy", paramsMap);
    }

    public DailyInspectionReportModel countCheckEbSkin(String id) {
        Map<String, Object> paramsMap = new java.util.HashMap<>();
        paramsMap.put("id", id);
        return findFirstForXml("dailyInspectionReport.countCheckEbSkin", paramsMap);
    }


    public DailyInspectionReportModel countCheckPress(String id) {
        Map<String, Object> paramsMap = new java.util.HashMap<>();
        paramsMap.put("id", id);
        return findFirstForXml("dailyInspectionReport.countCheckPress", paramsMap);
    }

    public DailyInspectionReportModel countCheckChamfer(String id) {
        Map<String, Object> paramsMap = new java.util.HashMap<>();
        paramsMap.put("id", id);
        return findFirstForXml("dailyInspectionReport.countCheckChamfer", paramsMap);
    }

    public DailyInspectionReportModel countPrintLine(String id) {
        Map<String, Object> paramsMap = new java.util.HashMap<>();
        paramsMap.put("id", id);
        return findFirstForXml("dailyInspectionReport.countPrintLine", paramsMap);
    }


    public DailyInspectionReportModel countCheckAll(String id) {
        Map<String, Object> paramsMap = new java.util.HashMap<>();
        paramsMap.put("id", id);
        return findFirstForXml("dailyInspectionReport.countCheckAll", paramsMap);
    }


    public DailyInspectionReportModel queryDetails(String id) {
        Map<String, Object> paramsMap = new java.util.HashMap<>();
        paramsMap.put("id", id);
        return findFirstForXml("dailyInspectionReport.queryDetails", paramsMap);
    }

    public int checkAllConfirmed(String id){
        Map<String, Object> paramsMap = new java.util.HashMap<>();
        paramsMap.put("id", id);
        return findFirstForXml("dailyInspectionReport.checkAllConfirmed", paramsMap).getInt("cnt");
    }
}
