package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.Map;


@Table(tableName = "jml_account_address",primaryKey = "id")
public class AccountAddressModel extends DbXmlModel4Jboot<AccountAddressModel> implements IBean {


    public Page<AccountAddressModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "accountAddress.queryPageBy",paramsMap);
    }


    public AccountAddressModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("accountAddress.queryDetails",paramsMap);
    }



}
