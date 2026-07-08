package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;


@Data
public class NitrogenLogPojo {

    @Column("id")
    private String id;               

    @Column("name")
    private String name;               

    @Column("daily_usage_cm")
    private Double dailyUsageCm;       

    @Column("daily_usage_kg")
    private Double dailyUsageKg;       

    @Column("liquid_level")
    @NotNull(message = "液位示数不能为空")
    private Double liquidLevel;         

    @Column("liquid_level_img1")
    @NotBlank(message = "液位示数照片不能为空")
    private String liquidLevelImg1;     

    @Column("remark")
    private String remark;             

    @Column("before_liquid_level")
    private Double beforeLiquidLevel;       

    @Column("before_usage_cm")
    private Double beforeUsageCm;         

    @Column("before_usage_kg")
    private Double beforeUsageKg;     

    @Column("nitrogen_amount") 
    private Double nitrogenAmount;


}
