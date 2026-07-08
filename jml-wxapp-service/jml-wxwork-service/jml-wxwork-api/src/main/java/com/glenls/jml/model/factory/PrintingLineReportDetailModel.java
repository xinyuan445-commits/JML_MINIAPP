package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_printing_line_report_detail",primaryKey = "id")
public class PrintingLineReportDetailModel extends DbXmlModel4Jboot<PrintingLineReportDetailModel> implements IBean {

    public List<PrintingLineReportDetailModel> queryListBy(String printingLineReportId) {
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("printingLineReportId", printingLineReportId);
        return findForXml("printingLineReportDetail.queryListBy", paramsMap);
    }

    public PrintingLineReportDetailModel sumPrintQtyBy(String printingLineReportId){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("printingLineReportId", printingLineReportId);
        return findFirstForXml("printingLineReportDetail.sumPrintQtyBy", paramsMap);
    }
}
