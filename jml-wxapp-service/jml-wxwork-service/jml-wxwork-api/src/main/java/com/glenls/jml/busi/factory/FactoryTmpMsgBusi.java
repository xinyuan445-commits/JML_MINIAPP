package com.glenls.jml.busi.factory;

import cn.hutool.core.date.DateUtil;
import cn.hutool.core.util.ObjUtil;
import com.glenls.jml.kit.SendWxTmpFacMsgKit;
import com.glenls.jml.model.factory.FactoryTmpMsgUserCfgModel;
import com.jfinal.aop.Inject;
import lombok.extern.slf4j.Slf4j;

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Slf4j
public class FactoryTmpMsgBusi {
    @Inject
    private FactoryTmpMsgUserCfgModel factoryTmpMsgUserCfgDao;

    @Inject
    private SendWxTmpFacMsgKit  sendWxTmpFacMsgKit;



    public void sendATmplMsg(Map<String, Object> paramsMap) {
        Date now = new Date();
        String nowTime = DateUtil.format(now, "yyyy年MM月dd日 HH:mm:ss");
        List<FactoryTmpMsgUserCfgModel> tmpMsgUserCfgModelList = factoryTmpMsgUserCfgDao.queryTmpUserOpenId(paramsMap);
        if(ObjUtil.isNotEmpty(paramsMap.get("assignIds"))){
            tmpMsgUserCfgModelList.addAll(factoryTmpMsgUserCfgDao.queryStaffOpenId(paramsMap));
        }
        if(ObjUtil.isNotEmpty(paramsMap.get("confirmIds"))){
            tmpMsgUserCfgModelList.addAll(factoryTmpMsgUserCfgDao.queryStaffOpenId(paramsMap));
        }
        if(ObjUtil.isNotEmpty(paramsMap.get("sendStaffId"))){
            tmpMsgUserCfgModelList.addAll(factoryTmpMsgUserCfgDao.queryStaffOpenId(paramsMap));
        }

        if(tmpMsgUserCfgModelList.size()>0){
            log.info("--发送公共模板消息 - A---，发送人记录："+tmpMsgUserCfgModelList);
            String ret = null;
            Map<String,Object> sendParamsMap = new HashMap<>();
            sendParamsMap.put("pagePath",paramsMap.get("pagePath"));
            sendParamsMap.put("name",paramsMap.get("name"));
            sendParamsMap.put("factoryType",paramsMap.get("factoryType"));
            sendParamsMap.put("createName",paramsMap.get("createName"));
            sendParamsMap.put("createdTime",nowTime);
            for(FactoryTmpMsgUserCfgModel model : tmpMsgUserCfgModelList){
                if(ObjUtil.isNotEmpty(model.get("openid"))){
                    sendParamsMap.put("openid",model.get("openid"));
                    log.info("发送公共模板消息 - A 内容"+ sendParamsMap);
                    ret = sendWxTmpFacMsgKit.sendATmplMsg(sendParamsMap).toString();
                    log.info("保存提交->模块:"+sendParamsMap.get("factoryType")+" 发送人员："+model.get("staffName")+"用户ID："+model.get("staffId")+" - 通知消息：" + ret);
                }else {
                    log.info("发送公共模板消息 - A，用户："+model.get("staffName")+" 用户ID："+model.get("staffId")+"未关注公众号，无法发送");
                }
            }
        }
    }



    public void sendBTmplMsg(Map<String, Object> paramsMap) {
        Date now = new Date();
        String nowTime = DateUtil.format(now, "yyyy年MM月dd日 HH:mm:ss");
        List<FactoryTmpMsgUserCfgModel> tmpMsgUserCfgModelList = factoryTmpMsgUserCfgDao.queryTmpUserOpenId(paramsMap);

        if(ObjUtil.isNotEmpty(paramsMap.get("sendStaffId"))){
            tmpMsgUserCfgModelList.addAll(factoryTmpMsgUserCfgDao.queryStaffOpenId(paramsMap));
        }
        if(tmpMsgUserCfgModelList.size()>0){
            log.info("--发送公共模板消息 - B---，发送人记录："+tmpMsgUserCfgModelList);
            String ret = null;
            Map<String,Object> sendParamsMap = new HashMap<>();
            sendParamsMap.put("pagePath",paramsMap.get("pagePath"));
            sendParamsMap.put("name",paramsMap.get("name"));
            sendParamsMap.put("staffName",paramsMap.get("staffName"));
            sendParamsMap.put("createdTime",nowTime);
            sendParamsMap.put("status",paramsMap.get("status"));
            sendParamsMap.put("factoryType",paramsMap.get("factoryType"));
            for(FactoryTmpMsgUserCfgModel model : tmpMsgUserCfgModelList){
                if(ObjUtil.isNotEmpty(model.get("openid"))){
                    sendParamsMap.put("openid",model.get("openid"));
                    log.info("发送公共模板消息 - B 内容"+ sendParamsMap);
                    ret = sendWxTmpFacMsgKit.sendBTmplMsg(sendParamsMap).toString();
                    log.info("完成提交->模块:"+sendParamsMap.get("factoryType")+" 发送人员： "+model.get("staffName")+"用户ID："+model.get("staffId")+" - 通知消息：" + ret);
                }else {
                    log.info("完成提交模板消息 - B，用户："+model.get("staffName")+" 用户ID："+model.get("staffId")+"未关注公众号，无法发送");
                }
            }
        }
    }


    public void sendCTmplMsg(Map<String, Object> paramsMap) {
        Date now = new Date();
        String nowTime = DateUtil.format(now, "yyyy年MM月dd日 HH:mm:ss");
        List<FactoryTmpMsgUserCfgModel> tmpMsgUserCfgModelList = factoryTmpMsgUserCfgDao.queryTmpUserOpenId(paramsMap);

        if(ObjUtil.isNotEmpty(paramsMap.get("sendStaffId"))){
            tmpMsgUserCfgModelList.addAll(factoryTmpMsgUserCfgDao.queryStaffOpenId(paramsMap));
        }
        if(tmpMsgUserCfgModelList.size()>0){
            log.info("--发送公共模板消息 - C---，发送人记录："+tmpMsgUserCfgModelList);
            String ret = null;
            Map<String,Object> sendParamsMap = new HashMap<>();
            sendParamsMap.put("pagePath",paramsMap.get("pagePath"));
            sendParamsMap.put("name",paramsMap.get("name"));
            sendParamsMap.put("staffName",paramsMap.get("staffName"));
            sendParamsMap.put("createdTime",paramsMap.get("createdTime"));
            sendParamsMap.put("assignTime",nowTime);
            sendParamsMap.put("deviceName",paramsMap.get("deviceName"));
            sendParamsMap.put("factoryType",paramsMap.get("factoryType"));
            for(FactoryTmpMsgUserCfgModel model : tmpMsgUserCfgModelList){
                if(ObjUtil.isNotEmpty(model.get("openid"))){
                    sendParamsMap.put("openid",model.get("openid"));
                    log.info("发送公共模板消息 - C 内容 "+ sendParamsMap);
                    ret = sendWxTmpFacMsgKit.sendCTmplMsg(sendParamsMap).toString();
                    log.info("设备报修->模块C:"+sendParamsMap.get("factoryType")+" 发送人员： "+model.get("staffName")+"用户ID："+model.get("staffId")+" - 通知消息：" + ret);
                }else {
                    log.info(" 设备报修->模板消息 - C，用户："+model.get("staffName")+" 用户ID："+model.get("staffId")+"未关注公众号，无法发送");
                }
            }
        }
    }







}
