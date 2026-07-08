package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_product",primaryKey = "id")
public class ProductModel extends DbXmlModel4Jboot<ProductModel> implements IBean {
    private static final long serialVersionUID = 1L;


    public Page<ProductModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "product.queryPageBy",paramsMap);
    }


    public ProductModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("id",id);
        return findFirstForXml("product.queryDetails",paramsMap);
    }


    public List<ProductModel> queryList(){
        return findForXml("product.queryList");
    }


}
