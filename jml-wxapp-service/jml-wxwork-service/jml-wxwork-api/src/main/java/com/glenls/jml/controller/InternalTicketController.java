package com.glenls.jml.controller;

import com.glenls.jml.busi.InternalTicketBusi;
import com.glenls.jml.model.CaseModel;
import com.glenls.jml.model.InternalTicketModel;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.Map;


@RequestMapping("/api/internalTicket")
public class InternalTicketController  extends Base4JmlAuthController {

    @Inject
    private InternalTicketBusi internalTicketBusi;


    public void queryTicketPage(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        paramsMap.put("startDate",getPara("startDate"));
        paramsMap.put("endDate",getPara("endDate"));
        paramsMap.put("ticketType",getPara("ticketType"));
        paramsMap.put("createdStaffId",getPara("createdStaffId"));
        renderJson(internalTicketBusi.queryPageBy(getPageNo(),getPageSize(),paramsMap));
    }




    public void queryTicketDetails(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(internalTicketBusi.queryDetails(paramsMap));
    }


    public void saveTicket(){
        Map<String,Object> paramsMap = initQueryMap();
        InternalTicketModel model = getModel(InternalTicketModel.class,"ticket");
        renderJson(internalTicketBusi.save(model,paramsMap));
    }



    public void ticketDo(){
        Map<String,Object> paramsMap = initQueryMap();
        InternalTicketModel model = getModel(InternalTicketModel.class,"ticket");
        renderJson(internalTicketBusi.internalTicketDo(model,paramsMap));
    }


    public void deleteTicket(){
        renderJson(internalTicketBusi.deleteTicket(getPara("id")));
    }


}
