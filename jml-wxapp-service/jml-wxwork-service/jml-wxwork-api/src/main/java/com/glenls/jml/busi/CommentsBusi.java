package com.glenls.jml.busi;

import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.StrUtil;
import com.glenls.api.modules.jml.model.StaffModel;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.jml.kit.GenerateNameImgKit;
import com.glenls.jml.kit.SendWeComMsgKit;
import com.glenls.jml.model.CommentsModel;
import com.glenls.jml.model.MentionedUsersModel;
import com.glenls.jml.model.SalesReportModel;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.Db;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.Jboot;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


public class CommentsBusi {

    @Inject
    private CommentsModel commentsDao;
    @Inject
    private StaffModel staffDao;
    @Inject
    private SalesReportModel salesReportDao;
    private ThreadPoolExecutor sendWeComMsgThread = ThreadUtil.newExecutor(2,5);


    private  final String nameImgPath = Jboot.configValue("baseline.upload.url")+"upload/nameimg/";

    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap) {
        Page<CommentsModel> commentsPage = commentsDao.queryParentPageBy(pageNo, pageSize, paramsMap);
        List<CommentsModel> commentsList = commentsPage.getList();
        if (commentsList.size() > 0) {
            Map<String, Object> parentCommentIdParamMap = new HashMap<>();
            for (CommentsModel comment : commentsList) {
                parentCommentIdParamMap.put("topCommentId", comment.get("id"));
                comment.put("nameImg",nameImgPath+ comment.get("staffId") +".png");
                if (ObjectUtils.isNotEmpty(parentCommentIdParamMap)) {
                    List<CommentsModel> subComments = commentsDao.querySubCommentsByTopId(parentCommentIdParamMap);
                    if (subComments.size() > 0) {
                        comment.put("subComments", subComments);
                        for(CommentsModel subComment : subComments){
                            subComment.put("nameImg",nameImgPath+ comment.get("staffId") +".png");
                        }
                        comment.put("subCount", subComments.size());
                    }
                }
            }
        }
        return RestApiResult.newSuccess("获取工作报告评论成功", commentsPage);
    }


    public RestApiResult queryListBy(Map<String,Object> paramsMap){
        List<CommentsModel> commentsList = commentsDao.queryList(paramsMap);
        return RestApiResult.newSuccessWithData(recursionComments(commentsList,"-1"));
    }

    public List<CommentsModel> recursionComments(List<CommentsModel> commentsModelList,String pid){
        List<CommentsModel> retList = new ArrayList<CommentsModel>();
        if(CollectionUtils.isEmpty(commentsModelList)){
            return retList;
        }
        for(CommentsModel model : commentsModelList){
            String targetPid = model.get("id").toString();
            String pcId = model.get("parent_comment_id").toString();

            if(StringUtils.equals(pcId,pid)){
                List<CommentsModel> subList = recursionComments(commentsModelList,targetPid);
                if(CollectionUtils.isNotEmpty(subList)){
                    model.put("children",subList);
                }
                retList.add(model);
            }
        }
        return retList;
    }






    public RestApiResult save(CommentsModel model,Map<String, Object> paramsMap){

        SalesReportModel reportModel = salesReportDao.findById(model.get("sales_report_id"));

        if(ObjectUtils.isEmpty(reportModel)){
            return RestApiResult.newFail("未找到工作报告，无法评论");
        }

        if(!JmlKit.FLAG_1.equals(reportModel.get("submit_status"))){
            return RestApiResult.newFail("该工作报告未提交，无法评论");
        }


        String ids = null;
        if(ObjectUtils.isNotEmpty(model.get("mentioned_staff_userids"))){
            ids = model.get("mentioned_staff_userids");
            model.remove("mentioned_staff_userids");
        }
        int length = StrUtil.length(model.get("content"));
         model.save();
         if(StrUtil.isNotEmpty(ids)){
            List<String> mentionedStaffIdList = StrUtil.split(ids,",");
            if(mentionedStaffIdList.size() > 0){
                List<MentionedUsersModel>  mentionedUserAddList= new ArrayList<MentionedUsersModel>();
                for(String staffUserId:mentionedStaffIdList){
                    MentionedUsersModel mentionedUsersModel = new MentionedUsersModel();
                    mentionedUsersModel.set("mentioned_staff_userid",staffUserId);
                    mentionedUsersModel.set("comment_id",model.get("id"));
                    mentionedUsersModel.set("created_staff_id",model.get("created_staff_id"));

                    mentionedUserAddList.add(mentionedUsersModel);
                }
                Db.batchSave(mentionedUserAddList, AppKit.BATCH_SIZE);
            }
         }
         CommentsModel detailsModel = commentsDao.queryDetails(model.get("id").toString());
         return RestApiResult.newSuccess("评论保存成功",detailsModel);
    }


    public RestApiResult queryByMentionedUser(Map<String,Object> paramsMap){
        List<StaffModel>  staffList = staffDao.queryByMentionedUser(paramsMap);
        for(StaffModel staffModel:staffList){
            if(StrUtil.isEmpty(staffModel.get("avatar"))){
                staffModel.set("avatar", Jboot.configValue("baseline.upload.url")+"assets/logo.png");
            }
            staffModel.put("nameImg", GenerateNameImgKit.generateNameImg(staffModel.get("name"),staffModel.get("id")));
        }
        return RestApiResult.newSuccess("获取评论用户成功",staffList);
    }



}
