package com.glenls.salesforce.modules.sf2db4update.bean;

import com.alibaba.fastjson.JSONArray;
import lombok.Getter;
import lombok.Setter;


@Setter
@Getter
public class Sf2DbParsePojo {

    
    private String objCode;

    
    private Sf2DbInPojo data;

    
    private JSONArray dataArray;
}
