package com.glenls.jml.controller;

import com.glenls.jml.busi.CommentsBusi;
import com.glenls.jml.model.CommentsModel;
import com.glenls.jml.model.SalesReportModel;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.HashMap;
import java.util.Map;


@RequestMapping("/api/comments")
public class CommentsController extends Base4JmlAuthController {

    @Inject
    private CommentsBusi commentsBusi;

    public void queryCommentsPageBy(){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("salesReportId",getPara("salesReportId"));
        renderJson(commentsBusi.queryPageBy(getPageNo(),getPageSize(),paramsMap));
    }

    public void queryListBy(){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("salesReportId",getPara("salesReportId"));
        renderJson(commentsBusi.queryListBy(paramsMap));
    }


    public void saveComment(){
        Map<String,Object> paramsMap = initQueryMap();
        CommentsModel model = getModel(CommentsModel.class,"comment");
        model.set("created_staff_id",paramsMap.get("staffId"));
        renderJson(commentsBusi.save(model,paramsMap));
    }


    public void queryByMentionedUser(){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("ownerStaffId",getPara("ownerStaffId"));
        paramsMap.put("staffName",getPara("staffName"));
       renderJson(commentsBusi.queryByMentionedUser(paramsMap));

    }

}
