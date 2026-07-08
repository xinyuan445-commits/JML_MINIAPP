package com.glenls.salesforce.modules.sf2db4update.bean;

import lombok.Getter;
import lombok.Setter;

import java.util.List;


@Setter
@Getter
public class Sf2DbDelDetailPojo {


    private String objCode;


    private List<String> sfidList;
}
