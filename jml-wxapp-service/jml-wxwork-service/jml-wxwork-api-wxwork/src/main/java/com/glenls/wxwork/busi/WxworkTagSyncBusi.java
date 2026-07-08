package com.glenls.wxwork.busi;

import com.alibaba.fastjson.JSON;
import com.glenls.commons.jfinal_wxwork.sdk.api.ApiResult;
import com.glenls.commons.jfinal_wxwork.sdk.api.ConTagApi;
import com.glenls.wxwork.model.WxWorkLabelInfoModel;
import com.glenls.wxwork.pojo.TagGroupPojo;
import com.glenls.wxwork.pojo.TagPojo;
import com.jfinal.aop.Inject;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.List;


@Slf4j
public class WxworkTagSyncBusi {

    @Inject
    private WxWorkLabelInfoModel labelInfoDao;

    
    public void syncTag(){
        ApiResult apiResult = ConTagApi.getTagList();
        log.info("企业标签信息：" + apiResult.getJson());
        if(!apiResult.isSucceed()){
            log.error("标签同步失败");
            return ;
        }

        List<TagGroupPojo> tagGroupList = JSON.parseArray(JSON.toJSONString(apiResult.getList("tag_group")),TagGroupPojo.class);
        if(CollectionUtils.isEmpty(tagGroupList)){
            log.error("标签组数据为空");
            return ;
        }
        saveTag(tagGroupList);

        log.info("标签更新完成");
    }

    
    private void saveTag(List<TagGroupPojo> groupList){
        if(CollectionUtils.isEmpty(groupList)){
            return;
        }
        List<WxWorkLabelInfoModel> allTagList = labelInfoDao.queryAll();

        List<WxWorkLabelInfoModel> insertList = new ArrayList<>();
        List<WxWorkLabelInfoModel> updateList = new ArrayList<>();

        for(TagGroupPojo groupPojo : groupList){
            List<TagPojo> tagList = groupPojo.getTag();
            if(CollectionUtils.isEmpty(tagList)){
                continue;
            }

            String groupId = groupPojo.getGroup_id();
            String groupName = groupPojo.getGroup_name();
            int groupOrder = groupPojo.getOrder();

            for(TagPojo tagPojo : tagList){
                String tagId = tagPojo.getId();
                String tagName = tagPojo.getName();
                int tagOrder = tagPojo.getOrder();

                WxWorkLabelInfoModel model = findByStr(allTagList,"tag_id",tagId);
                boolean isExists = model != null;
                if(!isExists){
                    model = new WxWorkLabelInfoModel();
                }
                model.set("tag_id",tagId);
                model.set("tag_name",tagName);
                model.set("group_id",groupId);
                model.set("group_name",groupName);
                model.set("group_order",groupOrder);
                model.set("tag_order",tagOrder);

                if(isExists){
                    updateList.add(model);
                }else {
                    insertList.add(model);
                }
            }

            if(CollectionUtils.isNotEmpty(insertList)){
                labelInfoDao.batchInsert(insertList);
            }

            if(CollectionUtils.isNotEmpty(updateList)){
                labelInfoDao.batchUpdate(updateList);
            }
        }

    }

    
    private WxWorkLabelInfoModel findByStr(List<WxWorkLabelInfoModel> allTagList, String key, String val){
        if(CollectionUtils.isEmpty(allTagList)){
            return null;
        }
        for(WxWorkLabelInfoModel model : allTagList){
            String targetVal = model.get(key);
            if(StringUtils.equals(targetVal,val)){
               return model;
            }
        }

        return null;
    }
}
