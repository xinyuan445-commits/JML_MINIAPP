package com.glenls.jml.busi.factory;

import cn.hutool.core.date.DateUnit;
import cn.hutool.core.date.DateUtil;
import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.ObjUtil;
import cn.hutool.core.util.StrUtil;
import com.alibaba.nacos.client.naming.utils.CollectionUtils;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.constant.factory.JobAssigmentBtnEnum;
import com.glenls.jml.constant.factory.JobAssignCompletionStatusEnum;
import com.glenls.jml.constant.factory.JobAssignStatusEnum;
import com.glenls.jml.kit.BeanModelKit;
import com.glenls.jml.kit.GeneratorSerNoKit;
import com.glenls.jml.kit.WeekDayKit;
import com.glenls.jml.model.factory.JobAssignmentModel;
import com.glenls.jml.model.factory.JobAssignmentStaffModel;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.jml.pojo.factory.JobAssignmentPojo;
import com.glenls.jml.pojo.factory.JobAssignmentStaffPojo;
import com.glenls.jml.pojo.factory.PublicBtnPojo;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.Page;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


public class JobAssignmentBusi {
    @Inject
    private JobAssignmentModel jobAssignmentDao;
    @Inject
    private JobAssignmentStaffModel jobAssignmentStaffDao;

    @Inject
    private GeneratorSerNoKit generatorSerNoKit;

    @Inject
    private WeekDayKit weekDayKit;

    private static String NAME_PREFIX = "GWFG";

    private static String G_PREFIX = "G";

    private static String CW_PREFIX = "CW";
    private static String CX_PREFIX = "CX";

    private static String CW_ROLE = "CH,CXZ";

    private static String UN_PRODUCTION_TYPE = "非生产任务";

    private static String SC = "生产线";
    private static String FZ = "辅助部门";


    @Inject
    FactoryTmpMsgBusi  factoryTmpMsgBusi;

    private static String OBJ_CODE = "GWFG";

    private static String OBJ_NAME = "岗位分工";

    private static String OBJ_PATH = "factory/pages/jobAssignment/Detailed?id=";

    private ThreadPoolExecutor sendFacTmplMsg = ThreadUtil.newExecutor(2, 50);



    public RestApiResult save(JobAssignmentPojo pojo, Map<String,Object> paramsMap){
        JobAssignmentModel model = BeanModelKit.printProperties(pojo,JobAssignmentModel.class,true);
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");

        if(ObjUtil.isEmpty(pojo.getAssignmentStaffPojoList())){
            model.set("job_assign_status", JobAssignStatusEnum.NEW.getDesc());
            model.set("sync_status", JmlKit.FLAG_0);
        }else {
            model.set("job_assign_status", JobAssignStatusEnum.YFP.getDesc());
            model.set("completion_status", JobAssignCompletionStatusEnum.WWC.getDesc());
        }
        if(StrUtil.isNotEmpty(pojo.getTaskDate())){
            String dateStr = pojo.getTaskDate();
            model.set("weekday", weekDayKit.getWeekDay(dateStr));
        }

        if(pojo.getJobType().equals(SC) && !pojo.getAssignType().equals(UN_PRODUCTION_TYPE) && ObjUtil.isEmpty(pojo.getExpectedQty())){
                return RestApiResult.newFail("应完成数量不能为空");
        }
        if(pojo.getJobType().equals(FZ) && !pojo.getAssignType().equals(UN_PRODUCTION_TYPE) && ObjUtil.isEmpty(pojo.getExpectedWorkHours())){
            return RestApiResult.newFail("应完成工作时长不能为空");
        }

        if(!pojo.getAssignType().equals(UN_PRODUCTION_TYPE) && !CW_ROLE.contains(staffPojo.getFactoryMRole()) && StrUtil.isEmpty(pojo.getWorkNo())){
            return RestApiResult.newFail("工单号不能为空");
        }

        if(StrUtil.isEmpty(pojo.getTaskDate())){
            return RestApiResult.newFail("任务日期不能为空");
        }
        if(StringUtils.isEmpty(model.get("id"))){
            model.set("name",generatorSerNoKit.generateFactorySN(model._getTableName(),NAME_PREFIX));
            model.set("notice_no",generatorSerNoKit.generateFactorySN2(model._getTableName()+G_PREFIX,G_PREFIX));


            if(pojo.getAssignType().equals(UN_PRODUCTION_TYPE)){
                model.set("work_no",generatorSerNoKit.generateFactorySN3(model._getTableName()+CX_PREFIX,CX_PREFIX));
            }

            if(CW_ROLE.contains(staffPojo.getFactoryMRole()) && !pojo.getAssignType().equals(UN_PRODUCTION_TYPE)){
                model.set("work_no",generatorSerNoKit.generateFactorySN3(model._getTableName()+CW_PREFIX,CW_PREFIX));
            }
            JmlKit.setSaveModel(model,paramsMap);
            JmlKit.setFJobTypeAndProdLineOrDept(model,paramsMap);
            model.save();
            saveStaffModels(pojo.getAssignmentStaffPojoList(), model.get("id"), paramsMap);
            List<String> assignIds = new ArrayList<String>();
            paramsMap.put("factoryType", OBJ_NAME);
            paramsMap.put("pagePath", OBJ_PATH+model.get("id"));
            paramsMap.put("name", model.get("name"));
            paramsMap.put("createName",staffPojo.getStaffName());
            if(pojo.getAssignmentStaffPojoList().size()>0){
                for (JobAssignmentStaffPojo assignmentStaffPojo : pojo.getAssignmentStaffPojoList()){
                    assignIds.add(assignmentStaffPojo.getAssignedEngineerStaffId());
                }
            }
            paramsMap.put("assignIds", assignIds);
            sendFacTmplMsg.execute(() -> factoryTmpMsgBusi.sendATmplMsg(paramsMap));
            return RestApiResult.newSuccess("新增岗位分工成功",model.get("id"));
        }
        saveStaffModels(pojo.getAssignmentStaffPojoList(), model.get("id"), paramsMap);
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改岗位分工成功成功",model.get("id"));
    }


    private void saveStaffModels(List<JobAssignmentStaffPojo> staffList, String jobId, Map<String,Object> paramsMap) {
        if (CollectionUtils.isEmpty(staffList)) return;
        for (JobAssignmentStaffPojo staffPojo : staffList) {
            JobAssignmentStaffModel staffModel = BeanModelKit.printProperties(staffPojo, JobAssignmentStaffModel.class, true);
            staffModel.set("job_assignment_id", jobId);
            staffModel.set("completion_status", JobAssignCompletionStatusEnum.WWC.getDesc());
            if(ObjectUtils.isEmpty(jobAssignmentStaffDao.findById(staffPojo.getId()))){
                JmlKit.setSaveModel(staffModel, paramsMap);
                staffModel.save();
            }else {
                SFKit.updateModelSyncFlag(staffModel);
                staffModel.update();
            }
        }
    }


    public RestApiResult queryDetails(Map<String,Object> paramsMap) {
        if(StringUtils.isEmpty(paramsMap.get("id").toString())){
            return RestApiResult.newFail("岗位分工Id不能为空");
        }
        JobAssignmentModel model = jobAssignmentDao.queryDetails(paramsMap.get("id").toString());
        if(ObjUtil.isEmpty(model)){
            return  RestApiResult.newFail("岗位分工不存在");
        }
        List<PublicBtnPojo> btnList = new ArrayList<>();
        List<JobAssignmentStaffModel> assignmentStaffModelList = jobAssignmentStaffDao.queryAssignStaffList(paramsMap.get("id").toString());
        model.put("assignStaffList",assignmentStaffModelList);
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");

        if(!UN_PRODUCTION_TYPE.equals(model.get("assignType"))){
            if(model.get("jobType").equals(SC)){

                model.put("completedWorkQty",jobAssignmentStaffDao.sumCompletedWorkQty(model.get("id")));

                if (model.get("expectedQty") != null) {
                    model.put("remainingWorkQty", Math.max((Integer) model.get("expectedQty") - jobAssignmentStaffDao.sumCompletedWorkQty(model.get("id")), 0));
                }
            }
            if(model.get("jobType").equals(FZ)){

                model.put("completedWorkHours",jobAssignmentStaffDao.sumCompletedWorkHours(model.get("id")));

                if(model.get("expectedWorkHours") != null){
                    model.put("remainingWorkHours", Math.max((Integer) model.get("expectedWorkHours") - jobAssignmentStaffDao.sumCompletedWorkHours(model.get("id")), 0));
                }
            }
        }


        if(model.get("createdStaffId").equals(staffPojo.getStaffId())  && model.get("jobAssignStatus").equals(JobAssignStatusEnum.NEW.getDesc())){
            addButton(btnList, JobAssigmentBtnEnum.BTN_SAVE);
        }

        assignmentStaffModelList.forEach(assignStaff -> {

            if (assignStaff.get("assignedStaffId").equals(staffPojo.getStaffId()) && assignStaff.get("completionStatus").equals(JobAssignCompletionStatusEnum.WWC.getDesc())) {
                assignStaff.put("completeBtn", 1);
            }

            if (model.get("createdStaffId").equals(staffPojo.getStaffId()) && assignStaff.get("completionStatus").equals(JobAssignCompletionStatusEnum.YWC.getDesc())) {
                assignStaff.put("completeBtn", 2);
            }
        });
        if(btnList.size() > 0){
            model.put("btnList",btnList);
        }
        return RestApiResult.newSuccess("获取岗位分工详情成功",model);
    }

    public static void addButton(List<PublicBtnPojo> btnList, JobAssigmentBtnEnum btn) {
        PublicBtnPojo btnPojo = new PublicBtnPojo();
        btnPojo.setBtnCode(btn.getCode());
        btnPojo.setBtnName(btn.getDesc());
        btnPojo.setBtnValue(btn.getValue());
        btnList.add(btnPojo);
    }


    public RestApiResult queryPageBy(int pageNo, int pageSize,Map<String,Object> paramsMap){
        Page<JobAssignmentModel> jobAssignPage = jobAssignmentDao.queryPageBy(pageNo,pageSize,paramsMap);
        List<JobAssignmentModel> jobAssignList = jobAssignPage.getList();
        for(JobAssignmentModel model : jobAssignList){
            if(ObjUtil.isNotEmpty(jobAssignmentStaffDao.queryAssignStaffList(model.get("id").toString()))){
                List<JobAssignmentStaffModel> assignmentStaffModelList = jobAssignmentStaffDao.queryAssignStaffList(model.get("id").toString());
                model.put("assignStaffList",assignmentStaffModelList);
            }
        }
        return RestApiResult.newSuccess("查询岗位分工成功",jobAssignPage);
    }

    public RestApiResult complete(JobAssignmentStaffPojo pojo, Map<String,Object> paramsMap) {
        JobAssignmentModel jobAssignModel = jobAssignmentDao.queryDetails(pojo.getJobAssignmentId());
        if(StrUtil.isEmpty(pojo.getCompletionStatus())){
            return RestApiResult.newFail("完成状态不能为空");
        }
        if(StrUtil.isEmpty(pojo.getStartTime())){
            return RestApiResult.newFail("开始时间不能为空");
        }
        if(StrUtil.isEmpty(pojo.getEndTime())){
            return RestApiResult.newFail("结束时间不能为空");
        }
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        if(staffPojo.getJobType().equals(SC) && ObjUtil.isEmpty(pojo.getWorkQty()) && !UN_PRODUCTION_TYPE.equals(jobAssignModel.get("assignType"))){
            return RestApiResult.newFail("工作数量不能为空");
        }

        if(StrUtil.isEmpty(pojo.getWorkContent()) && !UN_PRODUCTION_TYPE.equals(jobAssignModel.get("assignType"))){
            return RestApiResult.newFail("工作内容不能为空");
        }
        JobAssignmentStaffModel model = BeanModelKit.printProperties(pojo,JobAssignmentStaffModel.class,true);

        LocalTime start = LocalTime.parse(pojo.getStartTime());
        LocalTime end = LocalTime.parse(pojo.getEndTime());
        boolean allowCrossMidnight = false;
        if(!allowCrossMidnight && end.isBefore(start)) {
            return RestApiResult.newFail("开始时间不能大于结束时间，或者时间跨午夜");
        }
        long minutes = DateUtil.between(
                DateUtil.parseTimeToday(pojo.getStartTime()),
                DateUtil.parseTimeToday(pojo.getEndTime()),
                DateUnit.MINUTE
        );
        long hours = minutes / 60;
        long remainingMinutes = minutes % 60;
        String formatted = String.format("%d小时%d分钟", hours, remainingMinutes);
        model.set("work_hours",formatted);
        model.set("actual_work_hours",formatted);
        model.set("completion_time", AppKit.now4DB());
        SFKit.updateModelSyncFlag(model);
        model.update();
        if(pojo.getCompletionStatus().equals(JobAssignCompletionStatusEnum.YWC.getDesc())){
            paramsMap.put("pagePath", OBJ_PATH+jobAssignModel.get("id"));
            paramsMap.put("name", jobAssignModel.get("name"));
            paramsMap.put("sendStaffName",jobAssignModel.get("createdStaffName"));
            paramsMap.put("sendStaffId",jobAssignModel.get("createdStaffId"));
            paramsMap.put("status",JobAssignStatusEnum.YGWC.getDesc());
            paramsMap.put("factoryType",OBJ_NAME);
            sendFacTmplMsg.execute(() -> factoryTmpMsgBusi.sendBTmplMsg(paramsMap));
        }

        if(jobAssignmentStaffDao.checkStaffComplete(pojo.getJobAssignmentId()) ==0){
            jobAssignModel.set("job_assign_status", JobAssignStatusEnum.YGWC.getDesc());
            jobAssignModel.set("completion_status", JobAssignCompletionStatusEnum.YWC.getDesc());
            jobAssignModel.set("completion_time", AppKit.now4DB());
            jobAssignModel.set("update_staff_id",paramsMap.get("staffId"));
            jobAssignModel.set("completion_staff_id",paramsMap.get("staffId"));
            SFKit.updateModelSyncFlag(jobAssignModel);
            jobAssignModel.update();
        }
        return RestApiResult.newSuccess("岗位分工完成成功");
    }


    public RestApiResult confirm(JobAssignmentStaffPojo pojo, Map<String,Object> paramsMap) {
        JobAssignmentStaffModel model = BeanModelKit.printProperties(pojo, JobAssignmentStaffModel.class, true);
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        JobAssignmentModel jobAssignModel = jobAssignmentDao.findById(pojo.getJobAssignmentId());
        if(staffPojo.getJobType().equals(SC) && ObjUtil.isEmpty(pojo.getActualCompletedQty())&& !UN_PRODUCTION_TYPE.equals(jobAssignModel.get("assignType"))){
            return RestApiResult.newFail("实际完成数量不能为空");
        }
        if(staffPojo.getJobType().equals(FZ) && ObjUtil.isEmpty(pojo.getActualWorkHours()) && !UN_PRODUCTION_TYPE.equals(jobAssignModel.get("assignType"))){
            return RestApiResult.newFail("实际工作时长不能为空");
        }
        model.set("confirmation_time", AppKit.now4DB());
        model.set("update_staff_id", paramsMap.get("staffId"));
        model.set("completion_status", JobAssignCompletionStatusEnum.YQR.getDesc());
        model.set("confirmation_staff_id", paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        if(jobAssignmentStaffDao.checkStaffConfirm(pojo.getJobAssignmentId()) == 0){
            jobAssignModel.set("job_assign_status", JobAssignStatusEnum.ZGQR.getDesc());
            jobAssignModel.set("gm_confirm", JmlKit.FLAG_1);
            jobAssignModel.set("confirmation_time", AppKit.now4DB());
            jobAssignModel.set("confirmation_staff_id", paramsMap.get("staffId"));
            SFKit.updateModelSyncFlag(jobAssignModel);
            jobAssignModel.update();
        }
        return RestApiResult.newSuccess("确认工作完成");
    }





    public RestApiResult deleteById(Map<String,Object> paramsMap){
        JobAssignmentModel model = jobAssignmentDao.findById(paramsMap.get("id"));
        if(model==null){
            return RestApiResult.newFail("岗位分工不存在");
        }
        if(!model.get("job_assign_status").equals(JobAssignStatusEnum.NEW.getDesc())){
            return RestApiResult.newFail("只能删除状态为新建的岗位分工");
        }
        if(!paramsMap.get("staffId").equals(model.get("created_staff_id"))){
            return RestApiResult.newFail("只能删除自己的岗位分工");
        }
        model.delete();
        return RestApiResult.newSuccess("删除岗位分工成功");
        }

    public static void main(String[] args) {
        String startStr="18:00";
        String endStr="13:00";
        LocalTime start = LocalTime.parse(startStr);
        LocalTime end = LocalTime.parse(endStr);
        boolean allowCrossMidnight = false;
        if(!allowCrossMidnight && end.isBefore(start)) {
            System.out.println("开始时间不能大于结束时间，或者时间跨午夜");
        }

        long minutes = DateUtil.between(
                DateUtil.parseTimeToday(startStr),
                DateUtil.parseTimeToday(endStr),
                DateUnit.MINUTE
        );
        long hours = minutes / 60;
        long remainingMinutes = minutes % 60;

        System.out.printf("时间差: %d小时%d分钟%n", hours, remainingMinutes);
        String formatted = String.format("%d小时%d分钟", hours, remainingMinutes);
        System.out.println(formatted);
        System.out.println(hours+"-----------------");

    }
}
