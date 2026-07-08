package com.glenls.salesforce.modules.db2sf.pojo;

import com.alibaba.fastjson.JSONObject;
import com.jfinal.plugin.activerecord.Record;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;


@Setter
@Getter
public class UpdateDbAttrPojo implements Serializable {

    
    private String updateSql;

    
    private String dbIdKey;

    
    private String dbIdVal;

    
    private Record record;

    
    private JSONObject sfRetObjJson;
}
