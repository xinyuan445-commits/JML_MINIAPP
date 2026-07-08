package com.glenls.jml.pojo.factory;

import cn.hutool.core.date.DateTime;
import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.List;


@Data
public class JobAssignmentPojo {
    @Column("id")
    private String id;  

    @Column("work_no")
    private String workNo;  

    @Column("job_type")
    private String jobType;  

    @Column("completion_status")
    private String completionStatus;  

    @Column("prod_line_or_dept")
    private String prodLineOrDept;  

    @Column("completion_location")
    private String completionLocation;  

    @Column("completion_longitude")
    private String completionLongitude;  

    @Column("completion_latitude")
    private String completionLatitude;  

    @Column("task_date")
    private String taskDate;  

    @Column("work_content")
    private String workContent;  

    @Column("work_hours")
    private String workHours;  

    @Column("assigned_remark")
    private String assignedRemark;  

    @Column("work_qty")
    private Integer workQty;  

    @Column("actual_completed_qty")
    private Integer actualCompletedQty;  

    @Column("overtime_hours")
    private String overtimeHours;  

    @Column("expected_qty")
    private Integer expectedQty;  

    @Column("expected_work_hours")
    private String expectedWorkHours;  

    @Column("completion_remark")
    private String completionRemark;  

    @Column("confirmation_remark")
    private String confirmationRemark;  

    @Column("assign_type")
    private String assignType;

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


    private List<JobAssignmentStaffPojo> assignmentStaffPojoList;

}
