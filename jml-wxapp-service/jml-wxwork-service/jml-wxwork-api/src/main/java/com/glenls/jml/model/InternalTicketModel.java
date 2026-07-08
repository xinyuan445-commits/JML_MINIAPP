package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_internal_ticket",primaryKey = "id")
public class InternalTicketModel extends DbXmlModel4Jboot<InternalTicketModel> implements IBean {


    public Page<InternalTicketModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "internalTicket.queryPageBy",paramsMap);
    }


    public InternalTicketModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("internalTicket.queryDetails",paramsMap);
    }



}
