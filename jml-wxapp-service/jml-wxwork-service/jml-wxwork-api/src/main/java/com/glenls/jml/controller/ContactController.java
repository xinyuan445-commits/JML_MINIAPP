package com.glenls.jml.controller;

import com.glenls.commons.jboot.controller.BaseController;
import com.glenls.jml.busi.ContactBusi;
import com.glenls.jml.model.ContactModel;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.validator.contact.ContactSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.HashMap;
import java.util.Map;


@RequestMapping("/api/contact")
public class ContactController extends Base4JmlAuthController {
    
    @Inject
    private ContactBusi contactBusi;


    public void queryContactPageBy(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        paramsMap.put("accountId",getPara("accountId"));
        renderJson(contactBusi.queryPageBy(getPageNo(),getPageSize(),paramsMap));
    }


    public void queryListByStaff(){
        Map<String,Object> paramsMap = initQueryMap();
        renderJson(contactBusi.queryListByStaff(paramsMap));
    }


    @Before({ContactSaveValidator.class})
    public void saveContact(){
        Map<String,Object> paramsMap = initQueryMap();
        ContactModel model = getModel(ContactModel.class,"contact");
        renderJson(contactBusi.save(model,paramsMap));
    }


    public void queryContactDetails(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(contactBusi.queryDetails(paramsMap));
    }



}
