package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_account",primaryKey = "id")
public class AccountModel extends DbXmlModel4Jboot<AccountModel> implements IBean {

    
    public AccountModel queryExistByName(String name) {
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("name",name);
        return findFirstForXml("account.queryExistByName",paramsMap);
    }

    
    public Page<AccountModel> queryPage(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "account.queryPage",paramsMap);
    }

    
    public AccountModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("account.queryDetails",paramsMap);
    }

    public List<AccountModel> queryListByStaff(Map<String,Object> paramsMap){
        return findForXml("account.queryListByStaff",paramsMap);
    }

}
