package com.glenls.salesforce.modules.sf2db.bean;

import lombok.Getter;
import lombok.Setter;

import javax.validation.Valid;
import java.util.List;


@Setter
@Getter
public class Sf2DbDelPojo {

    
    @Valid
    private List<Sf2DbDelDetailPojo> list;
}
