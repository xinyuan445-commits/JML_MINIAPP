package com.glenls.jml.modules.privilege.pojo;

import com.glenls.api.modules.jml.model.StaffAreaModel;
import com.glenls.api.modules.jml.model.StaffModel;
import com.glenls.api.modules.pub.model.FactoryStaffRoleModel;
import com.glenls.jml.modules.privilege.model.StaffRegionModel;
import com.glenls.jml.modules.privilege.model.StaffRoleModel;
import lombok.Data;

import java.io.Serializable;
import java.util.List;


@Data
public class StaffPojo implements Serializable {

    
    private String staffId;

    
    private String staffCode;

    
    private String staffName;

    
    private String deptId;

    
    private StaffModel staffObj;
    
    private String factoryCode;

    
    private List<StaffRoleModel> roleList;

    
    private List<StaffRegionModel> regionList;

    private List<StaffAreaModel> areaList;


    private List<FactoryStaffRoleModel> factoryRoleList;



    
    private boolean roleGM;

    
    private boolean roleSD;

    
    private boolean roleRM;

    
    private boolean roleSR;

    
    private boolean roleAfterSalesM;
    
    private boolean roleQA;

    
    private boolean roleSA;

    
    private String isAdmin;

    
    private boolean roleHRD;

    
    private String isReset;

    
    private String status;

    
    private boolean factRoleGM;

    
    private boolean factRoleSE;

    
    private boolean factRoleGMS;
    
    private String factoryMRole;
    
    private String prodLineOrDept;
    
    private String jobType;

}
