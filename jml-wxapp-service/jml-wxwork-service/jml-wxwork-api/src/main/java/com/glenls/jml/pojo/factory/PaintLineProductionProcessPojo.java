package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;


@Data
public class PaintLineProductionProcessPojo {
    @Column("id")
    private String id;  


    @Column("prod_order_no")
    @NotBlank(message = "生产工单号不能为空")
    private String prodOrderNo;  

    @Column("model")
    @NotBlank(message = "型号不能为空")
    private String model;  

    @Column("material_temp")
    @NotNull(message = "温度不能为空")
    private Integer materialTemp;  

    @Column("line_speed")
    @NotNull(message = "线速不能为空")
    private Integer lineSpeed;  

    @Column("base_coat_curing")
    @NotNull(message = "附着底涂固化不能为空")
    private Integer baseCoatCuring;  

    @Column("base_coat_amount_8022_uv_special")
    @NotNull(message = "附着底涂布量H-8022(JML) UV辊涂附着底漆不能为空")
    private Integer baseCoatAmount8022UvSpecial;  

    @Column("base_coat_uv_energy")
    @NotNull(message = "附着底涂UV能量不能为空")
    private Integer baseCoatUvEnergy;  

    @Column("sand_base_coat_amount_8123_uv")
    @NotNull(message = "砂光底涂量_H-8123(JML) UV辊涂附着底漆不能为空")
    private Integer sandBaseCoatAmount8123Uv;  

    @Column("sand_base_coat_uv_energy")
    @NotNull(message = "砂光底涂UV能量不能为空")
    private Integer sandBaseCoatUvEnergy;  

    @Column("top_coat_amount_8215_uv_clear")
    @NotNull(message = "面漆涂布量H-82519(JML) UV镭射肤感清面漆不能为空")
    private Integer topCoatAmount8215UvClear;  

    @Column("top_coat_precure_energy")
    @NotNull(message = "面漆预固化能量(单镓)不能为空")
    private Integer topCoatPrecureEnergy;  

    @Column("air_pressure_content")
    @NotNull(message = "氮气固化含氧量不能为空")
    private Integer airPressureContent;  

    @Column("monomer_lamp_energy")
    @NotNull(message = "准分子灯能量不能为空")
    private Integer monomerLampEnergy;  

    @Column("top_coat_national_energy_dual_s")
    @NotNull(message = "面漆全国能量(双汞+单镓)不能为空")
    private Integer topCoatNationalEnergyDualS;  

    @Column("remark")
    private String remark;  


}
