package com.glenls.jml.pojo.jmlcase;

import lombok.Getter;
import lombok.Setter;

import javax.validation.constraints.NotNull;
import java.math.BigDecimal;


@Setter
@Getter
public class CaseSolutionDetailPojo {

    
    private String id;
    
    private String caseId;
    
    private String orderDetailId;
    
    private Integer returnNum;
    
    private Integer exchangeNum;
    
    private Integer reworkNum;
    
    private BigDecimal discountsAmount;
    
    private BigDecimal claimantAmount;
    
    private String solutionType;
    
    private String undoReason;
    
    private String solutionRole;
    
    private String judge;
    
    private String judgeDesc;
    
    private String problemType;

}
