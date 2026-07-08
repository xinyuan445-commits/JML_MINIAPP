package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;


@Data
public class PeripheralDeviceMntPojo {

    @Column("id")
    private String id;                   
    @Column("job_type")
    private String jobType; 

    @Column("prod_line_or_dept")
    private String prodLineOrDept;       


    @Column("item_type")
    private String itemType;             

    @Column("tp_staff_id")
    @NotBlank(message = "分配第三方维修员不能为空")
    private String tpStaffId;            

    @Column("maintenance_opinion")
    private String maintenanceOpinion;   

    @Column("maintenance_img_1")
    private String maintenanceImg1;      

    @Column("maintenance_img_2")
    private String maintenanceImg2;      

    @Column("maintenance_img_3")
    private String maintenanceImg3;      

    @Column("maintenance_result")
    private String maintenanceResult;    

    @Column("post_maintenance_status")
    private String postMaintenanceStatus;

    @Column("is_repair_order_created")
    private String isRepairOrderCreated; 

    @Column("maintenance_eq")
    @NotBlank(message = "保养设备不能为空")
    private String maintenanceEq;        

    @Column("maintenance_date")
    @NotBlank(message = "保养日期不能为空")
    private String maintenanceDate;        

    @Column("maintenance_record_img1")
    private String maintenanceRecordImg1;

    @Column("maintenance_record_img2")
    private String maintenanceRecordImg2;

    @Column("maintenance_record_img3")
    private String maintenanceRecordImg3;

    @Column("maintenance_record_img4")
    private String maintenanceRecordImg4;

    @Column("maintenance_record_img5")
    private String maintenanceRecordImg5;

    @Column("confirm_sign_img1")
    private String confirmSignImg1;

    @Column("confirm_sign_img2")
    private String confirmSignImg2;

    @Column("confirm_sign_img3")
    private String confirmSignImg3;

    @Column("confirm_sign_img4")
    private String confirmSignImg4;

    @Column("confirm_sign_img5")
    private String confirmSignImg5;

    @Column("remark")
    private String remark;               
}
