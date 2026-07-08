package com.glenls.jml.busi;

import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.jml.model.ProductModel;
import com.jfinal.aop.Inject;
import com.jfinal.i18n.Res;
import org.apache.commons.lang3.StringUtils;

import java.util.Map;


public class ProductBusi {

    @Inject
    private ProductModel productDao;


    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("获取产品分页列表成功",productDao.queryPageBy(pageNo,pageSize,paramsMap));
    }


    public RestApiResult queryDetails(String id){
        if(StringUtils.isEmpty(id)){
            return RestApiResult.newFail("产品Id不能为空");
        }
        return RestApiResult.newSuccess("获取产品明细成功",productDao.queryDetails(id));
    }


    public RestApiResult queryList(){
        return RestApiResult.newSuccess("获取产品列表成功",productDao.queryList());
    }
}
