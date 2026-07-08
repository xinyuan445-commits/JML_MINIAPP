package com.glenls.salesforce.modules.db2sf.pojo;

import com.glenls.salesforce.modules.db2sf.model.SfSyncConfDbSfDetailModel;
import com.glenls.salesforce.modules.db2sf.model.SfSyncConfDbSfModel;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.List;


@Setter
@Getter
public class Db2SFConfPojo implements Serializable {

    
    private String url;

    
    private SfSyncConfDbSfModel model;

    
    private List<SfSyncConfDbSfDetailModel> detailList;

    
    private String[] removeAttr;

    
    private List<SfSyncConfDbSfDetailModel> updateList;
}
