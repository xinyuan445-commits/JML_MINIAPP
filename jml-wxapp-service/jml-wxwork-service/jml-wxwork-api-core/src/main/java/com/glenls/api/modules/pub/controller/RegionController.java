package com.glenls.api.modules.pub.controller;

import com.glenls.api.modules.pub.busi.RegionBusi;
import com.glenls.commons.jboot.controller.BaseController;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;


@RequestMapping("/api/core/region")
public class RegionController extends BaseController {

    @Inject
    private RegionBusi regionBusi;

    
    public void list(){
        renderJson(regionBusi.list());
    }

    
    public void tree(){
        renderJson(regionBusi.tree());
    }

    
    public void allProvince(){
        renderJson(regionBusi.allProvince());
    }


    public void treeX(){
        renderJson(regionBusi.treeX());
    }
}
