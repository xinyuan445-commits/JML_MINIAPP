package com.glenls.salesforce.modules.sf2db4update.bean;

import com.alibaba.fastjson.JSONObject;
import com.glenls.salesforce.modules.sf2db4update.model.ConfSF2DB4UpdateDetailModel;
import lombok.Getter;
import lombok.Setter;

import java.util.List;


@Setter
@Getter
public class Sf2DbCheckPojo {

    
    private List<ConfSF2DB4UpdateDetailModel> confList;


    private List<JSONObject> success;


    private List<JSONObject> fail;
}
