package com.glenls.jml.modules.pub.controller;

import com.glenls.commons.jboot.controller.BaseController;


public class Base4JmlController extends BaseController {


    protected String getStaffId(){
        return getHeader("staff-id");
    }

}
