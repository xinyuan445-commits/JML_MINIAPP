package com.glenls.wxwork.busi;

import cn.hutool.extra.emoji.EmojiUtil;
import com.alibaba.fastjson.JSON;
import com.glenls.commons.jfinal_wxwork.sdk.api.AccessTokenApi;
import com.glenls.commons.jfinal_wxwork.sdk.api.ApiResult;
import com.glenls.commons.jfinal_wxwork.sdk.api.ConCustApi;
import com.glenls.commons.lang.thread.bean.ThreadPoolBean;
import com.glenls.commons.lang.thread.kit.ThreadPoolKit;
import com.glenls.wxwork.model.WxworkCustomerFollowModel;
import com.glenls.wxwork.model.WxworkCustomerModel;
import com.glenls.wxwork.model.WxworkCustomerTagModel;
import com.glenls.wxwork.model.WxworkUserModel;
import com.glenls.wxwork.pojo.WxworkContactFollowPojo;
import com.glenls.wxwork.pojo.WxworkContactPojo;
import com.glenls.wxwork.pojo.WxworkContactTagPojo;
import com.jfinal.aop.Inject;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ThreadPoolExecutor;


@Slf4j
public class WxWorkCustSyncBusi {

    @Inject
    private WxWorkDeptSyncBusi wxWorkDeptSyncBusi;

    @Inject
    private WxWorkUserSyncBusi wxWorkUserSyncBusi;

    @Inject
    private WxworkUserModel wxworkUserDao;

    @Inject
    private WxworkCustomerModel wxworkCustomerDao;

    @Inject
    private WxworkCustomerFollowModel wxworkCustomerFollowDao;

    @Inject
    private WxworkCustomerTagModel wxworkCustomerTagDao;


    
    public void sync(){
        wxWorkDeptSyncBusi.sync();
        wxWorkUserSyncBusi.sync();

        List<WxworkUserModel> userList = wxworkUserDao.queryAll();
        if(CollectionUtils.isEmpty(userList)){
            log.info("用户列表为空，不进行客户同步");
            return ;
        }

        for (WxworkUserModel model : userList){
            String userId = model.getStr("userid");
            syncCustByUserId(userId);
        }
    }


    
    public void syncCustByUserId(final String userId){
        String accessToken = AccessTokenApi.getAccessTokenStr();
        log.info("accessToken->" + accessToken);
        ApiResult apiResult = ConCustApi.getCustList(userId);
        log.info("获取客户列表数据:" + apiResult.getJson());
        if(!apiResult.isSucceed()){
            log.info("获取客户列表失败。");
            return ;
        }
        List<String> custIdList = apiResult.getList("external_userid");
        if(CollectionUtils.isEmpty(custIdList)){
            log.info("客户ID为空");
            return ;
        }

        ThreadPoolBean threadPoolBean = ThreadPoolKit.initData(custIdList,1);
        CountDownLatch countDownLatch = threadPoolBean.getCountDownLatch();
        ThreadPoolExecutor threadPoolExecutor = ThreadPoolKit.initThreadPool();

        for (final String custId : custIdList){
            threadPoolExecutor.execute(new Runnable() {
                @Override
                public void run() {
                    try{
                        ApiResult apiResult = ConCustApi.getCustDetail(custId);
                        if(!apiResult.isSucceed()){
                            log.info("客户：" + custId + "获取详情失败");
                            return;
                        }

                        WxworkContactPojo contactPojo = JSON.parseObject(JSON.toJSONString(apiResult.get("external_contact")), WxworkContactPojo.class);
                        List<WxworkContactFollowPojo> contactFollowList = JSON.parseArray(JSON.toJSONString(apiResult.get("follow_user")), WxworkContactFollowPojo.class);

                        saveOrUpdateCust(userId,contactPojo,contactFollowList);
                    }catch (Exception e){
                        log.error(e.getMessage(),e);
                    }finally {
                        countDownLatch.countDown();
                    }
                }
            });
        }

        ThreadPoolKit.awaitAndShutdown(threadPoolExecutor,countDownLatch);
    }

    
    public void syncCustByExternalUserId(String userId,String externalUserId){
        String accessToken = AccessTokenApi.getAccessTokenStr();
        log.info("accessToken->" + accessToken);
        if(StringUtils.isEmpty(externalUserId)){
            log.info("客户externalUserId为空");
            return ;
        }

        ApiResult apiResult = ConCustApi.getCustDetail(externalUserId);
        if(!apiResult.isSucceed()){
            log.info("客户：" + externalUserId + "获取详情失败");
            return;
        }

        WxworkContactPojo contactPojo = JSON.parseObject(JSON.toJSONString(apiResult.get("external_contact")), WxworkContactPojo.class);
        List<WxworkContactFollowPojo> contactFollowList = JSON.parseArray(JSON.toJSONString(apiResult.get("follow_user")), WxworkContactFollowPojo.class);

        saveOrUpdateCust(userId,contactPojo,contactFollowList);
    }

    
    private void saveOrUpdateCust(String userId,WxworkContactPojo contactPojo, List<WxworkContactFollowPojo> contactFollowList){
        String custId = contactPojo.getExternal_userid();

        WxworkCustomerModel customerModel = wxworkCustomerDao.queryByCustId(custId);
        boolean isExistCust = customerModel != null;
        if(!isExistCust){
            customerModel = new WxworkCustomerModel();
        }

        List<WxworkCustomerFollowModel> contactFollowModelList = new ArrayList<>();
        List<WxworkCustomerTagModel> customerTagModelList = new ArrayList<>();

        customerModel.set("external_userid",contactPojo.getExternal_userid());
        customerModel.set("name", EmojiUtil.removeAllEmojis(contactPojo.getName()));
        customerModel.set("type",contactPojo.getType());
        customerModel.set("gender",contactPojo.getGender());
        customerModel.set("unionid",contactPojo.getUnionid());
        customerModel.set("position",contactPojo.getPosition());
        customerModel.set("avatar",contactPojo.getAvatar());
        customerModel.set("wxwork_userid",userId);

        if(CollectionUtils.isNotEmpty(contactFollowList)){
            for (WxworkContactFollowPojo followPojo : contactFollowList){
                WxworkCustomerFollowModel followModel = new WxworkCustomerFollowModel();
                followModel.set("userid",followPojo.getUserid());
                followModel.set("remark",EmojiUtil.removeAllEmojis(followPojo.getRemark()));
                followModel.set("description",followPojo.getDescription());
                followModel.set("createtime",new Date(followPojo.getCreatetime()));
                followModel.set("oper_userid",followPojo.getOper_userid());
                followModel.set("remark_corp_name",followPojo.getRemark_corp_name());
                followModel.set("add_way",followPojo.getAdd_way());
                followModel.set("state",followPojo.getState());

                contactFollowModelList.add(followModel);

                List<WxworkContactTagPojo> tagList = followPojo.getTags();
                if(CollectionUtils.isNotEmpty(tagList)){
                    customerTagModelList.addAll(convertCustTag(custId,tagList));
                }
            }
        }

        if(isExistCust){
            customerModel.update();
        }else{
            customerModel.save();
        }
        wxworkCustomerFollowDao.delByCustId(custId);
        wxworkCustomerTagDao.delByCustId(custId);
        wxworkCustomerFollowDao.batchInsert(contactFollowModelList);
        wxworkCustomerTagDao.batchInsert(customerTagModelList);
    }

    
    private List<WxworkCustomerTagModel> convertCustTag(String custId,List<WxworkContactTagPojo> tagList){
        List<WxworkCustomerTagModel> modelList = new ArrayList<>();
        if(CollectionUtils.isEmpty(tagList)){
            return modelList;
        }

        for (WxworkContactTagPojo pojo : tagList){
            WxworkCustomerTagModel model = new WxworkCustomerTagModel();
            model.set("custId",custId);
            model.set("group_name",pojo.getGroup_name());
            model.set("tag_name",pojo.getTag_name());
            model.set("type",pojo.getType());
            model.set("tag_id",pojo.getTag_id());

            modelList.add(model);
        }

        return modelList;
    }
}
