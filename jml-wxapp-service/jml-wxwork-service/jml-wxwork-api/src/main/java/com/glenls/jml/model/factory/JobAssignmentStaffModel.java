package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_job_assignment_staff",primaryKey = "id")
public class JobAssignmentStaffModel extends DbXmlModel4Jboot<JobAssignmentStaffModel> implements IBean {


    public List<JobAssignmentStaffModel> queryAssignStaffList(String jobAssignmentId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("jobAssignmentId",jobAssignmentId);
        return findForXml("jobAssignmentStaff.queryAssignStaffList",paramsMap);
    }


    public int checkStaffComplete(String jobAssignmentId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("jobAssignmentId",jobAssignmentId);
        return findFirstForXml("jobAssignmentStaff.cntUnCompletion", paramsMap).getLong("cnt").intValue();
    }


    public int sumCompletedWorkQty(String jobAssignmentId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("jobAssignmentId",jobAssignmentId);
        return findFirstForXml("jobAssignmentStaff.sumCompletedWorkQty", paramsMap).getLong("sumQty").intValue();
    }


    public int sumCompletedWorkHours(String jobAssignmentId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("jobAssignmentId",jobAssignmentId);
        return findFirstForXml("jobAssignmentStaff.sumCompletedWorkHours", paramsMap).getLong("sumHours").intValue();
    }


    public int checkStaffConfirm(String jobAssignmentId){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("jobAssignmentId",jobAssignmentId);
        return findFirstForXml("jobAssignmentStaff.cntUnConfirmation", paramsMap).getLong("cnt").intValue();
    }
}
