package com.glenls.jml.weixin.weixin.busi;

import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.PageUtil;
import com.alibaba.fastjson.JSONArray;
import com.glenls.api.modules.pub.kit.FileKit;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.ApiResult;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.UserApi;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.wxmp.openwx.kit.OpenWeixinKit;
import com.glenls.commons.wxmp.weixin.kit.WeiXinKit;
import com.glenls.jml.weixin.weixin.bean.fans.*;
import com.glenls.jml.weixin.weixin.model.LogWxMemberModel;
import com.glenls.jml.weixin.weixin.model.LogWxOpenidSyncModel;
import com.glenls.jml.weixin.weixin.model.WxMemberModel;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.Db;
import io.jboot.Jboot;
import io.jboot.support.redis.JbootRedis;
import lombok.extern.log4j.Log4j;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


@Log4j
public class OpenWxFansBusi {

    public static final ThreadPoolExecutor threadPoolExecutor = ThreadUtil.newExecutor(5,10);

    public static final String LAST_OPENID_KEY = "wx:lastopenId";

    @Inject
    private WxMemberModel wxMemberDao;

    @Inject
    private LogWxOpenidSyncModel logWxOpenidSyncDao;



    public void sync(){
       syncWxOpenId();
    }


    public void syncWxOpenId(){

        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("wxappid", OpenWeixinKit.getOpenAppId());

       syncOpenIdFromWeixin(null);
        syncWxMemberDetail();
    }


    public void syncWxMemberDetail(){
        List<LogWxOpenidSyncModel> modelList = logWxOpenidSyncDao.queryNoSyncDetailData();
        if(CollectionUtils.isEmpty(modelList)){
            log.info("没有需要同步明细的数据");
            return ;
        }

        List<UserObject> userList = new ArrayList<>();
        for (LogWxOpenidSyncModel model : modelList){
            String openId = model.get("openid");
            if(StringUtils.isEmpty(openId)){
                continue;
            }

            UserObject object = new UserObject();
            object.setOpenid(openId);
            object.setLang(WeiXinKit.ZH_CN);
            userList.add(object);

            model.set("status",LogWxOpenidSyncModel.STATUS_1);
        }

        if (CollectionUtils.isNotEmpty(userList)) {
            String batchNo = FileKit.getUUID();

            syncWxMemberAndSave(userList,batchNo);
            Db.batchUpdate(modelList, AppKit.BATCH_SIZE);
        }

        syncWxMemberDetail();
    }


    public void syncWxMemberByOpenId(String openId){
        if(StringUtils.isEmpty(openId)){
            log.info("微信openId为空");
            return;
        }

        WxMemberModel model = wxMemberDao.queryByOpenId(openId);
        if(model != null){
            String unionId = model.get("unionid");
            if(StringUtils.isEmpty(unionId)){
                model.delete();
                log.info("无unionId数据，重新抓取：" + openId);
            }else{
                wxMemberDao.updateSubscribeFlagByOpenId(openId,WxMemberModel.SUBSCRIBE_1);
                return ;
            }

        }

        List<UserObject> userList = new ArrayList<>();
        UserObject object = new UserObject();
        object.setOpenid(openId);
        object.setLang(WeiXinKit.ZH_CN);
        userList.add(object);

        String batchNo = FileKit.getUUID();
        syncWxMemberAndSave(userList,batchNo);
    }


    public void syncNewestFans(){
        JbootRedis redisClient = Jboot.getRedis();
        String openId = redisClient.get(LAST_OPENID_KEY);
        if(StringUtils.isEmpty(openId)){
            syncWxOpenId();
            return;
        }

        syncOpenIdFromWeixin(openId);
        logWxOpenidSyncDao.updateStatus();
        syncWxMemberDetail();
        wxMemberDao.updateSubscribeFlag2();
        wxMemberDao.updateSubscribeFlag3();
    }



    public void syncFromWeixin(String nextOpenId){
        ApiResult apiResult = UserApi.getFollowers(nextOpenId);

        if (apiResult.isSucceed()) {
            String jsonStr = apiResult.getJson();
            WxFollowersPojo followersPojo = JSONArray.parseObject(jsonStr, WxFollowersPojo.class);
            if(followersPojo == null || followersPojo.getData() == null){
                return ;
            }
            List<String> openIdList = followersPojo.getData().getOpenid();
            String next_openId = followersPojo.getNext_openid();

            if (CollectionUtils.isNotEmpty(openIdList)) {
                List<UserObject> userList = new ArrayList<UserObject>();
                for (String openId : openIdList) {
                    UserObject object = new UserObject();
                    object.setOpenid(openId);
                    object.setLang(WeiXinKit.ZH_CN);
                    userList.add(object);
                }
                if (CollectionUtils.isNotEmpty(userList)) {
                    String batchNo = FileKit.getUUID();

                    int userListSize = userList.size();
                    int pageSize = 100;
                    int pageCnt = PageUtil.totalPage(userListSize,pageSize);

                    for (int i = 0; i < pageCnt; i++) {
                        final int nextPageNo = i;
                        int[] startAndEnd = PageUtil.transToStartEnd(nextPageNo,pageSize);
                        int start = startAndEnd[0];
                        int end = startAndEnd[1];
                        if(end >= userListSize){
                            end = userListSize - 1;
                        }
                        List<UserObject> subList = userList.subList(start,end);
                        syncWxMemberAndSave(subList,batchNo);
                    }

                }

                if(StringUtils.isNotEmpty(next_openId)){
                    syncFromWeixin(next_openId);
                }
            }
        } else {
            log.error(apiResult.getErrorMsg());
        }
    }


    public void syncOpenIdFromWeixin(String nextOpenId){
        JbootRedis redisClient = Jboot.getRedis();
        ApiResult apiResult = UserApi.getFollowers(nextOpenId);
        log.info("粉丝openId同步结果：" + apiResult.getJson());

        if (apiResult.isSucceed()) {
            if(StringUtils.isEmpty(nextOpenId)){
                Map<String, Object> paramsMap = new HashMap<>();
                paramsMap.put("wxappid", WeiXinKit.getMpAppId());
                logWxOpenidSyncDao.delByWechatId(paramsMap);
            }

            String jsonStr = apiResult.getJson();
            WxFollowersPojo followersPojo = JSONArray.parseObject(jsonStr, WxFollowersPojo.class);
            if(followersPojo == null || followersPojo.getData() == null){
                return ;
            }
            List<String> openIdList = followersPojo.getData().getOpenid();
            String next_openId = followersPojo.getNext_openid();

            if (CollectionUtils.isNotEmpty(openIdList)) {

                List<LogWxOpenidSyncModel> modelList = new ArrayList<>();

                for (String openId : openIdList) {
                    LogWxOpenidSyncModel model = new LogWxOpenidSyncModel();
                    model.set("wxappid",WeiXinKit.getMpAppId());
                    model.set("openid",openId);
                    model.set("status",LogWxOpenidSyncModel.STATUS_0);

                    modelList.add(model);
                }

                Db.batchSave(modelList,AppKit.BATCH_SIZE);


                if(StringUtils.isNotEmpty(next_openId)){
                    syncOpenIdFromWeixin(next_openId);
                }else{
                    redisClient.set(LAST_OPENID_KEY,openIdList.get(openIdList.size() - 1));
                }
            }
        } else {
            if(WeiXinKit.checkRefreshAccessToken(apiResult)){
                syncWxMemberByOpenId(nextOpenId);
            }
            log.error(apiResult.getErrorMsg());
        }
    }


    private synchronized void syncWxMemberAndSave(List<UserObject> userObjects,String batchNo) {
        List<LogWxMemberModel> recordList = new ArrayList<>();

        BatchgetReqPojo batchgetReqPojo = new BatchgetReqPojo();
        batchgetReqPojo.setUser_list(userObjects);
        String str = JSONArray.toJSONString(batchgetReqPojo);
        ApiResult apiResult = UserApi.batchGetUserInfo(str);
        log.info("批量获取用户信息，参数：" + str + "，结果：" + apiResult.getJson());
        if (apiResult.isSucceed()) {
            WxMemberPojo memberPojo = JSONArray.parseObject(apiResult.getJson(), WxMemberPojo.class);
            List<UserBaseInfoPojo> userBaseInfoList = memberPojo.getUser_info_list();

            String wechatid = WeiXinKit.getMpAppId();
            Map<String, Object> paramsMap = new HashMap<>();
            paramsMap.put("batchNo",batchNo);

            for (UserBaseInfoPojo pojo : userBaseInfoList) {
                LogWxMemberModel record = new LogWxMemberModel();
                record.set("batchNo",batchNo);
                record.set("wxappid", wechatid);
                record.set("subscribe", pojo.getSubscribe());
                record.set("openid", pojo.getOpenid());
                record.set("nickname", WeiXinKit.filterEmoji(pojo.getNickname()));
                record.set("sex", pojo.getSex());
                record.set("city", pojo.getCity());
                record.set("country", pojo.getCountry());
                record.set("province", pojo.getProvince());
                record.set("headimgurl", pojo.getHeadimgurl());

                Long subscribeTime = pojo.getSubscribe_time();
                if(subscribeTime != null){
                    record.set("subscribe_time", new Timestamp(pojo.getSubscribe_time() * 1000));
                }else{
                    record.set("subscribe_time", new Timestamp(System.currentTimeMillis()));
                }

                record.set("unionid",pojo.getUnionid());
                record.set("remark", pojo.getRemark());
                record.set("groupid", pojo.getGroupid());
                recordList.add(record);
            }

            if (CollectionUtils.isNotEmpty(recordList)) {
                log.info("开始保存粉丝信息,粉丝数量：" + recordList.size());
                Db.batchSave(recordList, AppKit.BATCH_SIZE);
                wxMemberDao.batchUpdate4Sync(paramsMap);
                wxMemberDao.batchInsert4Sync(paramsMap);

            }
        }else {
            if(WeiXinKit.checkRefreshAccessToken(apiResult)){
                log.info("accessToken重置完成，将重新更新粉丝信息");
                syncWxMemberAndSave(userObjects, batchNo);
            }
        }
    }

}
