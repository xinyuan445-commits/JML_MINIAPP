package com.glenls.jml.weixin.wxapp.busi;

import com.glenls.api.modules.jml.model.StaffAreaModel;
import com.glenls.api.modules.jml.model.StaffModel;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.wxmp.wxapp.busi.WxAppBusi;
import com.glenls.commons.wxmp.wxapp.pojo.WxAppCodeRetPojo;
import com.glenls.api.modules.pub.model.FactoryStaffRoleModel;
import com.glenls.jml.weixin.wxapp.kit.WeiXinKit;
import com.glenls.jml.weixin.wxapp.pojo.JmlWxAppUserRetPojo;
import com.jfinal.aop.Inject;
import io.jboot.Jboot;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.HashMap;
import java.util.Map;


@Slf4j
public class JmlWxAppBusi {

    @Inject
    private WxAppBusi wxAppBusi;

    @Inject
    private StaffModel staffDao;

    @Inject
    private StaffAreaModel staffAreaDao;
    
    private static final String STAFF_CACHE_KEY = "staff:";

    @Inject
    private FactoryStaffRoleModel factoryStaffDao;


    public RestApiResult queryByCode(String code){
        JmlWxAppUserRetPojo retPojo = new JmlWxAppUserRetPojo();

        WxAppCodeRetPojo wxUserInfo = wxAppBusi.code(code);
        retPojo.setWxAppInfo(wxUserInfo);

        if(!wxUserInfo.isSuccess()){
            return RestApiResult.newFail("根据code获取微信用户信息失败",retPojo);
        }

        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("openid",wxUserInfo.getOpenid());
        paramsMap.put("unionid",wxUserInfo.getUnionId());

        StaffModel staffModel = staffDao.queryByOpenIdOrUnionId(paramsMap);
        if(ObjectUtils.isNotEmpty(staffModel)){
            String dbUnionid = staffModel.get("unionid");
            StaffModel updateModel = new StaffModel();
            updateModel.set("id",staffModel.get("id"));
            if(StringUtils.isEmpty(dbUnionid)){
                updateModel.set("unionid",wxUserInfo.getUnionId());
                updateModel.update();
                staffModel.set("unionid",wxUserInfo.getUnionId());
            }

            if(WeiXinKit.FLAG_1.equals(staffModel.get("is_reset"))){
                updateModel.set("is_reset",WeiXinKit.FLAG_0);
                updateModel.update();
                if(Jboot.getRedis().exists(new StringBuffer(STAFF_CACHE_KEY).append(staffModel.get("id").toString()))){
                    Jboot.getRedis().del(new StringBuffer(STAFF_CACHE_KEY).append(staffModel.get("id").toString()));
                }
            }
            
            if(factoryStaffDao.queryByStaffId(staffModel.get("id"))!=null){
                staffModel.put("isFactory","1");
            }
            staffModel.put("staffAreaList",staffAreaDao.queryByStaffId(staffModel.get("id").toString()));
        }
        if(ObjectUtils.isNotEmpty(staffModel)&& WeiXinKit.FLAG_0.equals(staffModel.get("status"))){
            return RestApiResult.newFail("您已离职，或未启用无法使用该小程序，请联系管理员");
        }
        retPojo.setUserInfo(staffModel);
        return RestApiResult.newSuccessWithData(retPojo);
    }
}
