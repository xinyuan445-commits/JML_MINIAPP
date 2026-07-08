package com.glenls.salesforce.modules.log.pojo;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;


@Setter
@Getter
public class LogDbToSFPojo implements Serializable {

    
    private String code;

    
    private String val;

    
    private String post_json;

    
    private String ret_json;

    
    private String send_status;

    
    private long cost_time;

    
    private String update_sql;
}
