package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;


@Data
public class NaturalGasLogPojo {
    @Column("id")
    private String id;               

    @Column("name")
    private String name;             

    @Column("daily_reading")
    @NotNull(message = "今日天然气示数不能为空")
    private Double dailyReading;     

    @Column("natural_gas_img1")
    @NotBlank(message = "今日天然气示数照片不能为空")
    private String naturalGasImg1;   

    @Column("before_reading")
    private Double beforeReading;    

    @Column("before_usage")
    private Double beforeUsage;      

    @Column("remark")
    private String remark;           

}
