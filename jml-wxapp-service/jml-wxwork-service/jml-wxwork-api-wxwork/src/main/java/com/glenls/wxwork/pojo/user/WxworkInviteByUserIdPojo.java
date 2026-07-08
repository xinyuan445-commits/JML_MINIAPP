package com.glenls.wxwork.pojo.user;

import lombok.Data;


@Data
public class WxworkInviteByUserIdPojo {
    
    private String[] user;

    public WxworkInviteByUserIdPojo(String[] user) {
        this.user = user;
    }
}
