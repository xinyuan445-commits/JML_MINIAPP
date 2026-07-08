package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;


@Data
public class PressLineDailyReportDetailPojo {
    @Column("id")
    private String id;  

    @Column("model")
    @NotBlank(message = "型号不能为空")
    private String  model;  

    @Column("capacity")
    private Integer capacity;  

    @Column("good_qty")
    @NotNull(message = "良品数不能为空")
    private Integer goodQty;  

    @Column("defective_qty")
    private Integer defectiveQty;  

    @Column("paper_consumption")
    @NotNull(message = "纸张耗用不能为空")
    private Integer paperConsumption;  

    @Column("substrate_consumption")
    @NotNull(message = " 基材耗用不能为空")
    private Integer substrateConsumption;  

    @Column("remark")
    private String remark;  
}
