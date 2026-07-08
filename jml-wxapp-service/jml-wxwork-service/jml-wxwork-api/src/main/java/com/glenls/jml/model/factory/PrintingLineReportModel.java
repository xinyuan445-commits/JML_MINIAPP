package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_printing_line_report",primaryKey = "id")
public class PrintingLineReportModel extends DbXmlModel4Jboot<PrintingLineReportModel> implements IBean {


    public Page<PrintingLineReportModel> queryPageBy(int pageNumber, int pageSize, Map<String,Object> paramsMap) {
        return paginateForXml(pageNumber, pageSize, "printingLineReport.queryPageBy", paramsMap);
    }


    public PrintingLineReportModel queryDetails(String id) {
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("printingLineReport.queryDetails",paramsMap);
    }
}
