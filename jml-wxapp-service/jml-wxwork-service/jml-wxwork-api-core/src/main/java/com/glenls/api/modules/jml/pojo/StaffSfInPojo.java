package com.glenls.api.modules.jml.pojo;

import lombok.Getter;
import lombok.Setter;

import javax.validation.constraints.NotNull;
import java.util.List;


@Setter
@Getter
public class StaffSfInPojo {


    private String id;


    private String name;


    private String areaCode;


    private String regionCode;


    private String parentId;


    private String employeeId;


    private String status;


    private String email;


    @NotNull(message ="手机号码不能为空")
    private String mobile;


    private String gender;


    private Long[] department;


    private String position;


    private String entryDate;


    private String leavingDate;


    private String factoryCode;


    private String isAdmin;


    private String staffType;

    private String factoryMRole;


    public List<StaffRoleSfInPojo> roleList;


    public List<StaffRegionSfInPojo> regionList;


    public List<StaffAreaSfInPojo> areaList;




    public List<StaffFactoryRole> factoryRoleList;

}
