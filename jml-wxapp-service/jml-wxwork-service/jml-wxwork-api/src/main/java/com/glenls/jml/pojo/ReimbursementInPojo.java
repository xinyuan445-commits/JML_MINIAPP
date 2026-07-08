package com.glenls.jml.pojo;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.Date;
import java.util.List;


@Setter
@Getter
public class ReimbursementInPojo implements Serializable {

    private String id;

    
    private Date startDate;

    
    private Date endDate;

    private String salesReportIds;

    
    private String remark;
    
    private String areaCode;
    
    private String district;

    
    private List<ReimbursementDetailInPojo> detailList;


}
