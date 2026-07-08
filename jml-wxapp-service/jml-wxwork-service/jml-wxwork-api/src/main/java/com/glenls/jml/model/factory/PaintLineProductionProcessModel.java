package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_paint_line_production_process",primaryKey = "id")
public class PaintLineProductionProcessModel extends DbXmlModel4Jboot<PaintLineProductionProcessModel> implements IBean {


    public Page<PaintLineProductionProcessModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "paintLineProductionProcess.queryPageBy",paramsMap);
    }


    public PaintLineProductionProcessModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("paintLineProductionProcess.queryDetails",paramsMap);
    }
}
