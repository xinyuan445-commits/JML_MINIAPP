package com.glenls.jml.busi;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.glenls.jml.model.RelatedCfgModel;
import com.jfinal.aop.Inject;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


public class RelatedCfgBusi {
    @Inject
    private RelatedCfgModel relatedCfgDao;


    
    public List<RelatedCfgModel> queryRelatedList(Map<String,Object> paramsMap){
        List<RelatedCfgModel>  relatedCfgModelList= relatedCfgDao.queryListByParentObjCode(paramsMap.get("tableName").toString());
        if(relatedCfgModelList.size()>0){
            for(RelatedCfgModel relModel : relatedCfgModelList){
                JSONArray relatedFieldJsonArray = null;
                JSONObject relatedTitleJson = null;
                JSONObject relatedHeadJson = null;
                paramsMap.put("relatedObjCode",relModel.get("related_obj_code"));
                paramsMap.put("relatedFieldCode",relModel.get("related_field_code"));
                if (StringUtils.isNotEmpty(relModel.getStr("related_record_field"))) {
                    relatedFieldJsonArray = JSON.parseArray(relModel.getStr("related_record_field"));
                }
                if ((StringUtils.isNotEmpty(relModel.getStr("related_record_title")))) {
                    relatedTitleJson = JSON.parseObject(relModel.getStr("related_record_title"));
                }
                if ((StringUtils.isNotEmpty(relModel.getStr("related_record_head")))) {
                    relatedHeadJson = JSON.parseObject(relModel.getStr("related_record_head"));
                }
                relModel.remove("related_record_field");
                relModel.remove("related_record_title");
                relModel.remove("related_record_head");

                relModel.put("relatedFieldJsonArray",relatedFieldJsonArray);
                relModel.put("relatedTitleJson",relatedTitleJson);
                relModel.put("relatedHeadJson",relatedHeadJson);
                relModel.put("cnt",relatedCfgDao.CntByRelatedCode(paramsMap));
            }
        }
        return relatedCfgModelList;
    }


}
