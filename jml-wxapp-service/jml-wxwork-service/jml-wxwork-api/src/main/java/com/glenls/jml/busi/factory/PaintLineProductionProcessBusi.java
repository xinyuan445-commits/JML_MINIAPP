package com.glenls.jml.busi.factory;

import cn.hutool.core.thread.ThreadUtil;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.kit.BeanModelKit;
import com.glenls.jml.kit.GeneratorSerNoKit;
import com.glenls.jml.model.factory.PaintLineProductionProcessModel;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.jml.pojo.factory.PaintLineProductionProcessPojo;
import com.jfinal.aop.Inject;
import org.apache.commons.lang3.StringUtils;

import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


public class PaintLineProductionProcessBusi {
    @Inject
    private PaintLineProductionProcessModel paintLineProductionProcessDao;
    @Inject
    private GeneratorSerNoKit generatorSerNoKit;

    private static String NAME_PREFIX = "KQX";

    private static String OBJ_CODE = "KQSD";

    private static String OBJ_NAME = "烤漆线-生产工艺单";

    private static String OBJ_PATH = "factory/pages/paintLinProd/Detailed?id=";

    @Inject
    FactoryTmpMsgBusi  factoryTmpMsgBusi;
    private ThreadPoolExecutor sendFacTmplMsg = ThreadUtil.newExecutor(2, 50);


    public RestApiResult save(PaintLineProductionProcessPojo pojo, Map<String,Object> paramsMap){
        PaintLineProductionProcessModel model = BeanModelKit.printProperties(pojo,PaintLineProductionProcessModel.class,true);
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
            return RestApiResult.newSuccess("新增烤漆线-生产工艺单成功",model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id",paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改烤漆线-生产工艺单成功",model.get("id"));
    }


    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return RestApiResult.newSuccess("获取烤漆线-生产工艺单成功",paintLineProductionProcessDao.queryPageBy(pageNo,pageSize,paramsMap));
    }


    public RestApiResult queryDetails(String id){
        if(StringUtils.isEmpty(id)){
            return RestApiResult.newFail("烤漆线-生产工艺单Id不能为空");
        }
        return RestApiResult.newSuccess("获取烤漆线-生产工艺单明细成功",paintLineProductionProcessDao.queryDetails(id));
    }

}
