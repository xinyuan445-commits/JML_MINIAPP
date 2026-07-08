package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import java.util.List;


@Data
public class PartsPurchasePojo {
    @Column("id")
    private String id;  

    @Column("device_repair_id")
    private String deviceRepairId;  

    @Column("job_type")
    private String jobType;  

    @Column("prod_line_or_dept")
    private String prodLineOrDept;  

    @Column("remark")
    private String remark;  
    @Column("status")
    private String status;  

    private String historyStatus;  

    List<PartsPurchaseDetailsPojo> partsPurchaseDetailsList;
}
