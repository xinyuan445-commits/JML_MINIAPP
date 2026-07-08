package com.glenls.jml.kit;

import cn.hutool.core.util.ObjUtil;
import cn.hutool.core.util.ReflectUtil;
import com.alibaba.fastjson.JSONObject;
import com.glenls.jml.bean.Column;
import com.jfinal.plugin.activerecord.Model;
import com.jfinal.plugin.activerecord.Table;


import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class BeanModelKit {

    public static JSONObject transform(JSONObject body,Class clazz) {

        Field[] fields = clazz.getDeclaredFields();
        Map<String, String> fieldsMap = new HashMap<>(fields.length);
        for (Field field : fields) {
            Column annotation = field.getAnnotation(Column.class);
            if (annotation == null){continue;}
            String value = annotation.value();
            fieldsMap.put(field.getName(), value);
        }
        JSONObject jsonObject = new JSONObject(body.size());
        body.forEach((key, value) -> jsonObject.put(fieldsMap.getOrDefault(key, key), value));
        return jsonObject;
    }

    public static <T extends Model<?>> T printProperties(Object obj, Class<T> modeClazz) {
        return printProperties(obj, modeClazz, false);
    }


    public static <T extends Model<?>> T printProperties(Object obj, Class<T> modeClazz, boolean ignoreNull) {
        Class<?> clazz = obj.getClass();
        Model<?> model = ReflectUtil.newInstance(modeClazz);
        Object tableObj = ReflectUtil.invoke(model, "_getTable");
        Table table = null;
        if (tableObj != null) {
            table = (Table) tableObj;
        }


        for (Field field : clazz.getDeclaredFields()) {
            if (field.isAnnotationPresent(Column.class)) {
                Column keyValue = field.getAnnotation(Column.class);
                String key = keyValue.value();
                Object fieldValue = ReflectUtil.getFieldValue(obj, field);
                if (ignoreNull && ObjUtil.isEmpty(fieldValue)) {
                    continue;
                }
                if (table != null && table.hasColumnLabel(key)) {
                    model.set(key, fieldValue);
                } else {
                    model.put(key, fieldValue);
                }
            }
        }
        return (T) model;
    }


    public static <T extends Model<?>> List<T> praseList(List<Object> objs, Class<T> modeClazz, boolean ignoreNull) {
        List<T> modelList = new ArrayList<>();
        for (Object obj : objs) {
            T model = printProperties(obj, modeClazz, ignoreNull);
            modelList.add(model);
        }
        return modelList;
    }
}
