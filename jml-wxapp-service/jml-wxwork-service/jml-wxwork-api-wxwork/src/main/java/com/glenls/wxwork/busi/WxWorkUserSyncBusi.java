package com.glenls.wxwork.busi;

import cn.hutool.core.map.MapUtil;
import cn.hutool.core.util.HashUtil;
import com.alibaba.fastjson.JSON;
import com.glenls.commons.jfinal_wxwork.sdk.api.AccessToken4ContcatApi;
import com.glenls.commons.jfinal_wxwork.sdk.api.AccessTokenApi;
import com.glenls.commons.jfinal_wxwork.sdk.api.ApiResult;
import com.glenls.commons.jfinal_wxwork.sdk.kit.ParaMap;
import com.glenls.commons.jfinal_wxwork.sdk.utils.HttpUtils;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.wxwork.model.WxworkDeptModel;
import com.glenls.wxwork.model.WxworkRelaUserDeptModel;
import com.glenls.wxwork.model.WxworkUserModel;
import com.glenls.wxwork.pojo.user.WxworkInviteByUserIdPojo;
import com.glenls.wxwork.pojo.user.WxworkUserPojo;
import com.jfinal.aop.Inject;
import com.jfinal.kit.JsonKit;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.math.NumberUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Slf4j
public class WxWorkUserSyncBusi {

    
    public static final String get_dept_user_url = "https:

    
    public static final String get_dept_user_detail_url = "https:

    
    public static final String create_user = "https:

    
    public static final String update_user = "https:

    
    public static final String invite_user = "https:

    
    public static final String query_by_mobile = "https:

    
    public static final String query_by_email = "https:



    public static final String query_user_info_new = "https:



    public static final String get_user_detail_new = "https:

    @Inject
    private WxworkDeptModel wxworkDeptDao;

    @Inject
    private WxworkUserModel wxworkUserDao;

    @Inject
    private WxworkRelaUserDeptModel wxworkRelaUserDeptDao;


    public ApiResult queryByMobile(String mobile){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("mobile", mobile);
        String postDataStr = JsonKit.toJson(paramsMap);

        String jsonResult= HttpUtils.post(query_by_mobile + AccessToken4ContcatApi.getAccessTokenStr(), postDataStr);
        ApiResult apiResult = new ApiResult(jsonResult);
        log.info("根据手机号码：" + mobile + "查询用户出参->" + jsonResult);

        return apiResult;
    }


    public ApiResult queryByEmail(String email){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("email", email);
        String postDataStr = JsonKit.toJson(paramsMap);

        String jsonResult= HttpUtils.post(query_by_email + AccessToken4ContcatApi.getAccessTokenStr(), postDataStr);
        ApiResult apiResult = new ApiResult(jsonResult);
        log.info("根据邮箱：" + email + "查询用户出参->" + jsonResult);

        return apiResult;
    }


    public RestApiResult queryUserBy(WxworkUserPojo userPojo){
        Map<String,String> paramsMap = new HashMap<>();
        paramsMap.put("mobile",userPojo.getMobile());
        paramsMap.put("email",userPojo.getEmail());

        return queryUserBy(paramsMap);
    }


    public RestApiResult queryUserBy(Map<String,String> paramsMap){
        String mobile = paramsMap.get("mobile");
        if(StringUtils.isNotEmpty(mobile)){
            ApiResult apiResult = queryByMobile(mobile);
            if(apiResult.isSucceed()){
                return RestApiResult.newSuccessWithData(apiResult.get("userid"));
            }
        }

        String email = paramsMap.get("email");
        if(StringUtils.isNotEmpty(email)){
            ApiResult apiResult = queryByEmail(email);
            if(apiResult.isSucceed()){
                return RestApiResult.newSuccessWithData(apiResult.get("userid"));
            }
        }

        return RestApiResult.newFail("未找到用户");
    }


    public ApiResult createUser(WxworkUserPojo userPojo){
        String userDataStr = JsonKit.toJson(userPojo);
        RestApiResult userExistResult = queryUserBy(userPojo);
        if(userExistResult.isSuccess()){
            String jsonResult= HttpUtils.post(update_user + AccessToken4ContcatApi.getAccessTokenStr(), userDataStr);
            ApiResult apiResult = new ApiResult(jsonResult);
            log.info("更新企业微信用户：入参->" +userDataStr + "出参->" + apiResult.getJson());
            return apiResult;
        }
        String jsonResult= HttpUtils.post(create_user + AccessToken4ContcatApi.getAccessTokenStr(), userDataStr);
        ApiResult apiResult = new ApiResult(jsonResult);
        log.info("创建企业微信用户：入参->" +userDataStr + "出参->" + apiResult.getJson());

        if(apiResult.isSucceed()){
            inviteUser(new WxworkInviteByUserIdPojo(new String[]{userPojo.getUserid()}));
        }

        return apiResult;
    }


    public ApiResult updateUser(WxworkUserPojo userPojo){
        String userDataStr = JsonKit.toJson(userPojo);
        String jsonResult= HttpUtils.post(update_user + AccessToken4ContcatApi.getAccessTokenStr(), userDataStr);
        ApiResult apiResult = new ApiResult(jsonResult);
        log.info("更新企业微信用户：入参->" +userDataStr + "出参->" + apiResult.getJson());

        return apiResult;
    }


    public ApiResult inviteUser(WxworkInviteByUserIdPojo pojo){
        String jsonResult= HttpUtils.post(invite_user + AccessToken4ContcatApi.getAccessTokenStr(), JsonKit.toJson(pojo));
        ApiResult apiResult = new ApiResult(jsonResult);

        return apiResult;
    }


    private ApiResult getDeptUser(Long deptId){
        ParaMap pm= ParaMap.create("access_token", AccessTokenApi.getAccessTokenStr());
        pm.put("department_id", String.valueOf(deptId));
        pm.put("fetch_child","0");

        String jsonResult= HttpUtils.get(get_dept_user_url, pm.getData());
        ApiResult apiResult = new ApiResult(jsonResult);

        return apiResult;
    }


    private ApiResult getDeptUserDetail(Long deptId){
        ParaMap pm= ParaMap.create("access_token", AccessTokenApi.getAccessTokenStr());
        pm.put("department_id", String.valueOf(deptId));
        pm.put("fetch_child","0");

        String jsonResult= HttpUtils.get(get_dept_user_detail_url, pm.getData());
        ApiResult apiResult = new ApiResult(jsonResult);

        return apiResult;
    }


    public void sync(){
        List<WxworkDeptModel> deptList = wxworkDeptDao.queryAll();
        if(CollectionUtils.isEmpty(deptList)){
            log.info("部门列表为空，不进行员工信息同步");
            return ;
        }
        
        for (WxworkDeptModel deptModel : deptList){
            Long deptId = deptModel.getLong("id");

            syncUserByDeptId(deptId);
        }

    }


    private void syncUserByDeptId(Long deptId){
        ApiResult apiResult = getDeptUserDetail(deptId);
        if(!apiResult.isSucceed()){
            log.info("根据部门ID从企业微信拉取微信用信息失败，失败原因：" + apiResult.getJson());
            return ;
        }
        List<WxworkUserPojo> userList = JSON.parseArray(JSON.toJSONString(apiResult.getList("userlist")), WxworkUserPojo.class);
        wxworkUserDao.delByDeptId(deptId);
        wxworkRelaUserDeptDao.delByDeptId(deptId);

        if(CollectionUtils.isEmpty(userList)){
            log.info("部门：" +deptId + "获取到的用户列表为空");
            return ;
        }

        List<WxworkUserModel> userModelInsertList = new ArrayList<>();
        List<WxworkUserModel> userModelUpdateList = new ArrayList<>();
        List<WxworkRelaUserDeptModel> userRelaDeptModelList = new ArrayList<>();

        List<WxworkUserModel> allUserList = wxworkUserDao.queryAll();

        for (WxworkUserPojo userPojo : userList){
            WxworkUserModel userModel = new WxworkUserModel();
            String userId = userPojo.getUserid();
            userModel.set("userid",userId);
            userModel.set("name",userPojo.getName());
            userModel.set("mobile",userPojo.getMobile());
            userModel.set("position",userPojo.getPosition());
            userModel.set("gender",userPojo.getGender());
            userModel.set("email",userPojo.getEmail());
            userModel.set("avatar",userPojo.getAvatar());
            userModel.set("thumb_avatar",userPojo.getThumb_avatar());
            userModel.set("telephone",userPojo.getTelephone());
            userModel.set("alias",userPojo.getAlias());
            userModel.set("address",userPojo.getAddress());
            userModel.set("open_userid",userPojo.getOpen_userid());
            userModel.set("main_department",userPojo.getMain_department());

            if(!checkUserExist(allUserList,userId)){
                userModelInsertList.add(userModel);
            }else{
                userModelUpdateList.add(userModel);
            }

            userRelaDeptModelList.addAll(convertUserRelaModel(userId, userPojo));
        }

        if(CollectionUtils.isNotEmpty(userModelInsertList)){
            wxworkUserDao.batchInsert(userModelInsertList);
        }
        if(CollectionUtils.isNotEmpty(userModelUpdateList)){
            wxworkUserDao.batchUpdate(userModelUpdateList);
        }

        if(CollectionUtils.isNotEmpty(userRelaDeptModelList)){
            wxworkRelaUserDeptDao.batchDelByUserId(userRelaDeptModelList);
            wxworkRelaUserDeptDao.batchInsert(userRelaDeptModelList);
        }

        log.info("部门：" + deptId + "，本次同步新增用户：" + userModelInsertList.size() + "条");
        log.info("部门：" + deptId + "，本次同步更新用户：" + userModelUpdateList.size() + "条");

    }


    private boolean checkUserExist(List<WxworkUserModel> allUserList,String userId){
        if(CollectionUtils.isEmpty(allUserList)){
            return false;
        }
        for (WxworkUserModel model : allUserList){
            String targetUserId = model.get("userid");
            if(StringUtils.equals(targetUserId,userId)){
                return true;
            }
        }

        return false;
    }


    private List<WxworkRelaUserDeptModel> convertUserRelaModel(String userId,WxworkUserPojo userPojo){
        List<Long> deptIdList = userPojo.getDepartment();
        List<Integer> orderList = userPojo.getOrder();

        List<WxworkRelaUserDeptModel> modelList = new ArrayList<>();
        if(CollectionUtils.isEmpty(deptIdList)){
            return modelList;
        }

        for (int i = 0; i < deptIdList.size(); i++) {
            Long deptId =  deptIdList.get(i);
            WxworkRelaUserDeptModel model = new WxworkRelaUserDeptModel();
            model.set("userid",userId);
            model.set("deptid",deptId);
            try{
                model.set("order",orderList.get(i));
            }catch (Exception e){
                log.error(e.getMessage(),e);
            }

            modelList.add(model);
        }

        return modelList;
    }


    private WxworkDeptModel findBy(List<WxworkDeptModel> allList, String key, Integer val){
        if(CollectionUtils.isEmpty(allList)){
            return null;
        }
        for(WxworkDeptModel model : allList){
            Integer targetVal = model.get(key);
            if(NumberUtils.compare(targetVal,val) == 0){
                return model;
            }
        }

        return null;
    }


    public static  ApiResult getUserInfoByCodeNew(String code){
        String jsonResult = HttpUtils.get(query_user_info_new + AccessTokenApi.getAccessTokenStr() + "&code=" + code);
        return new ApiResult(jsonResult);
    }


    public static  ApiResult getUserInfoByUserTicketNew(String userTicket){
        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("user_ticket", userTicket);
        String postDataStr = JsonKit.toJson(paramsMap);

        String jsonResult= HttpUtils.post(get_user_detail_new + AccessToken4ContcatApi.getAccessTokenStr(), postDataStr);
        ApiResult apiResult = new ApiResult(jsonResult);
        log.info("userTicket：" + userTicket + "查询用户出参->" + jsonResult);

        return apiResult;
    }
}
