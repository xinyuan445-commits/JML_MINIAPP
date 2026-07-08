package com.glenls.jml.pojo.jmlcase;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.io.Serializable;
import java.util.List;


@Data
public class CasePojo implements Serializable {

    
    private String id;
    
    private String caseStageCode;

    
    @NotBlank(message = "公司不能为空")
    private String accountId;

    
    @NotBlank(message = "联系人不能为空")
    private String contactName;

    
    @NotBlank(message = "联系电话不能为空")
    private String contactPhone;

    
    private String serviceType;

    
    private String feedbackPersonType;

    
    private String feedbackType;

    
    private String feedbackClass;

    
    private String sheetStatus;

    
    private String createRemark;

    
    private String feedbackImg1;

    
    private String feedbackImg2;

    
    private String feedbackImg3;

    
    private String feedbackRemark;

    
    private String factoryCode;

    
    private String approvalStatus;

    
    private String approvalRemark;

    
    private String closeReason;

    
    @NotNull(message = "销售人员不能为空")
    private String salesStaffId;

    
    private String qaNeed;

    
    private String attachment;

    
    private String attachmentName;
    
    private String areaCode;
    
    private String district;
    
    private String onsiteInspection;
    
    private String contactId;

    
    private String replenishInvoiceNo;

    
    private List<CaseOrderDetailPojo> detailList;

    private List<CaseSolutionDetailPojo> solutionList;



}
