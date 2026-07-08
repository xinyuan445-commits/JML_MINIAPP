package com.glenls.jml.pojo.jmlcase;

import lombok.Getter;
import lombok.Setter;

import javax.validation.constraints.NotNull;
import java.util.Date;


@Setter
@Getter
public class CaseQaOpinionPojo {

    
    private String id;
    
    private String caseId;
    
    private String causeAnalysis;
    
    private String correctiveAction;
    
    private String preventiveMeasure;
    
    private String submitStatus;

    
    private Date expectedCompletionDate ;

}
