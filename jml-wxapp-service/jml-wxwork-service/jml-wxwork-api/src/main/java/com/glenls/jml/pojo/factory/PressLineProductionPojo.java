package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.List;


@Data
public class PressLineProductionPojo {
    @Column("id")
    private String id;  

    @Column("work_no")
    @NotBlank(message = "工单号不能为空")
    private String workNo;  

    @Column("date")
    @NotBlank(message = "日期不能为空")
    private String date;  

    @Column("remark")
    private String remark;  

    @Column("start_time")
    private String startTime;

    @Column("end_time")
    private String endTime;

    List<PressLineProductionDetailPojo>  pressLineProductionDetailList;
}
