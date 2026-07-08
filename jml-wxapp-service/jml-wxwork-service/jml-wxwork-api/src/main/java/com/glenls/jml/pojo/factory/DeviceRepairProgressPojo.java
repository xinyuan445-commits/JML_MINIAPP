package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;


@Data
public class DeviceRepairProgressPojo {

    @Column("device_repair_id")
    private String id;  

    @Column("repair_content")
    @NotBlank(message = "维修内容不能为空")
    private String repairContent;  

    @Column("repair_img1")
    private String repairImg1;  

    @Column("repair_img2")
    private String repairImg2;  

    @Column("repair_img3")
    private String repairImg3;  

    @Column("repair_start_time")
    private String  repairStartTime; 

    @Column("repair_end_time")
    private String  repairEndTime; 


    @Column("remark")
    private String remark;  

}
