package com.glenls.wxwork.pojo.user;

import lombok.Getter;
import lombok.Setter;

import java.util.List;


@Setter
@Getter
public class WxworkUserPojo {
    
    private String userid;

    
    private String name;

    
    private List<Long> department;

    
    private String mobile;

    
    private List<Integer> order;

    
    private String position;

    
    private String gender;

    
    private String email;

    
    private List<Long> is_leader_in_dept;

    
    private String avatar;

    
    private String thumb_avatar;

    
    private String telephone;

    
    private String alias;

    
    private String enable;

    
    private String status;

    
    private String qr_code;

    
    private String address;

    
    private String open_userid;

    
    private Long main_department;
}
