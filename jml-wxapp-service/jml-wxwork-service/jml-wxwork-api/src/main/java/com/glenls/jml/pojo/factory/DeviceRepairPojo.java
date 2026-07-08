package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;


@Data
public class DeviceRepairPojo {
    @Column("id")
    private String id;  

    @Column("job_type")
    private String jobType;  

    @Column("prod_line_or_dept")
    private String prodLineOrDept;  

    @Column("device_id")
    private String deviceId;  

    @Column("repair_status")
    private String repairStatus;  

    @Column("location")
    private String location;  

    @Column("fault_desc")
    private String faultDesc;  

    @Column("damage_img1")
    private String damageImg1;  

    @Column("damage_img2")
    private String damageImg2;  

    @Column("damage_img3")
    private String damageImg3;  

    @Column("impact_level")
    private String impactLevel;  

    @Column("repairer_staff_id")
    private String repairerStaffId;  

    @Column("repairer_status")
    private String repairerStatus;  

    @Column("assign_remark")
    private String assignRemark;  

    @Column("assign_time")
    private String assignTime;  

    @Column("repair_content")
    private String repairContent;  

    @Column("replace_part")
    private String replacePart;  

    @Column("part_name")
    private String partName;  

    @Column("part_model")
    private String partModel;  

    @Column("part_qty")
    private Integer partQty;  

    @Column("part_img_1")
    private String partImg1;  

    @Column("part_img_2")
    private String partImg2;  

    @Column("solution")
    private String solution;  

    @Column("fault_analysis")
    private String faultAnalysis;  

    @Column("prevention_method")
    private String preventionMethod;  

    @Column("completion_img1")
    private String completionImg1;  

    @Column("completion_img2")
    private String completionImg2;  

    @Column("completion_img3")
    private String completionImg3;  

    @Column("completion_staff_id")
    private String completionStaffId;  

    @Column("completion_time")
    private String completionTime;  

    @Column("completion_remark")
    private String completionRemark;  

    @Column("cancel_reason")
    private String cancelReason;  

    @Column("cancel_staff_id")
    private String cancelStaffId;  

    @Column("cancel_time")
    private String cancelTime;  

    @Column("repair_confirmed")
    private String repairConfirmed;  

    @Column("repair_feedback")
    private String repairFeedback;  

    @Column("service_rating")
    private String serviceRating;  

    @Column("remark")
    private String remark;  
}
