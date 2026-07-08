package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;


@Data
public class ElectricityLogPojo {
    @Column("id")
    private String id;               

    @Column("name")
    private String name;             

    @Column("daily_reading")
    @NotNull(message = "今日用电示数不能为空")
    private Double dailyReading;     

    @Column("electricity_img1")
    @NotBlank(message = "今日用电示数照片不能为空")
    private String electricityImg1;   

    @Column("before_reading")
    private Double beforeReading;    

    @Column("before_usage")
    private Double beforeUsage;      

    @Column("electricity_type")
    private String electricityType;

    @Column("remark")
    private String remark;           

}
