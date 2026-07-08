package com.glenls.jml.busi.factory;

import cn.hutool.core.util.ObjUtil;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.jml.model.factory.FactoryNoticeModel;
import com.glenls.jml.model.factory.JobAssignmentModel;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.aop.Inject;

import java.text.ParseException;
import java.util.*;


public class FactoryNoticeBusi {

    @Inject
    private FactoryNoticeModel factoryNoticeDao;

    @Inject
    private JobAssignmentModel jobAssignmentDao;
    private static final String NOTICE_JOB_ASSIGNMENT = "jobAssignment";
    private static final String NOTICE_DEVICE_REPAIR = "deviceRepair";
    private static final String NOTICE_PARTS_PURCHASE = "partsPurchase";



    public RestApiResult queryFactoryNotice(Map<String,Object> paramsMap) throws ParseException {
        if(ObjUtil.isEmpty(paramsMap.get("date"))) {
            return RestApiResult.newFail("日期不能为空");
        }
        paramsMap.put("lastMonth", JmlKit.getLastMonth(paramsMap.get("date").toString()));
        paramsMap.put("preMonth", JmlKit.getPreMonth(paramsMap.get("date").toString()));
        paramsMap.remove("date");
        Set<Object> resultSet = new HashSet<>();
        resultSet.addAll(jobAssignmentDao.getNoticeDay(paramsMap));
        return RestApiResult.newSuccess("获取日历提醒成功",resultSet);
    }



    public RestApiResult queryNoticeInfoByDay2(Map<String, Object> paramsMap){
        if (paramsMap == null || ObjUtil.isEmpty(paramsMap.get("day"))) {
            return RestApiResult.newFail("日期不能为空");
        }
        Map<String,Object> retMap = new HashMap<>();
        if(jobAssignmentDao.queryJobANoticeByDay(paramsMap).size()>0){
            retMap.put("typeName", "岗位分工");
            retMap.put("type", "jobAssignment");
            retMap.put("listJobAssignment", jobAssignmentDao.queryJobANoticeByDay(paramsMap));
        }



        return RestApiResult.newSuccess("获取日历提醒成功", retMap);
    }


    public RestApiResult queryNoticeInfoByDB(Map<String, Object> paramsMap){
        Map<String,Object> retMap = new HashMap<>();

        if(jobAssignmentDao.queryPartsPNoticeByStaffId(paramsMap).size()>0){
            retMap.put("listPartsPurchase", jobAssignmentDao.queryPartsPNoticeByStaffId(paramsMap));
        }

        if(jobAssignmentDao.queryInspectionNoticeByStaffId(paramsMap).size()>0){
            retMap.put("listDailyInspectionReport", jobAssignmentDao.queryInspectionNoticeByStaffId(paramsMap));
        }
        return RestApiResult.newSuccess("获取代办成功", retMap);
    }






}
