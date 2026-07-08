package com.glenls.jml.kit;

import cn.hutool.core.util.ObjUtil;
import com.glenls.jml.model.SerialNumbersModel;
import com.jfinal.aop.Aop;
import com.jfinal.aop.Inject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;


public class GeneratorSerNoKit {
    private static final Object lock = new Object();
    private static SerialNumbersModel serialNumbersDao = Aop.get(SerialNumbersModel.class);
    public static String generateSerialNumber(String type,String prefix) {
        synchronized (lock) {
            int counter = 0;
            Map<String, Object> paramsMap = new HashMap<>();
            paramsMap.put("type", type);
            SerialNumbersModel serialNumbersModel = serialNumbersDao.querySerNoBy(paramsMap);
            if (ObjUtil.isNotEmpty(serialNumbersModel)) {
                counter = serialNumbersModel.getInt("counter") + 1;
            } else {
                counter = 1;
            }
            paramsMap.put("counter", counter);
            serialNumbersDao.updateNoByToday(paramsMap);
            String today = new SimpleDateFormat("yyMMdd").format(new Date());
            return prefix+"-" + today + "-" + String.format("%03d", counter);
        }
    }

    public static String generateFactorySN(String type,String prefix) {
        synchronized (lock) {
            int counter = 0;
            Map<String, Object> paramsMap = new HashMap<>();
            paramsMap.put("type", type);
            SerialNumbersModel serialNumbersModel = serialNumbersDao.querySerNoBy(paramsMap);
            if (ObjUtil.isNotEmpty(serialNumbersModel)) {
                counter = serialNumbersModel.getInt("counter") + 1;
            } else {
                counter = 1;
            }
            paramsMap.put("counter", counter);
            serialNumbersDao.updateNoByToday(paramsMap);
            String today = new SimpleDateFormat("yyyyMMdd").format(new Date());
            return prefix+"-" + today + "-" + String.format("%03d", counter);
        }
    }

    public static String generateFactorySN2(String type,String prefix) {
        synchronized (lock) {
            int counter = 0;
            Map<String, Object> paramsMap = new HashMap<>();
            paramsMap.put("type", type);
            SerialNumbersModel serialNumbersModel = serialNumbersDao.querySerNoBy(paramsMap);
            if (ObjUtil.isNotEmpty(serialNumbersModel)) {
                counter = serialNumbersModel.getInt("counter") + 1;
            } else {
                counter = 1;
            }
            paramsMap.put("counter", counter);
            serialNumbersDao.updateNoByToday(paramsMap);
            return prefix+ String.format("%03d", counter);
        }
    }

    public static String generateFactorySN3(String type,String prefix) {
        synchronized (lock) {
            int counter = 0;
            Map<String, Object> paramsMap = new HashMap<>();
            paramsMap.put("type", type);
            SerialNumbersModel serialNumbersModel = serialNumbersDao.querySerNoBy(paramsMap);
            if (ObjUtil.isNotEmpty(serialNumbersModel)) {
                counter = serialNumbersModel.getInt("counter") + 1;
            } else {
                counter = 1;
            }
            paramsMap.put("counter", counter);
            serialNumbersDao.updateNoByToday(paramsMap);
            String today = new SimpleDateFormat("yyMMdd").format(new Date());
            return prefix+today+ String.format("%03d", counter);
        }
    }
}
