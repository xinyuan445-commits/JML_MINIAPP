package com.glenls.jml.controller;

import com.glenls.commons.jboot.controller.BaseController;
import com.glenls.jml.busi.ProjectBusi;
import com.glenls.jml.model.AccountModel;
import com.glenls.jml.model.ProjectModel;
import com.glenls.jml.modules.pub.controller.Base4JmlAuthController;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;

import java.util.HashMap;
import java.util.Map;


@RequestMapping("/api/project")
public class ProjectController extends Base4JmlAuthController {

    @Inject
    private ProjectBusi projectBus;


    public void queryProjectPage(){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("multiFiled",getPara("multiFiled"));
        renderJson(projectBus.queryPage(getPageNo(),getPageSize(),paramsMap));
    }


    public void saveProject(){
        Map<String,Object> paramsMap = initQueryMap();
        ProjectModel model = getModel(ProjectModel.class,"project");
        renderJson(projectBus.save(model,paramsMap));
    }


    public void queryProjectDetails(){
        Map<String,Object> paramsMap = initQueryMap();
        paramsMap.put("id",getPara("id"));
        renderJson(projectBus.queryDetails(paramsMap));
    }



}
