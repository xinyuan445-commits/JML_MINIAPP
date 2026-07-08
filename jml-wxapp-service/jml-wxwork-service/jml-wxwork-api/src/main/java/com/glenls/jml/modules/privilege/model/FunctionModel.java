package com.glenls.jml.modules.privilege.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.Map;


@Table(tableName = "jml_function",primaryKey = "id")
public class FunctionModel extends DbXmlModel4Jboot<FunctionModel> implements IBean {


    public FunctionModel queryByActionUrl(Map<String,Object> paramsMap){
        return findFirstForXml("jml_function.queryByActionUrl",paramsMap);
    }
}
