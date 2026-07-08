package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_sales_report",primaryKey = "id")
public class SalesReportModel extends DbXmlModel4Jboot<SalesReportModel> implements IBean {


    public static final String TYPE_BFKH = "拜访客户";

    public Page<SalesReportModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "salesReport.queryPageBy",paramsMap);
    }


    public SalesReportModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("salesReport.queryDetails",paramsMap);
    }


    public List<SalesReportModel> queryListBy(Map<String,Object> paramsMap){
        return findForXml("salesReport.queryListBy",paramsMap);
    }


    public List<SalesReportModel> queryUnRedListByRM(Map<String,Object> paramsMap){
        return findForXml("salesReport.queryUnRedListByRM",paramsMap);
    }


    public int updateReportReimId(Map<String,Object> paramsMap){
        return updateForXml("salesReport.updateReportReimId",paramsMap);

    }


    public List<SalesReportModel> queryDayListByDate(Map<String,Object> paramsMap){
        return findForXml("salesReport.queryDayListByDate",paramsMap);
    }


    public List<SalesReportModel> queryReportNoticeByDay(Map<String,Object> paramsMap){
        return findForXml("salesReport.queryReportNoticeByDay",paramsMap);
    }



    public List<SalesReportModel> queryGmReportDay(Map<String,Object> paramsMap){
        return findForXml("salesReport.queryGmReportDay",paramsMap);
    }


    public List<SalesReportModel> queryGmReportByDay(Map<String,Object> paramsMap){
        return findForXml("salesReport.queryGmReportByDay",paramsMap);
    }

    public int updateReportReimIdNull(String reimId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("reimId",reimId);
        return updateForXml("salesReport.updateReportReimIdNull",paramsMap);
    }


    public int updateSyncByReimSbt(String reimId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("reimId",reimId);
        return updateForXml("salesReport.updateSyncByReimSbt",paramsMap);
    }

}
