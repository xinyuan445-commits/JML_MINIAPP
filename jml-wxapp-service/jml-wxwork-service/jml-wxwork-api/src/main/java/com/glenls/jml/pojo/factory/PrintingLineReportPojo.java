package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.List;


@Data
public class PrintingLineReportPojo {
    @Column("id")
    private String id;  

    @Column("work_no")
    @NotBlank(message = "工单号不能为空")
    private String workNo;  

    @Column("start_time")
    @NotBlank(message = "开始时间不能为空")
    private String startTime;  

    @Column("date")
    private String date;  

    @Column("end_time")
    @NotBlank(message = "结束时间不能为空")
    private String endTime;  

    @Column("remark")
    private String remark;  

    List<PrintingLineReportDetailPojo> printingLineReportDetailList;


}
