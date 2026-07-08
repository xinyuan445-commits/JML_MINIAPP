package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;


@Data
public class SandingBeltReplacementPojo {
    @Column("id")
    private String id;

    @Column("name")
    private String name;

    @Column("machine_no")
    @NotBlank(message = "机械编号不能为空")
    private String machineNo;

    @Column("product_line")
    @NotBlank(message = "所属线体不能为空")
    private String productLine;

    @Column("replace_reason")
    @NotBlank(message = "更换原因不能为空")
    private String replaceReason;

    @Column("reason_desc")
    @NotBlank(message = "原因说明不能为空")
    private String reasonDesc;

    @Column("replace_start_time")
    @NotBlank(message = "更换开始时间不能为空")
    private String replaceStartTime;

    @Column("replace_date")
    @NotBlank(message = "更换日期不能为空")
    private String replaceDate;

    @Column("replace_cnt")
    @NotNull(message = "更换次数不能为空")
    private Integer replaceCnt;

    @Column("replace_end_time")
    @NotBlank(message = "更换结束时间不能为空")
    private String replaceEndTime;

    @Column("sanding_qty")
    private Integer sandingQty;

    @Column("sandpaper_model")
    @NotBlank(message = "砂纸型号不能为空")
    private String sandpaperModel;

    @Column("sandpaper_sn")
    @NotBlank(message = "砂纸序号不能为空")
    private String sandpaperSn;

    @Column("remark")
    private String remark;

}
