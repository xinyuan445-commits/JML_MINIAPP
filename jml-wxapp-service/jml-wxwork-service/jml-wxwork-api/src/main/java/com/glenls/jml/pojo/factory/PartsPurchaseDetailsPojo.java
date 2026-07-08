package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;


@Data
public class PartsPurchaseDetailsPojo {
    @Column("id")
    private String id;  

    @Column("name")
    private String name;  

    @Column("part_img1")
    private String partImg1;  

    @Column("part_img2")
    private String partImg2;  

    @Column("part_img3")
    private String partImg3;  

    @Column("qty")
    @NotNull(message = "数量不能为空")
    private Integer qty; 

    @Column("unit")
    @NotBlank(message = "单位不能为空")
    private String  unit;

    @Column("supplier")
    private String supplier;

    @Column("damage_desc")
    @NotBlank(message = "损坏情况及故障描述不能为空")
    private String damageDesc;  

    @Column("handling_method")
    @NotBlank(message = "处理方式不能为空")
    private String handlingMethod;

    @Column("remark")
    private String remark;  

}
