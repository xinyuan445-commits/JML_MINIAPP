package com.glenls.jml.modules.privilege.kit;

import cn.hutool.core.util.ObjUtil;
import com.glenls.api.modules.jml.model.StaffAreaModel;
import com.glenls.api.modules.jml.model.StaffModel;
import com.glenls.api.modules.pub.model.FactoryStaffRoleModel;
import com.glenls.jml.modules.privilege.model.StaffRegionModel;
import com.glenls.jml.modules.privilege.model.StaffRoleModel;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.jfinal.aop.Aop;
import io.jboot.Jboot;
import io.jboot.support.redis.JbootRedis;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.List;


public class RoleKit {

    public static final String ROLE_GM = "GM";

    public static final String ROLE_SD = "SD";

    public static final String ROLE_RM = "RM";

    public static final String ROLE_SR = "SR";

    public static final String ROLE_AfterSalesM = "AfterSalesM";


    public static final String ROLE_QA = "QA";

    public static final String ROLE_SA = "SA";


    public static final String ROLE_HRD = "HRD";


    public static final String FACT_ROLE_GM = "FACTGM";

    public static final String FACT_ROLE_GMS = "FACTGMS";

    public static final String FACT_ROLE_SE = "FACTSE";



    private static   StaffAreaModel staffAreaDao = Aop.get(StaffAreaModel.class);

    private static StaffModel staffDao = Aop.get(StaffModel.class);

    private static StaffRegionModel staffRegionDao = Aop.get(StaffRegionModel.class);

    private static StaffRoleModel staffRoleDao = Aop.get(StaffRoleModel.class);

    private static FactoryStaffRoleModel factoryStaffDao = Aop.get(FactoryStaffRoleModel.class);


    private static final Integer STAFF_CACHE_TIMEOUT = 300;


    private static final String STAFF_CACHE_KEY = "staff:";


    public static final boolean isTargetRole(String targetRole, List<StaffRoleModel> list){
        if(StringUtils.isEmpty(targetRole) || CollectionUtils.isEmpty(list)){
            return false;
        }

        for(StaffRoleModel model : list){
            String sourceRole = model.get("role_code");
            if(StringUtils.equals(sourceRole,targetRole)){
                return true;
            }
        }
        return false;
    }


    public static final StaffPojo initStaffInfo(String staffId){
        String caheKey = new StringBuffer(STAFF_CACHE_KEY).append(staffId).toString();
        JbootRedis redis = Jboot.getRedis();
        StaffPojo pojo = redis != null ? redis.get(caheKey) : null;
        if(pojo != null){
            return pojo;
        }
        StaffModel staffModel = staffDao.queryById(staffId);
        if(staffModel == null){
            return null;
        }
        pojo = new StaffPojo();
        pojo.setStaffId(staffId);
        pojo.setStaffCode(staffModel.get("employ_id"));
        pojo.setStaffName(staffModel.get("name"));
        pojo.setDeptId(staffModel.get("department"));
        pojo.setFactoryCode(staffModel.get("factory_code"));
        pojo.setIsAdmin(staffModel.get("is_admin"));
        pojo.setIsReset(staffModel.get("is_reset"));
        pojo.setStatus(staffModel.get("status"));
        pojo.setStaffObj(staffModel);
        List<StaffRoleModel> staffRoleList = staffRoleDao.queryByStaffId(staffId);
        List<StaffAreaModel> staffAreaList = staffAreaDao.queryByStaffId(staffId);

        if(ObjUtil.isNotEmpty(staffModel.get("factory_m_role"))){
            pojo.setFactoryMRole(staffModel.get("factory_m_role"));
            FactoryStaffRoleModel prodLineOrDeptAndJobTypeModel = factoryStaffDao.queryProdLineOrDeptAndJobType(staffId, staffModel.get("factory_m_role"));
            List<FactoryStaffRoleModel> factoryRoleList = factoryStaffDao.queryByStaffId(staffId);
            pojo.setFactoryRoleList(factoryRoleList);
            pojo.setProdLineOrDept(prodLineOrDeptAndJobTypeModel.get("prodLineOrDept"));
            pojo.setJobType(prodLineOrDeptAndJobTypeModel.get("jobType"));
            pojo.setFactRoleGM(RoleKit.isTargetFactRole(FACT_ROLE_GM,factoryRoleList));
            pojo.setFactRoleSE(RoleKit.isTargetFactRole(FACT_ROLE_SE,factoryRoleList));
            pojo.setFactRoleGMS(RoleKit.isTargetFactRole(FACT_ROLE_GMS,factoryRoleList));
        }


        pojo.setRoleList(staffRoleList);
        pojo.setRoleGM(RoleKit.isTargetRole(ROLE_GM,staffRoleList));
        pojo.setRoleSD(RoleKit.isTargetRole(ROLE_SD,staffRoleList));
        pojo.setRoleRM(RoleKit.isTargetRole(ROLE_RM,staffRoleList));
        pojo.setRoleSR(RoleKit.isTargetRole(ROLE_SR,staffRoleList));
        pojo.setRoleQA(RoleKit.isTargetRole(ROLE_QA,staffRoleList));
        pojo.setRoleSA(RoleKit.isTargetRole(ROLE_SA,staffRoleList));
        pojo.setRoleHRD(RoleKit.isTargetRole(ROLE_HRD,staffRoleList));
        pojo.setRoleAfterSalesM(RoleKit.isTargetRole(ROLE_AfterSalesM,staffRoleList));



        pojo.setAreaList(staffAreaList);

        Jboot.getRedis().setex(caheKey,STAFF_CACHE_TIMEOUT,pojo);

        return pojo;
    }



    public static final boolean isTargetFactRole(String targetRole, List<FactoryStaffRoleModel> list){
        if(StringUtils.isEmpty(targetRole) || CollectionUtils.isEmpty(list)){
            return false;
        }

        for(FactoryStaffRoleModel model : list){
            String sourceRole = model.get("roleType");
            if(StringUtils.equals(sourceRole,targetRole)){
                return true;
            }
        }
        return false;
    }
}
