package com.glenls.wxwork.pojo;

import lombok.Getter;
import lombok.Setter;

import java.util.List;


@Setter
@Getter
public class TagGroupPojo {

    
    private String group_id;

    
    private String group_name;

    
    private Long create_time;

    
    private int order;

    private List<TagPojo> tag;
}
