package com.glenls.jml.model;



import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.Map;


@Table(tableName = "jml_serial_numbers",primaryKey = "id")
public class SerialNumbersModel extends DbXmlModel4Jboot<SerialNumbersModel> implements IBean {


    public SerialNumbersModel querySerNoBy(Map<String,Object> paramsMap){
       return findFirstForXml("serialNumbers.querySerNoBy",paramsMap);
    }


    public int updateNoByToday(Map<String,Object> paramsMap){
        return updateForXml("serialNumbers.updateNoByToday",paramsMap);
    }
}
