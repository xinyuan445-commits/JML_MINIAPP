package com.glenls.jml.busi.factory;

import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.ObjUtil;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.kit.BeanModelKit;
import com.glenls.jml.kit.GeneratorSerNoKit;
import com.glenls.jml.model.factory.NitrogenLogModel;
import com.glenls.jml.model.factory.PaintLineProductionProcessModel;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.jml.pojo.factory.NitrogenLogPojo;
import com.glenls.jml.pojo.factory.PaintLineProductionProcessPojo;
import com.jfinal.aop.Inject;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


public class NitrogenLogBusi {

    @Inject
    private NitrogenLogModel nitrogenLogDao;
    @Inject
    private GeneratorSerNoKit generatorSerNoKit;

    @Inject
    FactoryTmpMsgBusi  factoryTmpMsgBusi;

    private static String NAME_PREFIX = "DQ";

    private static String OBJ_CODE = "NYDRG";

    private static String OBJ_NAME = "氮气登记表";

    private static String OBJ_PATH = "factory/pages/nitrogenLog/Detailed?id=";

    private ThreadPoolExecutor sendFacTmplMsg = ThreadUtil.newExecutor(2, 50);

    public RestApiResult save(NitrogenLogPojo pojo, Map<String,Object> paramsMap){
        NitrogenLogModel model = BeanModelKit.printProperties(pojo,NitrogenLogModel.class,true);
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
            return RestApiResult.newSuccess("新增氮气登记表成功",model.get("id"));
        }
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改氮气登记表单成功",model.get("id"));
    }




    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap) {
        return RestApiResult.newSuccess("获取氮气登记表成功", nitrogenLogDao.queryPageBy(pageNo, pageSize, paramsMap));
    }


    public RestApiResult queryDetails(Map<String,Object> paramsMap) {
        if(ObjUtil.isEmpty(paramsMap.get("id"))){
            return RestApiResult.newFail("氮气登记表Id不能为空");
        }
        String id = paramsMap.get("id").toString();
        NitrogenLogModel beforeModel = nitrogenLogDao.queryBeforeLiquid(paramsMap);
        NitrogenLogModel model = nitrogenLogDao.queryDetails(id);

        if(ObjUtil.isNotEmpty(beforeModel) && beforeModel.get("id").equals(id)){
               model.put("isEdit",JmlKit.FLAG_1);
        }else{
               model.put("isEdit",JmlKit.FLAG_0);
        }
        return RestApiResult.newSuccess("获取氮气登记表明细成功", model);
    }


    public RestApiResult queryBeforeLiquid(Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("获取前液位成功", nitrogenLogDao.queryBeforeLiquid(paramsMap));
    }

}
