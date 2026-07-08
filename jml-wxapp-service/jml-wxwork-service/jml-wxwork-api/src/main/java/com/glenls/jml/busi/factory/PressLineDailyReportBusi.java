package com.glenls.jml.busi.factory;

import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.ObjUtil;
import com.alibaba.druid.util.StringUtils;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.kit.BeanModelKit;
import com.glenls.jml.kit.GeneratorSerNoKit;
import com.glenls.jml.model.factory.PressLineDailyReportDetailModel;
import com.glenls.jml.model.factory.PressLineDailyReportModel;
import com.glenls.jml.model.factory.PrintingLineReportDetailModel;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.jml.pojo.factory.PressLineDailyReportDetailPojo;
import com.glenls.jml.pojo.factory.PressLineDailyReportPojo;
import com.jfinal.aop.Inject;

import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


public class PressLineDailyReportBusi {
    @Inject
    private PressLineDailyReportModel pressLineDailyReportDao;
    @Inject
    private GeneratorSerNoKit generatorSerNoKit;

    @Inject
    private PressLineDailyReportDetailModel pressLineDailyReportDetailModel;

    private static String NAME_PREFIX = "YTX";

    @Inject
    FactoryTmpMsgBusi  factoryTmpMsgBusi;

    private static String OBJ_CODE = "YTRB";

    private static String OBJ_NAME = "压贴线-日报表";

    private static String OBJ_PATH = "factory/pages/pressLineReport/Detailed?id=";

    private ThreadPoolExecutor sendFacTmplMsg = ThreadUtil.newExecutor(2, 50);
    
    public RestApiResult save(PressLineDailyReportPojo pojo, Map<String,Object> paramsMap) {
        PressLineDailyReportModel model = BeanModelKit.printProperties(pojo, PressLineDailyReportModel.class, true);
        if(ObjUtil.isEmpty(pojo.getPressLineDailyReportDetailList())){
            return RestApiResult.newFail("压贴线-日报表明细不能为空");
        }
        if (StringUtils.isEmpty(model.get("id"))) {
            model.set("name", generatorSerNoKit.generateFactorySN(model._getTableName(), NAME_PREFIX));
            JmlKit.setSaveModel(model, paramsMap);
            model.save();
            saveDetail(pojo,model.get("id").toString(), paramsMap);
            sumQtyBy(model);
            model.update();
            StaffPojo staffPojo =  (StaffPojo) paramsMap.get("staff");
            paramsMap.put("objCode", OBJ_CODE);
            paramsMap.put("factoryType", OBJ_NAME);
            paramsMap.put("pagePath", OBJ_PATH+model.get("id"));
            paramsMap.put("name", model.get("name"));
            paramsMap.put("createName",staffPojo.getStaffName());
            sendFacTmplMsg.execute(() -> factoryTmpMsgBusi.sendATmplMsg(paramsMap));
            return RestApiResult.newSuccess("新增压贴线-日报表成功", model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id", paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        saveDetail(pojo,model.get("id").toString(), paramsMap);
        sumQtyBy(model);
        model.update();
        return RestApiResult.newSuccess("修改压贴线-日报表成功", model.get("id"));
    }

    
    private void saveDetail(PressLineDailyReportPojo pojo,String pressLineDailyReportId, Map<String,Object> params) {
        if (pojo.getPressLineDailyReportDetailList() != null && pojo.getPressLineDailyReportDetailList().size() > 0) {
            for (PressLineDailyReportDetailPojo detailPojo : pojo.getPressLineDailyReportDetailList()) {
                PressLineDailyReportDetailModel detailModel = BeanModelKit.printProperties(detailPojo,PressLineDailyReportDetailModel.class, true);
                detailModel.set("press_line_daily_report_id", pressLineDailyReportId);
                if (StringUtils.isEmpty(detailModel.get("id"))) {
                    JmlKit.setSaveModel(detailModel,params);
                    detailModel.save();
                } else {
                    SFKit.updateModelSyncFlag(detailModel);
                    detailModel.update();
                }
            }
        }
    }

    
    private void sumQtyBy(PressLineDailyReportModel model) {
       model.set("capacity",  pressLineDailyReportDetailModel.sumQtyBy(model.get("id")).get("capacity"));
       model.set("good_qty",  pressLineDailyReportDetailModel.sumQtyBy(model.get("id")).get("goodQty"));
       model.set("defective_qty",  pressLineDailyReportDetailModel.sumQtyBy(model.get("id")).get("defectiveQty"));
       model.set("paper_consumption",  pressLineDailyReportDetailModel.sumQtyBy(model.get("id")).get("paperConsumption"));
       model.set("substrate_consumption",  pressLineDailyReportDetailModel.sumQtyBy(model.get("id")).get("substrateConsumption"));
    }

    
    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String, Object> paramsMap) {
        return RestApiResult.newSuccess("获取压贴线-日报表成功", pressLineDailyReportDao.queryPageBy(pageNo, pageSize, paramsMap));
    }

    
    public RestApiResult queryDetails(String id) {
        PressLineDailyReportModel model = pressLineDailyReportDao.queryDetails(id);
        model.put("pressLineDailyReportDetailList", pressLineDailyReportDetailModel.queryListBy(model.get("id").toString()));
        return RestApiResult.newSuccess("获取压贴线-日报表明细成功", model);
    }


}
