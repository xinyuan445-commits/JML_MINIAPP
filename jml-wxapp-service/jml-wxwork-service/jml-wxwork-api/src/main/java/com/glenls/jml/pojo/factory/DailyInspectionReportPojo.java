package com.glenls.jml.pojo.factory;

import com.glenls.jml.bean.Column;
import lombok.Data;


@Data
public class DailyInspectionReportPojo {
    @Column("id")
    private String id;  


    @Column("eb_skin_inspection_date")
    private String ebSkinInspectionDate;  

    @Column("eb_skin_inspection_start_time")
    private String ebSkinInspectionStartTime;  

    @Column("eb_skin_inspection_end_time")
    private String ebSkinInspectionEndTime;  

    @Column("eb_skin_confirm_staff_id")
    private String ebSkinConfirmStaffId;  

    @Column("press_inspection_date")
    private String pressInspectionDate;  

    @Column("press_inspection_start_time")
    private String pressInspectionStartTime;  

    @Column("press_inspection_end_time")
    private String pressInspectionEndTime;  

    @Column("press_confirm_staff_id")
    private String pressConfirmStaffId;  

    @Column("chamfer_inspection_date")
    private String chamferInspectionDate;  

    @Column("chamfer_inspection_start_time")
    private String chamferInspectionStartTime;  

    @Column("chamfer_inspection_end_time")
    private String chamferInspectionEndTime;  

    @Column("chamfer_confirm_staff_id")
    private String chamferConfirmStaffId;  

    @Column("print_line_inspection_date")
    private String printLineInspectionDate;  

    @Column("print_line_inspection_start_time")
    private String printLineInspectionStartTime;  

    @Column("print_line_inspection_end_time")
    private String printLineInspectionEndTime;  

    @Column("print_line_confirm_staff_id")
    private String printLineConfirmStaffId;  

    @Column("inspector_staff_id")
    private String inspectorStaffId;  

    @Column("inspection_prod_line")
    private String inspectionProdLine;  

    @Column("eb_skin_comp_check")
    private String ebSkinCompCheck;  

    @Column("eb_skin_comp_check_sol")
    private String ebSkinCompCheckSol;  

    @Column("eb_skin_comp_check_img")
    private String ebSkinCompCheckImg;  

    @Column("eb_skin_eq_inspect_done")
    private String ebSkinEqInspectDone;  

    @Column("eb_skin_eq_inspect_done_sol")
    private String ebSkinEqInspectDoneSol;  

    @Column("eb_skin_eq_inspect_done_img")
    private String ebSkinEqInspectDoneImg;  

    @Column("eb_skin_daily_maint_done")
    private String ebSkinDailyMaintDone;  

    @Column("eb_skin_daily_maint_done_sol")
    private String ebSkinDailyMaintDoneSol;  

    @Column("eb_skin_daily_maint_done_img")
    private String ebSkinDailyMaintDoneImg;  

    @Column("eb_skin_air_press_check")
    private String ebSkinAirPressCheck;  

    @Column("eb_skin_air_press_check_sol")
    private String ebSkinAirPressCheckSol;  

    @Column("eb_skin_air_press_check_img")
    private String ebSkinAirPressCheckImg;  

    @Column("eb_skin_belt_pos_check")
    private String ebSkinBeltPosCheck;  

    @Column("eb_skin_belt_pos_check_sol")
    private String ebSkinBeltPosCheckSol;  

    @Column("eb_skin_belt_pos_check_img")
    private String ebSkinBeltPosCheckImg;  

    @Column("eb_skin_blade_check")
    private String ebSkinBladeCheck;  

    @Column("eb_skin_blade_check_sol")
    private String ebSkinBladeCheckSol;  

    @Column("eb_skin_blade_check_img")
    private String ebSkinBladeCheckImg;  

    @Column("eb_skin_glue_leak_check")
    private String ebSkinGlueLeakCheck;  

    @Column("eb_skin_glue_leak_check_sol")
    private String ebSkinGlueLeakCheckSol;  

    @Column("eb_skin_glue_leak_check_img")
    private String ebSkinGlueLeakCheckImg;  

    @Column("eb_skin_coater_check")
    private String ebSkinCoaterCheck;  

    @Column("eb_skin_coater_check_sol")
    private String ebSkinCoaterCheckSol;  

    @Column("eb_skin_coater_check_img")
    private String ebSkinCoaterCheckImg;  

    @Column("eb_skin_loader_check")
    private String ebSkinLoaderCheck;  

    @Column("eb_skin_loader_check_sol")
    private String ebSkinLoaderCheckSol;  

    @Column("eb_skin_loader_check_img")
    private String ebSkinLoaderCheckImg;  

    @Column("eb_skin_curing_box_check")
    private String ebSkinCuringBoxCheck;  

    @Column("eb_skin_curing_box_check_sol")
    private String ebSkinCuringBoxCheckSol;  

    @Column("eb_skin_curing_box_check_img")
    private String ebSkinCuringBoxCheckImg;  

    @Column("eb_skin_conv_cleanliness")
    private String ebSkinConvCleanliness;  

    @Column("eb_skin_conv_cleanliness_sol")
    private String ebSkinConvCleanlinessSol;  

    @Column("eb_skin_conv_cleanliness_img")
    private String ebSkinConvCleanlinessImg;  

    @Column("press_eq_inspection_done")
    private String pressEqInspectionDone;  

    @Column("press_eq_inspection_done_sol")
    private String pressEqInspectionDoneSol;  

    @Column("press_eq_inspection_done_img")
    private String pressEqInspectionDoneImg;  

    @Column("press_daily_maintenance_done")
    private String pressDailyMaintenanceDone;  

    @Column("press_daily_maintenance_done_sol")
    private String pressDailyMaintenanceDoneSol;  

    @Column("press_daily_maintenance_done_img")
    private String pressDailyMaintenanceDoneImg;  

    @Column("press_air_pressure_check")
    private String pressAirPressureCheck;  

    @Column("press_air_pressure_check_sol")
    private String pressAirPressureCheckSol;  

    @Column("press_air_pressure_check_img")
    private String pressAirPressureCheckImg;  

    @Column("press_tool_check")
    private String pressToolCheck;  

    @Column("press_tool_check_sol")
    private String pressToolCheckSol;  

    @Column("press_tool_check_img")
    private String pressToolCheckImg;  

    @Column("press_sensor_check")
    private String pressSensorCheck;  

    @Column("press_sensor_check_sol")
    private String pressSensorCheckSol;  

    @Column("press_sensor_check_img")
    private String pressSensorCheckImg;  

    @Column("press_locator_check")
    private String pressLocatorCheck;  

    @Column("press_locator_check_sol")
    private String pressLocatorCheckSol;  

    @Column("press_locator_check_img")
    private String pressLocatorCheckImg;  

    @Column("press_conveyor_cleanliness")
    private String pressConveyorCleanliness;  

    @Column("press_conveyor_cleanliness_sol")
    private String pressConveyorCleanlinessSol;  

    @Column("press_conveyor_cleanliness_img")
    private String pressConveyorCleanlinessImg;  

    @Column("press_brush_machine_check")
    private String pressBrushMachineCheck;  

    @Column("press_brush_machine_check_sol")
    private String pressBrushMachineCheckSol;  

    @Column("press_brush_machine_check_img")
    private String pressBrushMachineCheckImg;  

    @Column("press_brush_loader_check")
    private String pressBrushLoaderCheck;  

    @Column("press_brush_loader_check_sol")
    private String pressBrushLoaderCheckSol;  

    @Column("press_brush_loader_check_img")
    private String pressBrushLoaderCheckImg;  

    @Column("chamfer_eq_inspection_done")
    private String chamferEqInspectionDone;  

    @Column("chamfer_eq_inspection_done_sol")
    private String chamferEqInspectionDoneSol;  

    @Column("chamfer_eq_inspection_done_img")
    private String chamferEqInspectionDoneImg;  

    @Column("chamfer_daily_maintenance_done")
    private String chamferDailyMaintenanceDone;  

    @Column("chamfer_daily_maintenance_done_sol")
    private String chamferDailyMaintenanceDoneSol;  

    @Column("chamfer_daily_maintenance_done_img")
    private String chamferDailyMaintenanceDoneImg;  

    @Column("chamfer_air_pressure_check")
    private String chamferAirPressureCheck;  

    @Column("chamfer_air_pressure_check_sol")
    private String chamferAirPressureCheckSol;  

    @Column("chamfer_air_pressure_check_img")
    private String chamferAirPressureCheckImg;  

    @Column("chamfer_tool_check")
    private String chamferToolCheck;  

    @Column("chamfer_tool_check_sol")
    private String chamferToolCheckSol;  

    @Column("chamfer_tool_check_img")
    private String chamferToolCheckImg;  

    @Column("chamfer_sensor_check")
    private String chamferSensorCheck;  

    @Column("chamfer_sensor_check_sol")
    private String chamferSensorCheckSol;  

    @Column("chamfer_sensor_check_img")
    private String chamferSensorCheckImg;  

    @Column("chamfer_locator_check")
    private String chamferLocatorCheck;  

    @Column("chamfer_locator_check_sol")
    private String chamferLocatorCheckSol;  

    @Column("chamfer_locator_check_img")
    private String chamferLocatorCheckImg;  

    @Column("chamfer_conveyor_cleanliness")
    private String chamferConveyorCleanliness;  

    @Column("chamfer_conveyor_cleanliness_sol")
    private String chamferConveyorCleanlinessSol;  

    @Column("chamfer_conveyor_cleanliness_img")
    private String chamferConveyorCleanlinessImg;  

    @Column("chamfer_brush_machine_check")
    private String chamferBrushMachineCheck;  

    @Column("chamfer_brush_machine_check_sol")
    private String chamferBrushMachineCheckSol;  

    @Column("chamfer_brush_machine_check_img")
    private String chamferBrushMachineCheckImg;  

    @Column("chamfer_loader_check")
    private String chamferLoaderCheck;  

    @Column("chamfer_loader_check_sol")
    private String chamferLoaderCheckSol;  

    @Column("chamfer_loader_check_img")
    private String chamferLoaderCheckImg;  

    @Column("inspection_status")
    private String inspectionStatus; 

    @Column("print_line_comp_check")
    private String printLineCompCheck; 

    @Column("print_line_comp_check_sol")
    private String printLineCompCheckSol; 

    @Column("print_line_comp_check_img")
    private String printLineCompCheckImg; 

    @Column("print_line_eq_inspect_done")
    private String printLineEqInspectDone; 

    @Column("print_line_eq_inspect_done_sol")
    private String printLineEqInspectDoneSol; 

    @Column("print_line_eq_inspect_done_img")
    private String printLineEqInspectDoneImg; 

    @Column("print_line_daily_maint_done")
    private String printLineDailyMaintDone; 

    @Column("print_line_daily_maint_done_sol")
    private String printLineDailyMaintDoneSol; 

    @Column("print_line_daily_maint_done_img")
    private String printLineDailyMaintDoneImg; 

    @Column("print_line_air_press_check")
    private String printLineAirPressCheck; 

    @Column("print_line_air_press_check_sol")
    private String printLineAirPressCheckSol; 

    @Column("print_line_air_press_check_img")
    private String printLineAirPressCheckImg; 

    @Column("print_line_belt_pos_check")
    private String printLineBeltPosCheck; 

    @Column("print_line_belt_pos_check_sol")
    private String printLineBeltPosCheckSol; 

    @Column("print_line_belt_pos_check_img")
    private String printLineBeltPosCheckImg; 

    @Column("print_line_glue_leak_check")
    private String printLineGlueLeakCheck; 

    @Column("print_line_glue_leak_check_sol")
    private String printLineGlueLeakCheckSol; 

    @Column("print_line_glue_leak_check_img")
    private String printLineGlueLeakCheckImg; 

    @Column("print_line_dust_check")
    private String printLineDustCheck; 

    @Column("print_line_dust_check_sol")
    private String printLineDustCheckSol; 

    @Column("print_line_dust_check_img")
    private String printLineDustCheckImg; 

    @Column("print_line_roller_check")
    private String printLineRollerCheck; 

    @Column("print_line_roller_check_sol")
    private String printLineRollerCheckSol; 

    @Column("print_line_roller_check_img")
    private String printLineRollerCheckImg; 

    @Column("print_line_temp_check")
    private String printLineTempCheck; 

    @Column("print_line_temp_check_sol")
    private String printLineTempCheckSol; 

    @Column("print_line_temp_check_img")
    private String printLineTempCheckImg; 

    @Column("print_line_hopper_check")
    private String printLineHopperCheck; 

    @Column("print_line_hopper_check_sol")
    private String printLineHopperCheckSol; 

    @Column("print_line_hopper_check_img")
    private String printLineHopperCheckImg; 

    @Column("print_line_conveyor_clean")
    private String printLineConveyorClean; 

    @Column("print_line_conveyor_clean_sol")
    private String printLineConveyorCleanSol; 

    @Column("print_line_conveyor_clean_img")
    private String printLineConveyorCleanImg; 

}
