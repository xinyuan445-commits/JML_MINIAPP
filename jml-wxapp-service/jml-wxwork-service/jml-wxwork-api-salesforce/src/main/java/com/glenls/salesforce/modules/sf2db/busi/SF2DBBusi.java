package com.glenls.salesforce.modules.sf2db.busi;

import cn.hutool.core.bean.BeanPath;
import cn.hutool.core.date.DateUtil;
import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.ReUtil;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.lang.thread.bean.ThreadPoolBean;
import com.glenls.commons.lang.thread.kit.ThreadPoolKit;
import com.glenls.salesforce.modules.pub.busi.SfInfBusi;
import com.glenls.salesforce.modules.sf2db.bean.*;
import com.glenls.salesforce.modules.sf2db.model.ConfSF2DBDetailModel;
import com.glenls.salesforce.modules.sf2db.model.ConfSF2DBModel;
import com.jfinal.aop.Inject;
import com.jfinal.kit.JsonKit;
import com.jfinal.plugin.activerecord.Db;
import com.jfinal.plugin.activerecord.Record;
import lombok.extern.log4j.Log4j;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ThreadPoolExecutor;


@Log4j
public class SF2DBBusi {
    
    private static final String REG_JSON_OBJ = "^\\{.+\\}$";
    
    private static final String REG_JSON_ARRAY = "^\\[.+\\]$";

    
    public static final String FLAG_N = "N";

    
    public static final String FLAG_Y = "Y";

    private static final ThreadPoolExecutor executor = ThreadUtil.newExecutor(5,10);

    @Inject
    private ConfSF2DBDetailModel confSFAWSDetailDao;

    @Inject
    private ConfSF2DBModel confSF2DBDao;

    @Inject
    private SfInfBusi sfInfBusi;


    
    public RestApiResult del(Sf2DbDelPojo pojo){
        List<Sf2DbDelDetailPojo> list = pojo.getList();
        if(CollectionUtils.isEmpty(list)){
            return RestApiResult.newFail("需要删除的数据为空");
        }
        for(Sf2DbDelDetailPojo detailPojo : list){
            String code = detailPojo.getObjCode();
            if(StringUtils.isEmpty(code)){
                continue;
            }

            List<String> sfidList = detailPojo.getSfidList();
            if(CollectionUtils.isEmpty(sfidList)){
                continue;
            }
            ConfSF2DBModel confModel = confSF2DBDao.queryByCode(code);
            if(confModel == null){
                continue;
            }
            String sfidKey  = confModel.get("sfidName");
            String sql = "delete from " + confModel.get("tbname") + " where " + sfidKey + "=?";
            String cols = sfidKey;

            List<Record> recordList = new ArrayList<>();
            for (String sfid : sfidList){
                Record record = new Record();
                record.set(sfidKey,sfid);

                recordList.add(record);
            }

            Db.batch(sql,cols,recordList,AppKit.BATCH_SIZE);
        }

        return RestApiResult.newSuccess();
    }


    
    public Sf2DbParsePojo getData(String code,String rawData){
        Sf2DbInPojo pojo = new Sf2DbInPojo();
        pojo.setData(rawData);

        Sf2DbParsePojo parsePojo = new Sf2DbParsePojo();
        parsePojo.setData(pojo);
        parsePojo.setObjCode(code);

        return parsePojo;
    }

    
    public RestApiResult save(String code){
        return save(code,1,1000);
    }

    
    public RestApiResult save(String code,int pageNo,int pageSize){
        ConfSF2DBModel model = confSF2DBDao.queryByCode(code);
        if(model == null){
            return RestApiResult.newFail("同步失败，未找到同步对象");
        }

        String uri = model.get("sfUrl");
        String sql = model.get("sfSql");

        if(StringUtils.isEmpty(uri) || StringUtils.isEmpty(sql)){
            return RestApiResult.newFail("对象：" + code + "参数配置不全，不能进行同步");
        }
        String url = new StringBuffer(uri).append("?q=").append(sql).toString();

        RestApiResult sfGetResult = sfInfBusi.getToResult(url);
        if(sfGetResult.isFail()){
            return RestApiResult.newFail("对象：" + code + "请求出错，错误原因" + sfGetResult.getData());
        }

        JSONObject retJson = JSON.parseObject( (String) sfGetResult.getData());
        JSONArray retDataArray = retJson.getJSONArray("records");

        RestApiResult saveResult = save(code,JSON.toJSONString(retDataArray));
        if(!retJson.getBoolean("done")){
            save(code,pageNo+1,pageSize);
        }

        return saveResult;
    }

    
    public RestApiResult save(String code,String rawData){
        return save(getData(code,rawData));
    }

    
    public RestApiResult save(Sf2DbParsePojo pojo){
        String code = pojo.getObjCode();
        RestApiResult result4Parse = parseData(pojo);
        if(result4Parse.isFail()){
            return result4Parse;
        }
        RestApiResult result4Check = checkData(pojo);
        if(result4Check.isFail()){
            Sf2DbCheckPojo checkPojo = (Sf2DbCheckPojo) result4Check.getData();
            RestApiResult restApiResult = RestApiResult.newFail(result4Check.getMsg());
            restApiResult.setData(checkPojo.getFail());
            return restApiResult;
        }
        RestApiResult result4Db = generateDbData(result4Check);
        if(result4Db.isFail()){
            return result4Db;
        }
        RestApiResult result4Save = saveData2Db(code,result4Db);

        Sf2DbCheckPojo checkPojo = (Sf2DbCheckPojo) result4Check.getData();
        List<JSONObject> checkFailList = checkPojo.getFail();

        updateStatusToSF(pojo,checkPojo);

        if(CollectionUtils.isNotEmpty(checkFailList)){
            log.error("校验失败的数据：" + JSON.toJSONString(checkFailList));
            return RestApiResult.newFailWithData(checkFailList).setMsg("成功数据：" + checkPojo.getSuccess().size()+"，失败数据：" + checkPojo.getSuccess().size());
        }

        return result4Save;
    }

    
    private void updateStatusToSF(Sf2DbParsePojo pojo,Sf2DbCheckPojo checkPojo){
        String objCode = pojo.getObjCode();


        List<JSONObject> checkFailList = checkPojo.getFail();
        List<JSONObject> checkSuccessList = checkPojo.getSuccess();

        List<JSONObject> record4updateList = new ArrayList<>();

        if(CollectionUtils.isNotEmpty(checkSuccessList)){
            for(JSONObject jsonObj : checkSuccessList){
                Object sfObjCode = new BeanPath("attributes.type").get(jsonObj);
                JSONObject attributesJson = new JSONObject();
                attributesJson.put("type",sfObjCode);

                JSONObject recordObj = new JSONObject();
                recordObj.put("attributes",attributesJson);
                recordObj.put("id",jsonObj.get("Id"));
                recordObj.put("SyncStatus__c","2");
                recordObj.put("SyncInfo__c","同步成功");

                record4updateList.add(recordObj);
            }
        }

        if(CollectionUtils.isNotEmpty(checkFailList)){
            for(JSONObject jsonObj : checkFailList){
                Object sfObjCode = new BeanPath("attributes.type").get(jsonObj);
                JSONObject attributesJson = new JSONObject();
                attributesJson.put("type",sfObjCode);

                JSONObject recordObj = new JSONObject();
                recordObj.put("attributes",attributesJson);
                recordObj.put("id",jsonObj.get("Id"));
                recordObj.put("SyncStatus__c","3");
                RestApiResult checkRet = jsonObj.getObject("checkRet", RestApiResult.class);
                recordObj.put("SyncInfo__c", checkRet != null ? checkRet.getMsg() : "同步失败");

                record4updateList.add(recordObj);
            }
        }

        if(CollectionUtils.isEmpty(record4updateList)){
            return ;
        }

        JSONObject updateStatusObj = new JSONObject();
        updateStatusObj.put("allOrNone",false);
        updateStatusObj.put("records",record4updateList);

        String url = "/services/data/v57.0/composite/sobjects/";
        RestApiResult restApiResult = sfInfBusi.patchToResult(url, JsonKit.toJson(updateStatusObj));
        log.info("更新同步状态结果：" + JsonKit.toJson(restApiResult));
    }

    
    private RestApiResult saveData2Db(String code,RestApiResult result4Db){
        ConfSF2DBModel model = confSF2DBDao.queryByCode(code);

        final String tbname = model.get("tbname");
        final String priKeyName = model.get("priKeyName");
        final String sfidName = model.get("sfidName");

        final List<Record> recordList = (List<Record>) result4Db.getData();
        final List<String> sfidList = new ArrayList<>();

        for (Record record : recordList){
            String sfid = record.get(sfidName);

            sfidList.add(sfid);
        }

        final List<Record> existRecordList = new CopyOnWriteArrayList<>();

        if(sfidList.size() <= AppKit.BATCH_SIZE){
            Map<String, Object> paramsMap = new HashMap<>();
            paramsMap.put("tbname",tbname);
            paramsMap.put("priKeyName",priKeyName);
            paramsMap.put("sfidName",sfidName);
            paramsMap.put("sfidList",sfidList);

            existRecordList.addAll(confSFAWSDetailDao.findForXmlWithDb("sf_to_db.query4Batch",paramsMap));
        }else{
            ThreadPoolBean threadPoolBean = ThreadPoolKit.initData(sfidList,AppKit.BATCH_SIZE);
            CountDownLatch countDownLatch = threadPoolBean.getCountDownLatch();
            int page = threadPoolBean.getPage();
            ThreadPoolExecutor threadPoolExecutor = ThreadPoolKit.initThreadPool();

            for (int i = 0; i < page; i++) {
                final int currentPage = i;
                threadPoolExecutor.execute(new Runnable() {
                    @Override
                    public void run() {
                        try{
                            Map<String, Object> paramsMap = new HashMap<>();
                            paramsMap.put("tbname",tbname);
                            paramsMap.put("priKeyName",priKeyName);
                            paramsMap.put("sfidName",sfidName);

                            List<String> subSfidList = ThreadPoolKit.subList(sfidList,threadPoolBean,currentPage);
                            paramsMap.put("sfidList",subSfidList);

                            existRecordList.addAll(confSFAWSDetailDao.findForXmlWithDb("sf_to_db.query4Batch",paramsMap));
                        }catch (Exception e){
                            log.error(e.getMessage(),e);
                        }finally {
                            countDownLatch.countDown();
                        }
                    }
                });
            }

            ThreadPoolKit.awaitAndShutdown(threadPoolExecutor,countDownLatch);
        }

        List<Record> insertList = new ArrayList<>();
        List<Record> updateList = new ArrayList<>();

        for(Record record : recordList){
            String sfid = record.get(sfidName);
            boolean exist = false;

            if(CollectionUtils.isNotEmpty(existRecordList)){
                for (Record existRecord : existRecordList){
                    String sfidExists = existRecord.get(sfidName);
                    if(StringUtils.equals(sfidExists,sfid)){
                        exist = true;
                        record.setColumns(existRecord);
                        record = record.setColumns(existRecord);
                        updateList.add(record);
                        break;
                    }
                }
            }

            if(!exist){
                insertList.add(record);
            }
        }

        if(CollectionUtils.isNotEmpty(updateList)){
            Db.batchUpdate(tbname,updateList,AppKit.BATCH_SIZE);
        }
        if(CollectionUtils.isNotEmpty(insertList)){
            Db.batchSave(tbname,insertList,AppKit.BATCH_SIZE);
        }

        return RestApiResult.newSuccess();
    }

    
    private RestApiResult generateDbData(RestApiResult result4Check){
        Sf2DbCheckPojo pojo = (Sf2DbCheckPojo) result4Check.getData();
        List<JSONObject> list = pojo.getSuccess();
        List<ConfSF2DBDetailModel> confList = pojo.getConfList();

        List<Record> recordList = new ArrayList<>();
        for(JSONObject jsonObj : list){
            Record record = new Record();
            for(ConfSF2DBDetailModel model : confList){
                String attrCode = model.getStr("attr_code");
                String sfAttrCode = model.getStr("sf_attr_code");
                String flagRequire = model.get("flag_require");
                String fixedVal = model.get("fixed_val");
                String flagSync = model.get("flag_sync");
                String dataType = model.get("data_type");
                String format_str = model.getStr("format_str");

                if(FLAG_N.equals(flagSync)){
                    continue;
                }
                if(StringUtils.isNotEmpty(fixedVal)){
                    record.set(attrCode,fixedVal);
                    continue;
                }

                Object attrVal =  new BeanPath(sfAttrCode).get(jsonObj);

                if(StringUtils.isNotEmpty(format_str)){
                    try {
                        record.set(attrCode, DateUtil.parse((CharSequence) attrVal,format_str));
                    }catch (Exception e){
                        log.error(e.getMessage(),e);
                    }
                    continue;
                }

                record.set(attrCode,attrVal);
            }
            recordList.add(record);
        }

        if(CollectionUtils.isEmpty(recordList)){
            return RestApiResult.newFail("生成的入库数据为空");
        }

        return RestApiResult.newSuccessWithData(recordList);
    }

    
    private RestApiResult checkData(Sf2DbParsePojo pojo){
        String code = pojo.getObjCode();
        List<ConfSF2DBDetailModel> modelList = confSFAWSDetailDao.queryByCode(code);
        if(CollectionUtils.isEmpty(modelList)){
            return RestApiResult.newFail("接口配置参数为空");
        }

        List<JSONObject> successList = new ArrayList<>();
        List<JSONObject> failList = new ArrayList<>();

        JSONArray jsonArray = pojo.getDataArray();
        if(CollectionUtils.isEmpty(jsonArray)){
            return RestApiResult.newFail("待检查的数据为空");
        }
        int jsonArraySize = jsonArray.size();
        for (int i = 0; i < jsonArraySize; i++) {
            JSONObject jsonObj = jsonArray.getJSONObject(i);
            RestApiResult checkRet = checkData4Single(jsonObj,modelList);
            if(checkRet.isSuccess()){
                successList.add(jsonObj);
            }
            if(checkRet.isFail()){
                jsonObj.put("checkRet",checkRet);
                failList.add(jsonObj);
            }
        }

        Sf2DbCheckPojo checkPojo = new Sf2DbCheckPojo();
        checkPojo.setFail(failList);
        checkPojo.setSuccess(successList);
        checkPojo.setConfList(modelList);

        if(CollectionUtils.isEmpty(successList)){
            RestApiResult checkRet = RestApiResult.newFail("校验错误");
            checkRet.setData(checkPojo);
            return checkRet;
        }

        return RestApiResult.newSuccessWithData(checkPojo);
    }

    
    private RestApiResult checkData4Single(JSONObject jsonObj,List<ConfSF2DBDetailModel> modelList){
        for (ConfSF2DBDetailModel model : modelList){
            String attrCode = model.getStr("attr_code");
            String sfAttrCode = model.getStr("sf_attr_code");
            String flagSync = model.get("flag_sync");
            String flagRequire = model.get("flag_require");
            Integer attrLen = model.get("attr_len");
            String fixedVal = model.get("fixed_val");
            String regCheck = model.get("reg_check");

            boolean isRequire = FLAG_Y.equals(flagRequire) && FLAG_Y.equals(flagSync) && StringUtils.isEmpty(fixedVal);

            if(StringUtils.isNotEmpty(fixedVal)){
                jsonObj.put("fixedVal",fixedVal);
            }
            jsonObj.put("flagSync",flagSync);

            Object attrVal = new BeanPath(sfAttrCode).get(jsonObj);
            if(isRequire && attrVal == null){
                return RestApiResult.newFail("参数：" + attrCode + "必填");
            }
            if(attrVal instanceof String){
                String attrValStr = String.valueOf(attrVal);
                if(isRequire && StringUtils.isEmpty(attrValStr)){
                    return RestApiResult.newFail("参数：" + attrCode + "必填");
                }
                if(attrLen != null && StringUtils.length(attrValStr) > attrLen){
                    return RestApiResult.newFail("参数：" + attrCode + "长度不符合要求，长度最大要求为" + attrLen);
                }
                if(StringUtils.isNotEmpty(regCheck) && !ReUtil.isMatch(regCheck,attrValStr)){
                    return RestApiResult.newFail("参数：" + attrCode + "不符合配置的正则表达式要求");
                }
            }
        }

        return RestApiResult.newSuccess();
    }

    
    private RestApiResult parseData(Sf2DbParsePojo pojo){
        String dataStr = pojo.getData().getData();
        boolean isJsonObj = ReUtil.isMatch(REG_JSON_OBJ,dataStr);
        boolean isJsonArray = ReUtil.isMatch(REG_JSON_ARRAY,dataStr);

        if(!isJsonArray && !isJsonObj){
            return RestApiResult.newFail("数据为空");
        }

        try{
            JSONArray jsonArray = new JSONArray();
            if(isJsonObj){
                JSONObject jsonObj = JSON.parseObject(dataStr);
                jsonArray.add(jsonObj);
            }
            if(isJsonArray){
                jsonArray = JSON.parseArray(dataStr);
            }

            if(CollectionUtils.isEmpty(jsonArray)){
                return RestApiResult.newFail("数据为空");
            }

            pojo.setDataArray(jsonArray);
        }catch (Exception e){
            log.error(e.getMessage());
        }
        return RestApiResult.newSuccess();
    }

    public static void main(String[] args) {
        System.out.println(ReUtil.isMatch("^\\[.+\\]$","[中文]"));
    }
}
