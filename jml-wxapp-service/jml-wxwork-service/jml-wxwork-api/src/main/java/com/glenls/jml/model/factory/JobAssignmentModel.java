package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.List;
import java.util.Map;


@Table(tableName = "jml_job_assignment",primaryKey = "id")
public class JobAssignmentModel  extends DbXmlModel4Jboot<JobAssignmentModel> implements IBean {


    public Page<JobAssignmentModel> queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "jobAssignment.queryPageBy",paramsMap);
    }


    public JobAssignmentModel queryDetails(String id) {
        Map<String, Object> paramsMap = new java.util.HashMap<>();
        paramsMap.put("id", id);
        return findFirstForXml("jobAssignment.queryDetails", paramsMap);
    }

    public List<JobAssignmentModel> getNoticeDay(Map<String,Object> paramsMap ) {
        return findForXml("factoryNotice.queryNoticeDay",paramsMap);
    }


    public List<JobAssignmentModel> queryJobANoticeByDay(Map<String,Object> paramsMap ) {
        return findForXml("factoryNotice.queryJobANoticeByDay", paramsMap);
    }


    public List<JobAssignmentModel> queryPartsPNoticeByStaffId(Map<String,Object> paramsMap){
        return findForXml("factoryNotice.queryPartsPNoticeByStaffId", paramsMap);
    }


    public List<JobAssignmentModel> queryInspectionNoticeByStaffId(Map<String,Object> paramsMap){
        return findForXml("factoryNotice.queryInspectionNoticeByStaffId", paramsMap);
    }

}
