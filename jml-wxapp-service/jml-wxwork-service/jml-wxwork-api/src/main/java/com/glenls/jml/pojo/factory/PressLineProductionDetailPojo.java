package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;


@Data
public class PressLineProductionDetailPojo {
    @Column("id")
    private String id;  

    @Column("model")
    @NotBlank(message = "型号不能为空")
    private String model;  

    @Column("pressure")
    @NotBlank(message = "压力不能为空")
    private String pressure;  

    @Column("time")
    @NotBlank(message = "时间不能为空")
    private String time;  

    @Column("temp")
    @NotBlank(message = "温度不能为空")
    private String temp;  

    @Column("remark")
    private String remark;  
}
