package com.glenls.jml.weixin.wxapp.pojo;

import com.glenls.api.modules.jml.model.StaffAreaModel;
import com.glenls.api.modules.jml.model.StaffModel;
import com.glenls.commons.wxmp.wxapp.pojo.WxAppCodeRetPojo;
import lombok.Data;

import java.util.List;


@Data
public class JmlWxAppUserRetPojo {

    
    private WxAppCodeRetPojo wxAppInfo;

    
    private StaffModel userInfo;

    
    private List<StaffAreaModel> staffAreaList;
}
