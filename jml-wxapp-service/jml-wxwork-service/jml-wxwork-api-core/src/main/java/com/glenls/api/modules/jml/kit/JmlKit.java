package com.glenls.api.modules.jml.kit;

import com.glenls.commons.lang.idegen.TimeIdGeneratorKit;
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
}
