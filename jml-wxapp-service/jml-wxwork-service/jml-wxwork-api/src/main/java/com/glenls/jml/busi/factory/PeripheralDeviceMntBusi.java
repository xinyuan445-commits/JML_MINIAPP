package com.glenls.jml.busi.factory;

import com.alibaba.druid.util.StringUtils;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.kit.BeanModelKit;
import com.glenls.jml.kit.GeneratorSerNoKit;
import com.glenls.jml.model.factory.NitrogenLogModel;
import com.glenls.jml.model.factory.PeripheralDeviceMntModel;
import com.glenls.jml.model.factory.TpServiceProviderModel;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.jml.pojo.factory.PeripheralDeviceMntPojo;
import com.jfinal.aop.Inject;

import java.util.Map;


public class PeripheralDeviceMntBusi {
    @Inject
    private PeripheralDeviceMntModel peripheralDeviceMntDao;
    @Inject
    private GeneratorSerNoKit generatorSerNoKit;

    @Inject
    private TpServiceProviderModel tpServiceProviderDao;

    private static String NAME_PREFIX = "WB";

    @Inject
    FactoryTmpMsgBusi  factoryTmpMsgBusi;

    private static String OBJ_CODE = "";

    private static String OBJ_NAME = "第三方维保";

    private static String OBJ_PATH = "factory/pages/perDeviceMnt/Detailed?id=";

    public RestApiResult save(PeripheralDeviceMntPojo pojo, Map<String,Object> paramsMap) {
        PeripheralDeviceMntModel model = BeanModelKit.printProperties(pojo, PeripheralDeviceMntModel.class, true);
        if (StringUtils.isEmpty(model.get("id"))) {
            model.set("name", generatorSerNoKit.generateFactorySN(model._getTableName(), NAME_PREFIX));
            JmlKit.setSaveModel(model, paramsMap);
            JmlKit.setFJobTypeAndProdLineOrDept(model, paramsMap);
            model.save();
            StaffPojo staffPojo =  (StaffPojo) paramsMap.get("staff");
            paramsMap.put("objCode", OBJ_CODE);
            paramsMap.put("factoryType", OBJ_NAME);
            paramsMap.put("pagePath", OBJ_PATH+model.get("id"));
            paramsMap.put("name", model.get("name"));
            paramsMap.put("createName",staffPojo.getStaffName());
            factoryTmpMsgBusi.sendATmplMsg(paramsMap);
            return RestApiResult.newSuccess("新增第三方维保成功", model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id", paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        return RestApiResult.newSuccess("修改第三方维保成功", model.get("id"));
    }


    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap) {
        return RestApiResult.newSuccess("获取第三方维保成功", peripheralDeviceMntDao.queryPageBy(pageNo, pageSize, paramsMap));
    }

    public RestApiResult queryDetails(String id) {
        return RestApiResult.newSuccess("获取第三方维保成功", peripheralDeviceMntDao.queryDetails(id));
    }



    public RestApiResult queryTpServiceProviderList(Map<String,Object> paramsMap) {
        return RestApiResult.newSuccess("获取第三方维保成功", tpServiceProviderDao.queryList());

    }

}
