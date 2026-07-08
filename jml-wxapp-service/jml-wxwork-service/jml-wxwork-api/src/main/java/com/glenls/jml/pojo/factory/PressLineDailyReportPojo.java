package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import java.util.List;


@Data
public class PressLineDailyReportPojo {
    @Column("id")
    private String id;  

    @Column("date")
    @NotBlank(message = "日期不能为空")
    private String date;  

    @Column("work_no")
    @NotBlank(message = "工单号不能为空")
    private String workNo;  

    @Column("remark")
    private String remark;  

    @Column("start_time")
    private String startTime;

    @Column("end_time")
    private String endTime;


    List<PressLineDailyReportDetailPojo> pressLineDailyReportDetailList;
}
