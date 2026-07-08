package com.glenls.jml.busi.factory;

import cn.hutool.core.thread.ThreadUtil;
import com.alibaba.druid.util.StringUtils;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.kit.BeanModelKit;
import com.glenls.jml.kit.GeneratorSerNoKit;
import com.glenls.jml.model.factory.SandingBeltReplacementModel;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.jml.pojo.factory.SandingBeltReplacementPojo;
import com.jfinal.aop.Inject;

import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


public class SandingBeltReplacementBusi {

    @Inject
    private SandingBeltReplacementModel sandingBeltReplacementDao;
    @Inject
    private GeneratorSerNoKit generatorSerNoKit;

    private static String NAME_PREFIX = "SDGH";

    private static String OBJ_CODE = "SBDR";

    private static String OBJ_NAME = "砂带更换记录";

    private static String OBJ_PATH = "factory/pages/sandingBelt/Detailed?id=";

    @Inject
    FactoryTmpMsgBusi  factoryTmpMsgBusi;

    private ThreadPoolExecutor sendFacTmplMsg = ThreadUtil.newExecutor(2, 50);


    public RestApiResult save(SandingBeltReplacementPojo pojo, Map<String,Object> paramsMap){
        SandingBeltReplacementModel model = BeanModelKit.printProperties(pojo,SandingBeltReplacementModel.class,true);
        if(StringUtils.isEmpty(model.get("id"))){
            model.set("name",generatorSerNoKit.generateFactorySN(model._getTableName(),NAME_PREFIX));
            JmlKit.setSaveModel(model,paramsMap);
            model.save();
            StaffPojo staffPojo =  (StaffPojo) paramsMap.get("staff");
            paramsMap.put("objCode", OBJ_CODE);
            paramsMap.put("factoryType", OBJ_NAME);
            paramsMap.put("pagePath", OBJ_PATH+model.get("id"));
            paramsMap.put("name", model.get("name"));
            paramsMap.put("createName",staffPojo.getStaffName());
            sendFacTmplMsg.execute(() -> factoryTmpMsgBusi.sendATmplMsg(paramsMap));

            return RestApiResult.newSuccess("新增砂带更换成功",model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改砂带更换成功",model.get("id"));
    }



    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("获取砂带更换成功",sandingBeltReplacementDao.queryPageBy(pageNo,pageSize,paramsMap));
    }


    public RestApiResult queryDetails(String id) {
        return RestApiResult.newSuccess("获取砂带更换明细成功", sandingBeltReplacementDao.queryDetails(id));
    }
}
