package com.glenls.jml.busi.factory;

import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.ObjUtil;
import com.alibaba.druid.util.StringUtils;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.kit.BeanModelKit;
import com.glenls.jml.kit.GeneratorSerNoKit;
import com.glenls.jml.model.factory.PressLineDailyReportDetailModel;
import com.glenls.jml.model.factory.PressLineProductionDetailModel;
import com.glenls.jml.model.factory.PressLineProductionModel;
import com.glenls.jml.model.factory.PrintingLineReportModel;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.jml.pojo.factory.PressLineProductionDetailPojo;
import com.glenls.jml.pojo.factory.PressLineProductionPojo;
import com.jfinal.aop.Inject;

import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


public class PressLineProductionBusi {
    @Inject
    private PressLineProductionModel pressLineProductionDao;
    @Inject
    private GeneratorSerNoKit generatorSerNoKit;

    @Inject
    private PressLineProductionDetailModel pressLineProductionDetailDao;

    private static String NAME_PREFIX = "YTXSC";
    @Inject
    FactoryTmpMsgBusi  factoryTmpMsgBusi;

    private static String OBJ_CODE = "YTSDD";

    private static String OBJ_NAME = "压贴线-生产工艺单";

    private static String OBJ_PATH = "factory/pages/pressLineProduction/Detailed?id=";

    private ThreadPoolExecutor sendFacTmplMsg = ThreadUtil.newExecutor(2, 50);

    public RestApiResult save(PressLineProductionPojo pojo, Map<String,Object> paramsMap) {
        PressLineProductionModel model = BeanModelKit.printProperties(pojo, PressLineProductionModel.class, true);
        if(ObjUtil.isEmpty(pojo.getPressLineProductionDetailList())){
            return  RestApiResult.newFail("压贴线-生产工艺单明细不能为空");
        }
        if (StringUtils.isEmpty(model.get("id"))) {
            model.set("name", generatorSerNoKit.generateFactorySN(model._getTableName(), NAME_PREFIX));
            JmlKit.setSaveModel(model, paramsMap);
            model.save();
            saveDetail(pojo, model.get("id").toString(), paramsMap);
            StaffPojo staffPojo =  (StaffPojo) paramsMap.get("staff");
            paramsMap.put("objCode", OBJ_CODE);
            paramsMap.put("factoryType", OBJ_NAME);
            paramsMap.put("pagePath", OBJ_PATH+model.get("id"));
            paramsMap.put("name", model.get("name"));
            paramsMap.put("createName",staffPojo.getStaffName());
            sendFacTmplMsg.execute(() -> factoryTmpMsgBusi.sendATmplMsg(paramsMap));
            return RestApiResult.newSuccess("新增压贴线-生产工艺单成功", model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id", paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        model.update();
        saveDetail(pojo, model.get("id").toString(), paramsMap);
        return RestApiResult.newSuccess("修改压贴线-生产工艺单成功", model.get("id"));
    }


    public void saveDetail(PressLineProductionPojo pojo, String pressLineProductionId, Map<String,Object> paramsMap) {
       if(pojo.getPressLineProductionDetailList().size()>0 && pojo.getPressLineProductionDetailList() !=null){
           for (PressLineProductionDetailPojo detailPojo : pojo.getPressLineProductionDetailList()){
               PressLineProductionDetailModel detailModel = BeanModelKit.printProperties(detailPojo,PressLineProductionDetailModel.class, true);
               detailModel.set("press_line_production_id", pressLineProductionId);
               if (StringUtils.isEmpty(detailModel.get("id"))) {
                   JmlKit.setSaveModel(detailModel,paramsMap);
                   detailModel.save();
               } else {
                   SFKit.updateModelSyncFlag(detailModel);
                   detailModel.update();
               }
           }
       }

    }


    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap) {
        return RestApiResult.newSuccess("获取压贴线-生产工艺单分页成功", pressLineProductionDao.queryPageBy(pageNo, pageSize, paramsMap));
    }


    public RestApiResult queryDetails(String id) {
        if (StringUtils.isEmpty(id)) {
            return RestApiResult.newFail("压贴线-生产工艺单Id不能为空");
        }
        PressLineProductionModel model = pressLineProductionDao.queryDetails(id);
        model.put("pressLineProductionDetailList", pressLineProductionDetailDao.queryListBy(model.get("id").toString()));
        return RestApiResult.newSuccess("获取压贴线-生产工艺单明细成功", model);
    }

}
