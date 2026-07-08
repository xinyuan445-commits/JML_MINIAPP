package com.glenls.jml.controller;

import com.glenls.jml.busi.AccountAddressBusi;
import com.glenls.jml.busi.AccountBusi;
import com.glenls.jml.model.AccountAddressModel;
import com.glenls.jml.model.AccountModel;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.glenls.jml.validator.account.AccountSaveValidator;
import com.jfinal.aop.Before;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.HashMap;
import java.util.Map;


@RequestMapping("/api/account")
public class AccountController extends Base4JmlAuthController {

    @Inject
    private AccountBusi accountBusi;

    @Inject
    private AccountAddressBusi accountAddressBusi;


    public void queryAccountPage(){
        Map<String,Object>  paramsMap = initQueryMap();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        paramsMap.put("province",getPara("province"));
        paramsMap.put("city",getPara("city"));
        renderJson(accountBusi.queryPage(getPageNo(),getPageSize(),paramsMap));
    }


    public void queryListByStaff(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("type",getPara("type"));
        renderJson(accountBusi.queryListByStaff(paramsMap));
    }


    @Before({AccountSaveValidator.class})
    public void saveAccount(){
        Map<String,Object> paramsMap = initQueryMap();
        AccountModel model = getModel(AccountModel.class,"account");
        renderJson(accountBusi.save(model,paramsMap));
    }


    public void queryAccountDetails(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(accountBusi.queryDetails(paramsMap));
    }


    public void queryAddressPageBy(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("accountId",getPara("accountId"));
        renderJson(accountAddressBusi.queryPageBy(getPageNo(),getPageSize(),paramsMap));
    }


    public void saveAddress(){
        Map<String,Object> paramsMap = initQueryMap();
        AccountAddressModel model = getModel(AccountAddressModel.class,"address");
        renderJson(accountAddressBusi.save(model,paramsMap));
    }


    public void queryAddressDetails(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(accountAddressBusi.queryDetails(paramsMap));
    }


    public void queryListByAccountId(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("accountId",getPara("accountId"));
        renderJson(accountBusi.queryListByAccountId(paramsMap));
    }

}
