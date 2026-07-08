package com.glenls.jml.validator.factory;

import com.glenls.api.modules.pub.validator.ValidatorBase4Pub;
import com.glenls.jml.constant.factory.DailyInspectionStatusEnum;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.glenls.jml.pojo.factory.DailyInspectionReportPojo;
import com.jfinal.core.Controller;


public class DailyInspectionReportSaveValidator extends ValidatorBase4Pub {
    protected void validate(Controller c) {
        super.validate(c);
        DailyInspectionReportPojo pojo = getPojo(DailyInspectionReportPojo.class);
        this.validatePojo(pojo);
        if(DailyInspectionStatusEnum.STATUS_DQR.getDesc().equals(pojo.getInspectionStatus())){
            if(pojo.getInspectionProdLine().contains("EB线、肤感线")){
                validateEbSkinSection(pojo);
            }
            if(pojo.getInspectionProdLine().contains("压贴线")){
                validatePressSection(pojo);
            }
            if(pojo.getInspectionProdLine().contains("倒角线")){
                validateChamferSection(pojo);
            }
            if(pojo.getInspectionProdLine().contains("打印线")){
                validatePrintLineSection(pojo);
            }
        }
        c.setAttr("pojo",pojo);
    }
    protected void handleError(Controller c) {
        super.handleError(c);
    }
    private void validateEbSkinSection(DailyInspectionReportPojo pojo) {
        this.validateRequired(pojo.getEbSkinInspectionDate(), ERROR_KEY, "EB线、肤感线巡查日期不能为空");
        this.validateRequired(pojo.getEbSkinInspectionStartTime(), ERROR_KEY, "EB线、肤感线巡查开始时间不能为空");
        this.validateRequired(pojo.getEbSkinInspectionEndTime(), ERROR_KEY, "EB线、肤感线巡查结束时间不能为空");
        this.validateRequired(pojo.getEbSkinConfirmStaffId(), ERROR_KEY, "EB线、肤感线现场确认人员不能为空");
        this.validateRequired(pojo.getEbSkinCompCheck(), ERROR_KEY, "请选择EB线、肤感线检查空压机是否开启");
        if(JmlKit.FLAG_1.equals(pojo.getEbSkinCompCheck())){
            this.validateRequired(pojo.getEbSkinCompCheckImg(), ERROR_KEY, "EB线、肤感线检查空压机图片不能为空");
        }

        this.validateRequired(pojo.getEbSkinEqInspectDone(), ERROR_KEY, "请选择EB线、肤感线每台设备点检表是否完成《检查完成情况》");
        if(JmlKit.FLAG_1.equals(pojo.getEbSkinEqInspectDone())){
            this.validateRequired(pojo.getEbSkinEqInspectDoneImg(), ERROR_KEY, "EB线、肤感线每台设备点检表图片不能为空");
        }

        this.validateRequired(pojo.getEbSkinDailyMaintDone(), ERROR_KEY, "请选择EB线、肤感线每台设备日保养表是否完成《检查完成情况》");
        if(JmlKit.FLAG_1.equals(pojo.getEbSkinDailyMaintDone())){
            this.validateRequired(pojo.getEbSkinDailyMaintDoneImg(), ERROR_KEY, "EB线、肤感线每台设备日保养表图片不能为空");
        }

        this.validateRequired(pojo.getEbSkinAirPressCheck(), ERROR_KEY, "请选择EB线、肤感线巡查空气压力是否达标");
        if(JmlKit.FLAG_1.equals(pojo.getEbSkinAirPressCheck())){
            this.validateRequired(pojo.getEbSkinAirPressCheckImg(), ERROR_KEY, "EB线、肤感线巡查空气压力图片不能为空");
        }

        this.validateRequired(pojo.getEbSkinBeltPosCheck(), ERROR_KEY, "请选择EB线、肤感线巡查皮带位置是否跑偏");
        if(JmlKit.FLAG_1.equals(pojo.getEbSkinBeltPosCheck())){
            this.validateRequired(pojo.getEbSkinBeltPosCheckImg(), ERROR_KEY, "EB线、肤感线巡查皮带位置图片不能为空");
        }

        this.validateRequired(pojo.getEbSkinBladeCheck(), ERROR_KEY, "请选择EB线、肤感线巡查覆膜机刀切刀是否完好");
        if(JmlKit.FLAG_1.equals(pojo.getEbSkinBladeCheck())){
            this.validateRequired(pojo.getEbSkinBladeCheckImg(), ERROR_KEY, "EB线、肤感线巡查覆膜机刀切刀图片不能为空");
        }

        this.validateRequired(pojo.getEbSkinGlueLeakCheck(), ERROR_KEY, "请选择EB线、肤感线巡查涂胶机侧面是否漏胶");
        if(JmlKit.FLAG_1.equals(pojo.getEbSkinGlueLeakCheck())){
            this.validateRequired(pojo.getEbSkinGlueLeakCheckImg(), ERROR_KEY, "EB线、肤感线巡查涂胶机侧面漏胶图片不能为空");
        }

        this.validateRequired(pojo.getEbSkinCoaterCheck(), ERROR_KEY, "请选择EB线、肤感线巡查所有涂布机平辊是否完好");
        if(JmlKit.FLAG_1.equals(pojo.getEbSkinCoaterCheck())){
            this.validateRequired(pojo.getEbSkinCoaterCheckImg(), ERROR_KEY, "EB线、肤感线巡查涂布机平辊图片不能为空");
        }

        this.validateRequired(pojo.getEbSkinLoaderCheck(), ERROR_KEY, "请选择EB线、肤感线巡查上下料龙门吸盘是否完好");
        if(JmlKit.FLAG_1.equals(pojo.getEbSkinLoaderCheck())){
            this.validateRequired(pojo.getEbSkinLoaderCheckImg(), ERROR_KEY, "EB线、肤感线巡查上下料龙门吸盘图片不能为空");
        }

        this.validateRequired(pojo.getEbSkinCuringBoxCheck(), ERROR_KEY, "请选择EB线、肤感线三灯固化电控箱空调是否运行");
        if(JmlKit.FLAG_1.equals(pojo.getEbSkinCuringBoxCheck())){
            this.validateRequired(pojo.getEbSkinCuringBoxCheckImg(), ERROR_KEY, "EB线、肤感线三灯固化电控箱空调图片不能为空");
        }

        this.validateRequired(pojo.getEbSkinConvCleanliness(), ERROR_KEY, "请选择EB线、肤感线巡查传送带是否清洁");
        if(JmlKit.FLAG_1.equals(pojo.getEbSkinConvCleanliness())){
            this.validateRequired(pojo.getEbSkinConvCleanlinessImg(), ERROR_KEY, "EB线、肤感线巡查传送带清洁图片不能为空");
        }
    }
    private void validatePressSection(DailyInspectionReportPojo pojo) {
        this.validateRequired(pojo.getPressInspectionDate(), ERROR_KEY, "压贴线巡查日期不能为空");
        this.validateRequired(pojo.getPressInspectionStartTime(), ERROR_KEY, "压贴线巡查开始时间不能为空");
        this.validateRequired(pojo.getPressInspectionEndTime(), ERROR_KEY, "压贴线巡查结束时间不能为空");
        this.validateRequired(pojo.getPressConfirmStaffId(), ERROR_KEY, "压贴线现场确认人员不能为空");
        this.validateRequired(pojo.getPressEqInspectionDone(), ERROR_KEY, "请选择压贴线每台设备点检表是否完成");
        if(JmlKit.FLAG_1.equals(pojo.getPressEqInspectionDone())){
            this.validateRequired(pojo.getPressEqInspectionDoneImg(), ERROR_KEY, "压贴线每台设备点检表图片不能为空");
        }

        this.validateRequired(pojo.getPressDailyMaintenanceDone(), ERROR_KEY, "请选择压贴线每台设备日保养表是否完成");
        if(JmlKit.FLAG_1.equals(pojo.getPressDailyMaintenanceDone())){
            this.validateRequired(pojo.getPressDailyMaintenanceDoneImg(), ERROR_KEY, "压贴线每台设备日保养表图片不能为空");
        }

        this.validateRequired(pojo.getPressAirPressureCheck(), ERROR_KEY, "请选择压贴线巡查空气压力是否达标");
        if(JmlKit.FLAG_1.equals(pojo.getPressAirPressureCheck())){
            this.validateRequired(pojo.getPressAirPressureCheckImg(), ERROR_KEY, "压贴线巡查空气压力图片不能为空");
        }

        this.validateRequired(pojo.getPressToolCheck(), ERROR_KEY, "请选择压贴线巡查铺纸房湿度是否在范围");
        if(JmlKit.FLAG_1.equals(pojo.getPressToolCheck())){
            this.validateRequired(pojo.getPressToolCheckImg(), ERROR_KEY, "压贴线巡查铺纸房湿度图片不能为空");
        }

        this.validateRequired(pojo.getPressSensorCheck(), ERROR_KEY, "请选择压贴线巡查液压站是否漏油");
        if(JmlKit.FLAG_1.equals(pojo.getPressSensorCheck())){
            this.validateRequired(pojo.getPressSensorCheckImg(), ERROR_KEY, "压贴线巡查液压站漏油图片不能为空");
        }

        this.validateRequired(pojo.getPressLocatorCheck(), ERROR_KEY, "请选择压贴线巡查下料电箱房间空调是否打开");
        if(JmlKit.FLAG_1.equals(pojo.getPressLocatorCheck())){
            this.validateRequired(pojo.getPressLocatorCheckImg(), ERROR_KEY, "压贴线巡查下料电箱房间空调图片不能为空");
        }

        this.validateRequired(pojo.getPressConveyorCleanliness(), ERROR_KEY, "请选择压贴线巡查压机油缸是否漏油");
        if(JmlKit.FLAG_1.equals(pojo.getPressConveyorCleanliness())){
            this.validateRequired(pojo.getPressConveyorCleanlinessImg(), ERROR_KEY, "压贴线巡查压机油缸漏油图片不能为空");
        }

        this.validateRequired(pojo.getPressBrushMachineCheck(), ERROR_KEY, "请选择压贴线巡查所有毛刷机是否开启");
        if(JmlKit.FLAG_1.equals(pojo.getPressBrushMachineCheck())){
            this.validateRequired(pojo.getPressBrushMachineCheckImg(), ERROR_KEY, "压贴线巡查所有毛刷机开启图片不能为空");
        }

        this.validateRequired(pojo.getPressBrushLoaderCheck(), ERROR_KEY, "请选择压贴线巡查上下料龙门吸盘是否完好");
        if(JmlKit.FLAG_1.equals(pojo.getPressBrushLoaderCheck())){
            this.validateRequired(pojo.getPressBrushLoaderCheckImg(), ERROR_KEY, "压贴线巡查上下料龙门吸盘图片不能为空");
        }
    }
    private void validateChamferSection(DailyInspectionReportPojo pojo) {
        this.validateRequired(pojo.getChamferInspectionDate(), ERROR_KEY, "倒角线巡查日期不能为空");
        this.validateRequired(pojo.getChamferInspectionStartTime(), ERROR_KEY, "倒角线巡查开始时间不能为空");
        this.validateRequired(pojo.getChamferInspectionEndTime(), ERROR_KEY, "倒角线巡查结束时间不能为空");
        this.validateRequired(pojo.getChamferConfirmStaffId(), ERROR_KEY, "倒角线现场确认人员不能为空");
        this.validateRequired(pojo.getChamferEqInspectionDone(), ERROR_KEY, "请选择倒角线每台设备点检表是否完成");
        if(JmlKit.FLAG_1.equals(pojo.getChamferEqInspectionDone())){
            this.validateRequired(pojo.getChamferEqInspectionDoneImg(), ERROR_KEY, "倒角线每台设备点检表图片不能为空");
        }

        this.validateRequired(pojo.getChamferDailyMaintenanceDone(), ERROR_KEY, "请选择倒角线每台设备日保养表是否完成");
        if(JmlKit.FLAG_1.equals(pojo.getChamferDailyMaintenanceDone())){
            this.validateRequired(pojo.getChamferDailyMaintenanceDoneImg(), ERROR_KEY, "倒角线每台设备日保养表图片不能为空");
        }

        this.validateRequired(pojo.getChamferAirPressureCheck(), ERROR_KEY, "请选择倒角线巡查空气压力是否达标");
        if(JmlKit.FLAG_1.equals(pojo.getChamferAirPressureCheck())){
            this.validateRequired(pojo.getChamferAirPressureCheckImg(), ERROR_KEY, "倒角线巡查空气压力图片不能为空");
        }

        this.validateRequired(pojo.getChamferToolCheck(), ERROR_KEY, "请选择倒角线巡查现场刀具是否完好");
        if(JmlKit.FLAG_1.equals(pojo.getChamferToolCheck())){
            this.validateRequired(pojo.getChamferToolCheckImg(), ERROR_KEY, "倒角线巡查刀具图片不能为空");
        }

        this.validateRequired(pojo.getChamferSensorCheck(), ERROR_KEY, "请选择倒角线巡查各个传感器位置是否正确");
        if(JmlKit.FLAG_1.equals(pojo.getChamferSensorCheck())){
            this.validateRequired(pojo.getChamferSensorCheckImg(), ERROR_KEY, "倒角线巡查传感器位置图片不能为空");
        }

        this.validateRequired(pojo.getChamferLocatorCheck(), ERROR_KEY, "请选择倒角线巡查上料分板器定位杆是否松动");
        if(JmlKit.FLAG_1.equals(pojo.getChamferLocatorCheck())){
            this.validateRequired(pojo.getChamferLocatorCheckImg(), ERROR_KEY, "倒角线巡查定位杆图片不能为空");
        }

        this.validateRequired(pojo.getChamferConveyorCleanliness(), ERROR_KEY, "请选择倒角线巡查传送带是否清洁");
        if(JmlKit.FLAG_1.equals(pojo.getChamferConveyorCleanliness())){
            this.validateRequired(pojo.getChamferConveyorCleanlinessImg(), ERROR_KEY, "倒角线巡查传送带图片不能为空");
        }

        this.validateRequired(pojo.getChamferBrushMachineCheck(), ERROR_KEY, "请选择倒角线巡查所有毛刷机是否开启");
        if(JmlKit.FLAG_1.equals(pojo.getChamferBrushMachineCheck())){
            this.validateRequired(pojo.getChamferBrushMachineCheckImg(), ERROR_KEY, "倒角线巡查毛刷机图片不能为空");
        }

        this.validateRequired(pojo.getChamferLoaderCheck(), ERROR_KEY, "请选择倒角线巡查上下料龙门吸盘是否完好");
        if(JmlKit.FLAG_1.equals(pojo.getChamferLoaderCheck())){
            this.validateRequired(pojo.getChamferLoaderCheckImg(), ERROR_KEY, "倒角线巡查上下料龙门吸盘图片不能为空");
        }
    }
    private void validatePrintLineSection(DailyInspectionReportPojo pojo) {
        this.validateRequired(pojo.getPrintLineInspectionDate(), ERROR_KEY, "打印线巡查日期不能为空");
        this.validateRequired(pojo.getPrintLineInspectionStartTime(), ERROR_KEY, "打印线巡查开始时间不能为空");
        this.validateRequired(pojo.getPrintLineInspectionEndTime(), ERROR_KEY, "打印线巡查结束时间不能为空");
        this.validateRequired(pojo.getPrintLineConfirmStaffId(), ERROR_KEY, "打印线现场确认人员不能为空");
        this.validateRequired(pojo.getPrintLineCompCheck(), ERROR_KEY, "请选择打印线巡查空压机是否开启");
        if(JmlKit.FLAG_1.equals(pojo.getPrintLineCompCheck())){
            this.validateRequired(pojo.getPrintLineCompCheckImg(), ERROR_KEY, "打印线巡查空压机是否开启图片不能为空");
        }

        this.validateRequired(pojo.getPrintLineEqInspectDone(), ERROR_KEY, "请选择打印线每台设备点检表是否完成");
        if(JmlKit.FLAG_1.equals(pojo.getPrintLineEqInspectDone())){
            this.validateRequired(pojo.getPrintLineEqInspectDoneImg(), ERROR_KEY, "打印线每台设备点检表是否完成图片不能为空");
        }

        this.validateRequired(pojo.getPrintLineDailyMaintDone(), ERROR_KEY, "请选择打印线每台设备日保养表是否完成");
        if(JmlKit.FLAG_1.equals(pojo.getPrintLineDailyMaintDone())){
            this.validateRequired(pojo.getPrintLineDailyMaintDoneImg(), ERROR_KEY, "打印线每台设备日保养表是否完成图片不能为空");
        }

        this.validateRequired(pojo.getPrintLineAirPressCheck(), ERROR_KEY, "请选择打印线巡查空气压力是否达标");
        if(JmlKit.FLAG_1.equals(pojo.getPrintLineAirPressCheck())){
            this.validateRequired(pojo.getPrintLineAirPressCheckImg(), ERROR_KEY, "打印线巡查空气压力是否达标图片不能为空");
        }

        this.validateRequired(pojo.getPrintLineBeltPosCheck(), ERROR_KEY, "请选择打印线巡查砂光机皮带传送带位置是否跑偏");
        if(JmlKit.FLAG_1.equals(pojo.getPrintLineBeltPosCheck())){
            this.validateRequired(pojo.getPrintLineBeltPosCheckImg(), ERROR_KEY, "打印线巡查砂光机皮带传送带位置是否跑偏图片不能为空");
        }

        this.validateRequired(pojo.getPrintLineGlueLeakCheck(), ERROR_KEY, "请选择打印线巡查辊涂机油泵是否漏油");
        if(JmlKit.FLAG_1.equals(pojo.getPrintLineGlueLeakCheck())){
            this.validateRequired(pojo.getPrintLineGlueLeakCheckImg(), ERROR_KEY, "打印线巡查辊涂机油泵是否漏油图片不能为空");
        }

        this.validateRequired(pojo.getPrintLineDustCheck(), ERROR_KEY, "请选择打印线巡查除尘废气是否开启");
        if(JmlKit.FLAG_1.equals(pojo.getPrintLineDustCheck())){
            this.validateRequired(pojo.getPrintLineDustCheckImg(), ERROR_KEY, "打印线巡查除尘废气是否开启图片不能为空");
        }

        this.validateRequired(pojo.getPrintLineRollerCheck(), ERROR_KEY, "请选择打印线巡查所有涂布机平辊是否完好");
        if(JmlKit.FLAG_1.equals(pojo.getPrintLineRollerCheck())){
            this.validateRequired(pojo.getPrintLineRollerCheckImg(), ERROR_KEY, "打印线巡查所有涂布机平辊是否完好图片不能为空");
        }

        this.validateRequired(pojo.getPrintLineTempCheck(), ERROR_KEY, "请选择打印线巡检打印房间温度是否达标");
        if(JmlKit.FLAG_1.equals(pojo.getPrintLineTempCheck())){
            this.validateRequired(pojo.getPrintLineTempCheckImg(), ERROR_KEY, "打印线巡检打印房间温度是否达标图片不能为空");
        }

        this.validateRequired(pojo.getPrintLineHopperCheck(), ERROR_KEY, "请选择打印线巡查上下料龙门吸盘是否完好");
        if(JmlKit.FLAG_1.equals(pojo.getPrintLineHopperCheck())){
            this.validateRequired(pojo.getPrintLineHopperCheckImg(), ERROR_KEY, "打印线巡查上下料龙门吸盘是否完好图片不能为空");
        }

        this.validateRequired(pojo.getPrintLineConveyorClean(), ERROR_KEY, "请选择打印线巡查传送带是否清洁");
        if(JmlKit.FLAG_1.equals(pojo.getPrintLineConveyorClean())){
            this.validateRequired(pojo.getPrintLineConveyorCleanImg(), ERROR_KEY, "打印线巡查传送带是否清洁图片不能为空");
        }
    }

    protected void validateRequired(String value, String errorKey, String errorMessage) {
        if (value == null || "".equals(value)) {
            this.addError(errorKey, errorMessage);
        }

    }
}
