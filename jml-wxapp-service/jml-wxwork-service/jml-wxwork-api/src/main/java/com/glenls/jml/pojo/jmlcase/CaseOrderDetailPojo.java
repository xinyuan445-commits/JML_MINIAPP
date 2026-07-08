package com.glenls.jml.pojo.jmlcase;

import lombok.Getter;
import lombok.Setter;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.Date;


@Setter
@Getter
public class CaseOrderDetailPojo {
    
    private String id;
    
    private String caseClass;
    
    private String orderNo;
    
    private Date buyDate;
    
    private String deliveryWarehouse;
    
    private String productName;
    
    private String spec;
    
    private int buyQty;
    
    private BigDecimal unitPrice;
    
    private BigDecimal totalPrice;
    
    private int badQty;
    
    private String badRemark;
    
    private String demands;
    
    @NotNull(message = "现场照片不能为空")
    private String onSiteImg1;
    
    @NotNull(message = "侧边喷码（批号）不能为空")
    private String noImg1;
    
    @NotNull(message = "损坏的具体照片不能为空")
    private String breakImg1;
    
    private String otherImg1;
    
    private String otherImg2;
    
    private String otherImg3;


    private String inventoryCode;

    
    @NotNull(message = "销售描述不能为空")
    private String salesDesc;
    @NotNull(message = "侧边喷码不能为空")
    private String sideCode;

}
