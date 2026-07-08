package com.glenls.jml.busi.factory;

import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.ObjUtil;
import cn.hutool.core.util.StrUtil;
import com.alibaba.druid.util.StringUtils;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.jml.kit.BeanModelKit;
import com.glenls.jml.kit.GeneratorSerNoKit;
import com.glenls.jml.model.factory.PrintingLineReportDetailModel;
import com.glenls.jml.model.factory.PrintingLineReportModel;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.jml.pojo.factory.PrintingLineReportDetailPojo;
import com.glenls.jml.pojo.factory.PrintingLineReportPojo;
import com.jfinal.aop.Inject;

import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


public class PrintingLineReportBusi {

    @Inject
    private PrintingLineReportModel printingLineReportDao;
    @Inject
    private GeneratorSerNoKit generatorSerNoKit;

    @Inject
    private PrintingLineReportDetailModel printingLineReportDetailDao;

    private static String NAME_PREFIX = "DYX";

    @Inject
    FactoryTmpMsgBusi  factoryTmpMsgBusi;

    private static String OBJ_CODE = "DYRB";

    private static String OBJ_NAME = "打印线-日报表";

    private static String OBJ_PATH = "factory/pages/printingLineReport/Detailed?id=";

    private ThreadPoolExecutor sendFacTmplMsg = ThreadUtil.newExecutor(2, 50);


    public RestApiResult save(PrintingLineReportPojo pojo, Map<String,Object> paramsMap) {
        PrintingLineReportModel model = BeanModelKit.printProperties(pojo, PrintingLineReportModel.class, true);
        if(ObjUtil.isEmpty(pojo.getPrintingLineReportDetailList())){
            return  RestApiResult.newFail("打印线-日报表明细不能为空");
        }
        if (StringUtils.isEmpty(model.get("id"))) {
            model.set("name", generatorSerNoKit.generateFactorySN(model._getTableName(), NAME_PREFIX));
            JmlKit.setSaveModel(model, paramsMap);
            model.save();
            saveDetail(pojo,model.get("id").toString(), paramsMap);
            model.set("print_qty", printingLineReportDetailDao.sumPrintQtyBy(model.get("id")).get("printQty"));
            model.update();
            StaffPojo staffPojo =  (StaffPojo) paramsMap.get("staff");
            paramsMap.put("objCode", OBJ_CODE);
            paramsMap.put("factoryType", OBJ_NAME);
            paramsMap.put("pagePath", OBJ_PATH+model.get("id"));
            paramsMap.put("name", model.get("name"));
            paramsMap.put("createName",staffPojo.getStaffName());
            sendFacTmplMsg.execute(() -> factoryTmpMsgBusi.sendATmplMsg(paramsMap));
            return RestApiResult.newSuccess("新增打印线-日报表成功", model.get("id"));
        }
        JmlKit.removeUpdateModel(model);
        model.set("update_staff_id", paramsMap.get("staffId"));
        SFKit.updateModelSyncFlag(model);
        saveDetail(pojo,model.get("id").toString(),paramsMap);
        model.set("print_qty",printingLineReportDetailDao.sumPrintQtyBy(model.get("id")).get("printQty"));
        model.update();
        return RestApiResult.newSuccess("修改打印线-日报表成功", model.get("id"));
    }


    private void saveDetail(PrintingLineReportPojo pojo,String printingLineReportId, Map<String,Object> params) {
        if (pojo.getPrintingLineReportDetailList() != null && pojo.getPrintingLineReportDetailList().size() > 0) {
            for (PrintingLineReportDetailPojo detailPojo : pojo.getPrintingLineReportDetailList()) {
                PrintingLineReportDetailModel detailModel = BeanModelKit.printProperties(detailPojo, PrintingLineReportDetailModel.class, true);
                detailModel.set("printing_line_report_id", printingLineReportId);
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

    public RestApiResult queryPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap) {
        return RestApiResult.newSuccess("获取打印线-日报表分页成功", printingLineReportDao.queryPageBy(pageNo, pageSize, paramsMap));
    }

    public RestApiResult queryDetails(String id) {
        if (StringUtils.isEmpty(id)) {
            return RestApiResult.newFail("打印线-日报表Id不能为空");
        }
        PrintingLineReportModel model = printingLineReportDao.queryDetails(id);
        model.put("printingLineReportDetailList", printingLineReportDetailDao.queryListBy(model.get("id").toString()));
        return RestApiResult.newSuccess("获取打印线-日报表明细成功", model);
    }
}
