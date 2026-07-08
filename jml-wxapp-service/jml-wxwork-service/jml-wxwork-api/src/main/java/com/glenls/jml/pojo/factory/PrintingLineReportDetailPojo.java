package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;


@Data
public class PrintingLineReportDetailPojo {

    @Column("id")
    private String id;

    @Column("people_num")
    private Integer peopleNum;  

    @Column("material")
    @NotBlank(message = "物料号不能为空")
    private String material;  

    @Column("good_qty")
    @NotNull(message = "良品数量不能为空")
    private Integer goodQty;  

    @Column("defective_qty")
    private Integer defectiveQty;

    @Column("print_qty")
    private Integer printQty;  

    @Column("defective_desc")
    private String defectiveDesc;  

    @Column("remark")
    private String remark;  

}
