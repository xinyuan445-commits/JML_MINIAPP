package com.glenls.jml.pojo;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.Date;


@Setter
@Getter
public class ReimbursementDetailInPojo implements Serializable {

    private String id;
    
    private String item;
    
    private double amount;
    
    private String contactId;
    
    private String remark;
    
    private String invites;
    
    private String img1;
    
    private String img2;
    
    private double tax;
    
    private double untaxed_amount;
    
    private String category;
    
    private Date occur_date;



}
