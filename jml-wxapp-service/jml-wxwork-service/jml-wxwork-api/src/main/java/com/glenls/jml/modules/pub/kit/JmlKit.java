package com.glenls.jml.modules.pub.kit;

import com.glenls.commons.lang.idegen.TimeIdGeneratorKit;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.jfinal.plugin.activerecord.Model;
import io.jboot.Jboot;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Map;


public class JmlKit {
    private static final SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM");
    public static final String FLAG_1 = "1";

    public static final String FLAG_0 = "0";

    public static final String getSiteUrl(){
        return Jboot.configValue("site.url");
    }

    
    public static void setSaveModel(Model<? extends Model> model, Map<String,Object> paramsMap) {
        if (model != null) {
            model.set("id", TimeIdGeneratorKit.genTimeNo());
            model.set("created_staff_id",paramsMap.get("staffId"));
            model.set("update_staff_id",paramsMap.get("staffId"));
           
        }
    }

    
    public static void removeUpdateModel(Model<? extends Model> model) {
        model.remove("update_time");
    }

    
    public static String getLastMonth(String date) throws ParseException {
        Calendar cal = Calendar.getInstance();
        cal.setTime(sdf.parse(date));
        cal.add(Calendar.MONTH, -1);
        SimpleDateFormat dft = new SimpleDateFormat("yyyy-MM");
        return dft.format(cal.getTime());

    }

    
    public static String getPreMonth(String date) throws ParseException {
        Calendar cal = Calendar.getInstance();
        cal.setTime(sdf.parse(date));
        cal.add(Calendar.MONTH, 1);
        SimpleDateFormat dft = new SimpleDateFormat("yyyy-MM");
        return dft.format(cal.getTime());
    }

    
    public static String checkEdit(Map<String,Object> paramsMap,Model<? extends Model> model){
        StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
        String createdStaffId = model.get("created_staff_id");
        if(staffPojo.isRoleSR() && !staffPojo.getStaffId().equals(createdStaffId)){
            return FLAG_0;
        } else {
            return FLAG_1;
        }
    }

    
    public static void setFJobTypeAndProdLineOrDept(Model<? extends Model> model, Map<String,Object> paramsMap) {
        if (model != null) {
            StaffPojo staffPojo = (StaffPojo) paramsMap.get("staff");
            model.set("job_type",staffPojo.getJobType());
            model.set("prod_line_or_dept",staffPojo.getProdLineOrDept());
        }
    }
}
