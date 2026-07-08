package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_internal_ticket_acceptance_history",primaryKey = "id")
public class InternalTicketAcceptanceHistoryModel extends DbXmlModel4Jboot<InternalTicketAcceptanceHistoryModel> implements IBean {


    
    public List<InternalTicketAcceptanceHistoryModel> queryHistoryShowList(Map<String,Object> paramsMap){
        return findForXml("internalTicketAcceptanceHistory.queryHistoryShowList",paramsMap);
    }

    

    public List<InternalTicketAcceptanceHistoryModel> queryHistoryShowRelated(Map<String,Object> paramsMap){
        return findForXml("internalTicketAcceptanceHistory.queryHistoryShowRelated",paramsMap);
    }

    
    public InternalTicketAcceptanceHistoryModel queryUpdateStageBy(Map<String,Object> paramsMap){
        return findFirstForXml("internalTicketAcceptanceHistory.queryUpdateStageBy",paramsMap);
    }

    
    public InternalTicketAcceptanceHistoryModel queryNextStage(Map<String,Object> paramsMap){
        return findFirstForXml("internalTicketAcceptanceHistory.queryNextStage",paramsMap);
    }

    
    public void deleteByTicketId(String ticketId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("ticketId",ticketId);
        deleteForXml("internalTicketAcceptanceHistory.deleteByTicketId",paramsMap);
    }




}
