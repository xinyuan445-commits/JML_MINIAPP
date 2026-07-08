package com.glenls.salesforce.modules.db2sf.pojo;

import com.jfinal.plugin.activerecord.Record;
import lombok.Getter;
import lombok.Setter;

import java.util.List;


@Setter
@Getter
public class DbRecordPojo {

    
    private List<Record> sourceList;

    
    private List<Record> targetList;
}
