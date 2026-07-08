package com.glenls.api.modules.jml.busi;

import cn.hutool.core.date.DateUtil;
import cn.hutool.core.util.ObjUtil;

import com.glenls.api.modules.jml.kit.SendWxTmpFacMsgKit;
import com.glenls.api.modules.jml.model.FactoryTmpMsgUserCfgModel;
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
    private SendWxTmpFacMsgKit sendWxTmpFacMsgKit;


    public void sendDTmplMsg(Map<String, Object> paramsMap) {
        Date now = new Date();
        String nowTime = DateUtil.format(now, "yyyy年MM月dd日 HH:mm:ss");
        List<FactoryTmpMsgUserCfgModel> tmpMsgUserCfgModelList = factoryTmpMsgUserCfgDao.queryTmpUserOpenId(paramsMap);

        if(ObjUtil.isNotEmpty(paramsMap.get("sendStaffId"))){
            tmpMsgUserCfgModelList.addAll(factoryTmpMsgUserCfgDao.queryStaffOpenId(paramsMap));
        }
        if(tmpMsgUserCfgModelList.size()>0){
            log.info("--发送公共模板消息 - D---，发送人记录："+tmpMsgUserCfgModelList);
            String ret = null;
            Map<String,Object> sendParamsMap = new HashMap<>();
            sendParamsMap.put("pagePath",paramsMap.get("pagePath"));
            sendParamsMap.put("name",paramsMap.get("name"));
            sendParamsMap.put("staffName",paramsMap.get("staffName"));
            sendParamsMap.put("createdTime",paramsMap.get("createdTime"));
            sendParamsMap.put("factoryType",paramsMap.get("factoryType"));
            sendParamsMap.put("status",paramsMap.get("status"));
            for(FactoryTmpMsgUserCfgModel model : tmpMsgUserCfgModelList){
                if(ObjUtil.isNotEmpty(model.get("openid"))){
                    sendParamsMap.put("openid",model.get("openid"));
                    log.info("发送公共模板消息 - D 内容 "+ sendParamsMap);
                    ret = sendWxTmpFacMsgKit.sendDTmplMsg(sendParamsMap).toString();
                    log.info("设备报修->模块D:"+sendParamsMap.get("factoryType")+" 发送人员： "+model.get("staffName")+"用户ID："+model.get("staffId")+" - 通知消息：" + ret);
                }else {
                    log.info(" 设备报修->模板消息 - D，用户："+model.get("staffName")+" 用户ID："+model.get("staffId")+"未关注公众号，无法发送");
                }
            }
        }
    }







}
