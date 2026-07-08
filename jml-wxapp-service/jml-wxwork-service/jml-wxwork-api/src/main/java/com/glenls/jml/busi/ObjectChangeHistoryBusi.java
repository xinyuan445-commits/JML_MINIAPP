package com.glenls.jml.busi;

import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.jml.model.ObjectChangeHistoryModel;
import com.jfinal.aop.Inject;

import java.util.Map;


public class ObjectChangeHistoryBusi {
    @Inject
    private ObjectChangeHistoryModel objectChangeHistoryDao;



    public RestApiResult queryListBy(Map<String,Object> paramsMap) {
        return RestApiResult.newSuccess("查询变更历史成功", objectChangeHistoryDao.queryListBy(paramsMap));
    }

}
