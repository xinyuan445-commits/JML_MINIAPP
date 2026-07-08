package com.glenls.salesforce.modules.pub.pojo;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;


@Setter
@Getter
public class SfTokenPojo implements Serializable {

    private String token;

    private String url;
}
