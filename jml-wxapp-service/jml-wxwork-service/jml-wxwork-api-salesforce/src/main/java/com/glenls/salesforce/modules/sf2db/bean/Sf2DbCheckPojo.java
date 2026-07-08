package com.glenls.salesforce.modules.sf2db.bean;

import com.alibaba.fastjson.JSONObject;
import com.glenls.salesforce.modules.sf2db.model.ConfSF2DBDetailModel;
import lombok.Getter;
import lombok.Setter;

import java.util.List;


@Setter
@Getter
public class Sf2DbCheckPojo {

    
    private List<ConfSF2DBDetailModel> confList;


    private List<JSONObject> success;


    private List<JSONObject> fail;
}
