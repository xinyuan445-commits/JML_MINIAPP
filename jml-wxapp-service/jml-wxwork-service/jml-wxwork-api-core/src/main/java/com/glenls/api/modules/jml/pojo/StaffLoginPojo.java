package com.glenls.api.modules.jml.pojo;

import lombok.Getter;
import lombok.Setter;

import javax.validation.constraints.NotNull;


@Setter
@Getter
public class StaffLoginPojo {

    
    @NotNull(message ="手机号码不能为空")
    private String mobile;

    @NotNull(message ="密码不能为空")
    private String pwd;

    private String openId;

    private String unionId;

    private String userAgent;

    private String device;

}
