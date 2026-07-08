package com.glenls.wxwork.pojo;

import lombok.Getter;
import lombok.Setter;

import java.util.List;


@Setter
@Getter
public class WxworkContactFollowPojo {
    
    private String userid;

    
    private String remark;

    
    private String description;

    
    private Long createtime;

    
    private String remark_corp_name;

    
    private String remark_mobiles;

    
    private Integer add_way;

    
    private String oper_userid;

    
    private String state;

    
    private List<WxworkContactTagPojo> tags;
}
