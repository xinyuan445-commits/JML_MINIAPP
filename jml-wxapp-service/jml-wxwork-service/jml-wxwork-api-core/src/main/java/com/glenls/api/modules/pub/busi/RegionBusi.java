package com.glenls.api.modules.pub.busi;

import com.glenls.api.modules.pub.model.SysRegionModel;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.jfinal.aop.Inject;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.List;


@Slf4j
public class RegionBusi {

    @Inject
    private SysRegionModel regionDao;


    public RestApiResult list(){
        return RestApiResult.newSuccessWithData(regionDao.queryAll());
    }


    public RestApiResult tree(){
        List<SysRegionModel> list = regionDao.queryAll();
        return RestApiResult.newSuccessWithData(recursionRegion(list,null));
    }

    public RestApiResult treeX(){
        List<SysRegionModel> list = regionDao.queryAllX();
        return RestApiResult.newSuccessWithData(recursionRegion(list,null));
    }



    private List<SysRegionModel> recursionRegion(List<SysRegionModel> modelList, String pcode){
        List<SysRegionModel> retList = new ArrayList<>();
        if(CollectionUtils.isEmpty(modelList)){
            return retList;
        }

        for(SysRegionModel model : modelList){
            String targetPcode = model.get("pcode");
            String targetCode = model.get("code");

            if(StringUtils.equals(targetPcode,pcode)){
                List<SysRegionModel> subList = recursionRegion(modelList,targetCode);
                if(CollectionUtils.isNotEmpty(subList)){
                    model.put("children",subList);
                }

                retList.add(model);
            }

        }

        return retList;
    }


    public RestApiResult allProvince(){
        return RestApiResult.newSuccessWithData(regionDao.findProvinceList());
    }
}
