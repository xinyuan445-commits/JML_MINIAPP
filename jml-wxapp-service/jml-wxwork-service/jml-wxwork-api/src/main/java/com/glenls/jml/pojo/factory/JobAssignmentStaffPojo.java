package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;


@Data
public class JobAssignmentStaffPojo {

    @Column("id")
    private String id;
    
    @Column("assigned_engineer_staff_id")
    private String assignedEngineerStaffId ;

    @Column("job_assignment_id")
    private String jobAssignmentId; 

    @Column("completion_status")
    private String completionStatus;  

    @Column("work_qty")
    private Integer workQty;  

    @Column("work_content")
    private String workContent;  

    @Column("work_hours")
    private String workHours;  

    @Column("completion_img1")
    private String completionImg1;

    @Column("completion_img2")
    private String completionImg2;

    @Column("completion_img3")
    private String completionImg3;

    @Column("completion_img4")
    private String completionImg4;

    @Column("completion_img5")
    private String completionImg5;

    @Column("completion_location")
    private String completionLocation;  

    @Column("completion_longitude")
    private String completionLongitude;  

    @Column("completion_latitude")
    private String completionLatitude;  

    @Column("completion_remark") 
    private String completionRemark;

    @Column("actual_completed_qty")
    private Integer actualCompletedQty;  

    @Column("overtime_hours")
    private String overtimeHours;  

    @Column("actual_work_hours")
    private String actualWorkHours; 

    @Column("confirmation_remark")
    private String confirmationRemark;  


    @Column("start_time")
    private String startTime;

    @Column("end_time")
    private String endTime;





}
