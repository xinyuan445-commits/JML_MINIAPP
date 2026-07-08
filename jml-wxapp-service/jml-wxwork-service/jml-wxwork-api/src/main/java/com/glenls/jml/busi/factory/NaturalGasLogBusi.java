package com.glenls.jml.busi.factory;

import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.ObjUtil;
import com.alibaba.druid.util.StringUtils;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.kit.BeanModelKit;
import com.glenls.jml.kit.GeneratorSerNoKit;
import com.glenls.jml.model.factory.NaturalGasLogModel;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.jml.pojo.factory.NaturalGasLogPojo;
import com.jfinal.aop.Inject;

import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


public class NaturalGasLogBusi {

    @Inject
    private NaturalGasLogModel naturalGasLogDao;

    @Inject
    private GeneratorSerNoKit generatorSerNoKit;

    private static String NAME_PREFIX = "TRQ";

    @Inject
    FactoryTmpMsgBusi  factoryTmpMsgBusi;

    private static String OBJ_CODE = "NGDRG";

    private static String OBJ_NAME = "天然气登记表";

    private static String OBJ_PATH = "factory/pages/naturalGasLog/Detailed?id=";

    private ThreadPoolExecutor sendFacTmplMsg = ThreadUtil.newExecutor(2, 50);

    public RestApiResult save(NaturalGasLogPojo pojo, Map<String,Object> paramsMap){
        NaturalGasLogModel model = BeanModelKit.printProperties(pojo,NaturalGasLogModel.class,true);
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
            return RestApiResult.newSuccess("新增天然气登记表成功",model.get("id"));
        }
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改天然气登记表成功",model.get("id"));
    }



    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap) {
        return RestApiResult.newSuccess("查询天然气登记表分页列表成功",naturalGasLogDao.queryPageBy(pageNo,pageSize,paramsMap));
    }


    public RestApiResult queryDetails(Map<String,Object> paramsMap) {
        if(ObjUtil.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("天然气登记表Id不能为空");
        }
        String id = paramsMap.get("id").toString();
        NaturalGasLogModel beforeModel = naturalGasLogDao.queryBeforeReading(paramsMap);
        NaturalGasLogModel model = naturalGasLogDao.queryDetails(id);

        if(ObjUtil.isNotEmpty(beforeModel) && beforeModel.get("id").equals(id)){
               model.put("isEdit",JmlKit.FLAG_1);
        }else{
               model.put("isEdit",JmlKit.FLAG_0);
        }

        return RestApiResult.newSuccess("查询天然气登记表明细成功",model);
    }

    public RestApiResult queryBeforeReading(Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("查询上一次天然气示数成功",naturalGasLogDao.queryBeforeReading(paramsMap));
    }





}
