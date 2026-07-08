package com.glenls.wxwork.busi;

import com.alibaba.fastjson.JSON;
import com.glenls.commons.jfinal_wxwork.sdk.api.AccessTokenApi;
import com.glenls.commons.jfinal_wxwork.sdk.api.ApiResult;
import com.glenls.commons.jfinal_wxwork.sdk.kit.ParaMap;
import com.glenls.commons.jfinal_wxwork.sdk.utils.HttpUtils;
import com.glenls.wxwork.model.WxworkDeptModel;
import com.glenls.wxwork.pojo.WxworkDeptPojo;
import com.jfinal.aop.Inject;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.math.NumberUtils;

import java.util.ArrayList;
import java.util.List;


@Slf4j
public class WxWorkDeptSyncBusi {

    
    public static final String get_dept_list_url = "https:

    @Inject
    private WxworkDeptModel wxworkDeptDao;

    
    public void sync(){
        ParaMap pm= ParaMap.create("access_token", AccessTokenApi.getAccessTokenStr());
        String jsonResult= HttpUtils.get(get_dept_list_url, pm.getData());
        ApiResult apiResult = new ApiResult(jsonResult);

        log.info("企业微信部门信息：" + apiResult.getJson());

        if(!apiResult.isSucceed()){
            log.info("企业微信部门列表获取失败，不进行同步");
            return ;
        }

        List<WxworkDeptPojo> deptList = JSON.parseArray(JSON.toJSONString(apiResult.get("department_id")), WxworkDeptPojo.class);
        if(CollectionUtils.isEmpty(deptList)){
            log.info("部门列表为空，不进行同步");
            return;
        }

        List<WxworkDeptModel> modelList = wxworkDeptDao.queryAll();

        List<WxworkDeptModel> insertList = new ArrayList<>();
        List<WxworkDeptModel> updateList = new ArrayList<>();

        for (WxworkDeptPojo pojo : deptList){
            Long deptId = pojo.getId();
            WxworkDeptModel model = findBy(modelList,"id",deptId);
            boolean isExists = model != null;
            if(model == null){
                model = new WxworkDeptModel();
            }
            model.set("id",deptId);
            model.set("parentid",pojo.getParentid());
            model.set("order",pojo.getOrder());

            if(isExists){
                updateList.add(model);
            }else{
                insertList.add(model);
            }
        }

        if(CollectionUtils.isNotEmpty(insertList)){
            wxworkDeptDao.batchInsert(insertList);
        }

        if(CollectionUtils.isNotEmpty(updateList)){
            wxworkDeptDao.batchUpdate(updateList);
        }
    }

    
    private WxworkDeptModel findBy(List<WxworkDeptModel> allList, String key, Long val){
        if(CollectionUtils.isEmpty(allList)){
            return null;
        }
        for(WxworkDeptModel model : allList){
            Long targetVal = model.get(key);
            if(NumberUtils.compare(targetVal,val) == 0){
                return model;
            }
        }

        return null;
    }
}
