package com.glenls.salesforce.modules.sf2db4update.bean;

import lombok.Getter;
import lombok.Setter;

import javax.validation.constraints.NotNull;


@Setter
@Getter
public class Sf2DbInPojo {

    
    @NotNull(message = "字符串数据为空")
    private String data;
}
