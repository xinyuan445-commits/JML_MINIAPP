package com.glenls.jml.busi;

import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.kit.SendWeComMsgKit;
import com.glenls.jml.model.ContactModel;
import com.glenls.jml.model.OpportunityModel;
import com.glenls.jml.model.RelatedCfgModel;
import com.glenls.jml.model.SalesReportModel;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.Db;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;


public class SalesReportBusi {

    @Inject
    private SalesReportModel salesReportModel;
    @Inject
    private RelatedCfgBusi relatedCfgBusi;
    @Inject
    private ContactModel contactDao;

    @Inject
    private OpportunityModel opportunityDao;
    
    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        List<SalesReportModel> reportModelList = salesReportModel.queryPageBy(pageNo,pageSize,paramsMap).getList();
        for(SalesReportModel model:reportModelList){
            model.put("isEdit",JmlKit.checkEdit(paramsMap,model));
        }
        return RestApiResult.newSuccess("获取工作报告分页列表成功",salesReportModel.queryPageBy(pageNo,pageSize,paramsMap));
    }

    
    public RestApiResult queryDetails(Map<String,Object> paramsMap){
        RestApiResult restApiResult = RestApiResult.newSuccess();
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("工作报告Id不能为空");
        }
        Map<String,Object> retMap = new HashMap<>();
        SalesReportModel basicModel = salesReportModel.queryDetails(paramsMap.get("id").toString());
        retMap.put("basic",basicModel);
        
        if(basicModel != null && ObjectUtils.isNotEmpty(paramsMap.get("readFlag"))){
            if(basicModel.get("manager_read").equals(JmlKit.FLAG_0) && basicModel.get("submit_status").equals(JmlKit.FLAG_1)){
                StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
                if(staffPojo.isRoleRM() || staffPojo.isRoleSD()){
                    basicModel.set("manager_read", JmlKit.FLAG_1);
                    basicModel.set("manager_read_time", AppKit.now4DB());
                    basicModel.set("manager_staff_id", paramsMap.get("staffId"));
                    SFKit.updateModelSyncFlag(basicModel);
                    basicModel.update();
                }
            }
        }
        
        retMap.put("isEdit",JmlKit.checkEdit(paramsMap,basicModel));
        
        paramsMap.put("tableName",salesReportModel._getTableName());
        paramsMap.put("id",paramsMap.get("id").toString());
        List<RelatedCfgModel> relatedCfgModelList= relatedCfgBusi.queryRelatedList(paramsMap);
        retMap.put("relatedList",relatedCfgModelList);
        if(ObjectUtils.isNotEmpty(basicModel) && ObjectUtils.isNotEmpty(basicModel.get("account_id"))){
            paramsMap.put("accountId",basicModel.get("account_id"));
            retMap.put("contactList",contactDao.queryListByStaff(paramsMap));
            retMap.put("oppList",opportunityDao.queryListByStaff(paramsMap));
        }
        restApiResult.setData(retMap);
        return restApiResult;
    }

    
    public RestApiResult save(SalesReportModel model,Map<String,Object> paramsMap){
        if(StringUtils.isEmpty(model.get("id"))){
            JmlKit.setSaveModel(model,paramsMap);
            if(!StringUtils.isEmpty(model.get("checkin_address"))){
                model.set("checkin_time",AppKit.now4DB());
            }
            model.set("sync_status",JmlKit.FLAG_0);
            model.save();
            return RestApiResult.newSuccess("新增工作报告成功",model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        model.update();
        return RestApiResult.newSuccess("修改工作报告成功",model.get("id"));
    }

    
    public RestApiResult queryListBy(Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("根据员工获取工作报告列表成功",salesReportModel.queryListBy(paramsMap));
    }

    
    public RestApiResult managerRead(Map<String,Object> paramsMap){
        List<SalesReportModel> listUnReadReports = salesReportModel.queryUnRedListByRM(paramsMap);
        if (listUnReadReports.size() >0) {
            for(SalesReportModel unReadModel : listUnReadReports){
                unReadModel.set("manager_read", JmlKit.FLAG_1);
                unReadModel.set("manager_read_time", AppKit.now4DB());
                unReadModel.set("manager_staff_id", paramsMap.get("staffId"));
                SFKit.updateModelSyncFlag(unReadModel);
            }
            Db.batchUpdate(listUnReadReports, AppKit.BATCH_SIZE);
            return RestApiResult.newSuccess("经理一键阅读成功");
        }
        return RestApiResult.newFail("无对应的阅读数据");
    }

    
    public RestApiResult queryDayListByDate(Map<String,Object> paramsMap) throws ParseException {
        paramsMap.put("lastMonth",JmlKit.getLastMonth(paramsMap.get("date").toString()));
        paramsMap.put("preMonth", JmlKit.getPreMonth(paramsMap.get("date").toString()));
        paramsMap.remove("date");
        Set<Object> resultSet = new HashSet<>();
        resultSet.addAll(salesReportModel.queryDayListByDate(paramsMap));
        return RestApiResult.newSuccess("查询拜访提醒成功",resultSet);
    }

    
    public RestApiResult queryReportNoticeByDay(Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("按天查询拜访提醒成功",salesReportModel.queryReportNoticeByDay(paramsMap));
    }

    
    public RestApiResult queryGmReport(Map<String,Object> paramsMap){

        RestApiResult restApiResult = RestApiResult.newSuccess();
        Map<String,Object> retMap = new HashMap<>();
        List<SalesReportModel> dayList = salesReportModel.queryGmReportDay(paramsMap);
        if(dayList.size()>0){
            retMap.put("dayList",dayList);
            List<Map<String,String >> dayListMap = new ArrayList<>();
            for(SalesReportModel m: dayList){
                Map<String,String> dayMap = new HashMap<>();
                dayMap.put("arrival_time",m.get("field").toString());
                dayMap.put("day",m.get("label").toString());
                dayListMap.add(dayMap);
            }
            paramsMap.put("dayList",dayListMap);
            retMap.put("reportList",salesReportModel.queryGmReportByDay(paramsMap));
        }
        restApiResult.setData(retMap);
        return restApiResult;
    }

    
    public RestApiResult submitReport(Map<String,Object> paramsMap){
        if(ObjectUtils.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("销售报告Id不能为空");
        }

        SalesReportModel reportModel = salesReportModel.findById(paramsMap.get("id"));

        if(ObjectUtils.isEmpty(reportModel)){
            return RestApiResult.newFail("未找到工作报告，无法提交");
        }

        if(!paramsMap.get("staffId").equals(reportModel.get("created_staff_id"))){
            return RestApiResult.newFail("只能提交自己的工作报告");
        }
        reportModel.set("submit_status",JmlKit.FLAG_1);
        SFKit.updateModelSyncFlag(reportModel);
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        Date date = new Date();
        return  reportModel.update() ? RestApiResult.newSuccess("提交成功"):RestApiResult.newFail("提交失败");
    }

    
    public RestApiResult deleteReport(Map<String,Object> paramsMap){
        SalesReportModel reportModel = salesReportModel.findById(paramsMap.get("id"));
        if(!paramsMap.get("staffId").equals(reportModel.get("created_staff_id"))){
            return RestApiResult.newFail("只能删除自己的工作报告");
        }
        return salesReportModel.deleteById(paramsMap.get("id")) ? RestApiResult.newSuccess("删除成功") : RestApiResult.newFail("删除失败");
    }
    
    
    

}
