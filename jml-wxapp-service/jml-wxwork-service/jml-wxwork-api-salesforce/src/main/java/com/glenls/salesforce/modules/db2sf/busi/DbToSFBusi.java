package com.glenls.salesforce.modules.db2sf.busi;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.ArrayUtil;
import cn.hutool.http.HttpStatus;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.glenls.commons.jfinal.kit.EnjoyKit;
import com.glenls.commons.jfinal.kit.ExceptionKit;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.commons.lang.thread.bean.ThreadPoolBean;
import com.glenls.commons.lang.thread.kit.ThreadPoolKit;
import com.glenls.commons.salesforce.kit.SFKit;
import com.glenls.salesforce.modules.log.busi.LogDbSFBusi;
import com.glenls.salesforce.modules.pub.busi.SfInfBusi;
import com.glenls.salesforce.modules.pub.kit.SalesforceKit;
import com.glenls.salesforce.modules.db2sf.model.SfSyncConfDbSfDetailModel;
import com.glenls.salesforce.modules.db2sf.model.SfSyncConfDbSfModel;
import com.glenls.salesforce.modules.db2sf.pojo.Db2SFConfPojo;
import com.glenls.salesforce.modules.db2sf.pojo.DbRecordPojo;
import com.glenls.salesforce.modules.log.pojo.LogDbToSFPojo;
import com.glenls.salesforce.modules.db2sf.pojo.UpdateDbAttrPojo;
import com.jfinal.aop.Inject;
import com.jfinal.kit.JsonKit;
import com.jfinal.plugin.activerecord.Db;
import com.jfinal.plugin.activerecord.Record;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.RandomStringUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


@Slf4j
public class DbToSFBusi {
    
    public static final String SF_RET_SUCCESS = "1";

    
    public static final String SF_RET_FAIL = "0";

    private ThreadPoolExecutor threadPoolExecutor = ThreadUtil.newExecutor(5,10);

    @Inject
    private ConfDbSfBusi confDbSfBusi;

    @Inject
    private SfInfBusi sfInfBusi;

    @Inject
    private LogDbSFBusi logDbSFBusi;

    @Inject
    private DbToSFScheduleBusi dbToSFScheduleBusi;


    public void sendByDbId(String code, String dbid){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("dbid",dbid);

        send(code,paramsMap);
    }


    public void send(String code, final List<Object> idList){
        if(CollectionUtils.isEmpty(idList)){
            return ;
        }
        final ThreadPoolBean threadPoolBean = ThreadPoolKit.initData(idList,25,false);
        final int totalPage = threadPoolBean.getPage();

        for (int i = 0; i < totalPage; i++) {
            final int currentPage = i;
            try{
                List<Object> subList = ThreadPoolKit.subList(idList,threadPoolBean,currentPage);
                Map<String, Object> paramsMap = new HashMap<>();
                paramsMap.put("idList",JSON.parseArray(JSON.toJSONString(subList),Object.class));
                send(code,paramsMap);
            }catch (Exception e){
                log.error(e.getMessage(),e);
            }
        }

    }


    public void send(String code, Map<String, Object> params){
        long startTime = System.currentTimeMillis();
        RestApiResult restApiResult = confDbSfBusi.queryConf(code);
        if(restApiResult.isFail()){
            log.error(code + "查询配置数据出错，出错原因：" + JsonKit.toJson(restApiResult));
            return ;
        }
        Db2SFConfPojo pojo = (Db2SFConfPojo) restApiResult.getData();
        StringBuffer reqUrl = new StringBuffer();

        SfSyncConfDbSfModel model = pojo.getModel();
        reqUrl.append(model.getStr("sf_url"));
        String parentCode = model.get("parent_code");
        if(StringUtils.isNotEmpty(parentCode)){
            dbToSFScheduleBusi.sync(parentCode);
        }
        final String updateSql = model.get("before_update_sql");
        if(StringUtils.isNotEmpty(updateSql)){
            Db.update(updateSql);
        }

        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("pojo",pojo);
        paramsMap.putAll(params);

        String sql = EnjoyKit.render("/tpl_db/tpl_generate_query_data.sql",paramsMap);
        if(StringUtils.isEmpty(sql)){
            log.error(code + "生成的查询SQL为空");
            return ;
        }

        List<Record> recordList = Db.use().find(sql);
        List<Record> sourceRecordList = Db.use().find(sql);
        if(CollectionUtils.isEmpty(recordList)){
            log.error("code->" +code+ ",参数->" + JSON.toJSONString(params) + "查询出的数据为空，不执行数据同步");
            return ;
        }

        Map<String, Object> dataToSf = generateDataToSF(pojo,recordList);

        String sendData = JsonKit.toJson(dataToSf);

        String sfRetStr = sfInfBusi.post(reqUrl.toString(),sendData);
        List<UpdateDbAttrPojo> updateSqlList = updateToDB(code,sourceRecordList,pojo,sfRetStr);
        if(CollectionUtils.isEmpty(updateSqlList)){
            return ;
        }

        long endTime = System.currentTimeMillis();
        long costTime = endTime - startTime;
        List<LogDbToSFPojo> logPojoList = new ArrayList<>();
        for (UpdateDbAttrPojo updateDbAttrPojo : updateSqlList){
            LogDbToSFPojo logPojo = new LogDbToSFPojo();
            logPojo.setCode(code);
            logPojo.setVal(updateDbAttrPojo.getDbIdVal());
            logPojo.setPost_json(sendData);
            JSONObject sfRetBodyObj = updateDbAttrPojo.getSfRetObjJson();
            if(sfRetBodyObj != null){
                logPojo.setRet_json(JSON.toJSONString(sfRetBodyObj));
            }
            logPojo.setSend_status(sfReqIsSuccess(sfRetStr) ? SF_RET_SUCCESS : SF_RET_FAIL);
            logPojo.setUpdate_sql(updateDbAttrPojo.getUpdateSql());
            logPojo.setCost_time(costTime);
            logPojoList.add(logPojo);
        }

        logDbSFBusi.recordAsync(logPojoList);
    }


    public static boolean sfReqIsSuccess(String sfRetStr){
        if(StringUtils.isEmpty(sfRetStr)){
            return false;
        }

        JSONObject sfRetJson = JSON.parseObject(sfRetStr);
        JSONArray sfRetBodyArray = sfRetJson.getJSONArray("compositeResponse");
        if(CollectionUtils.isEmpty(sfRetBodyArray)){
            return false;
        }

        JSONObject sfRetObjJson = sfRetBodyArray.getJSONObject(0);

        return sfReqIsSuccess(sfRetObjJson);
    }


    public static boolean sfReqIsSuccess(JSONObject sfRetJson){
        if(sfRetJson == null){
            return false;
        }

        int httpStatusCode = sfRetJson.getInteger("httpStatusCode");
        if(httpStatusCode != HttpStatus.HTTP_CREATED && httpStatusCode != HttpStatus.HTTP_OK){
            return false;
        }

        JSONObject sfRetBodyJson = sfRetJson.getJSONObject("body");
        if(sfRetBodyJson == null){
            return false;
        }
        boolean isSuccess = sfRetBodyJson.getBoolean("success");
        return isSuccess;
    }



    private List<UpdateDbAttrPojo> updateToDB(String code, Record record, Db2SFConfPojo pojo, String sfRetStr){
        List<Record> recordList = CollUtil.newArrayList(record);
        return updateToDB(code, recordList, pojo, sfRetStr);
    }


    private List<UpdateDbAttrPojo> updateToDB(String code, List<Record> recordList, Db2SFConfPojo pojo, String sfRetStr){
        if(StringUtils.isEmpty(sfRetStr)){
            return null;
        }

        JSONObject sfRetJson = JSON.parseObject(sfRetStr);
        JSONArray sfRetBodyArray = sfRetJson.getJSONArray("compositeResponse");
        if(CollectionUtils.isEmpty(sfRetBodyArray)){
            return null;
        }

        List<String> sqlList = new ArrayList<>();
        List<UpdateDbAttrPojo> updateDbAttrPojoList = new ArrayList<>();

        int recordListSize = recordList.size();

        for (int i = 0; i < recordListSize; i++) {
            Record record = recordList.get(i);
            String sfIdKey = confDbSfBusi.getSfidName(pojo);
            Object dbid = record.getObject(sfIdKey);
            if(dbid == null){
                dbid = record.getObject(StringUtils.lowerCase(sfIdKey));
            }
            JSONObject sfRetObjJson = getRetByDbId(sfRetBodyArray,dbid,"dbId");
            if(sfRetObjJson == null){
                sfRetObjJson = getRetByDbId(sfRetBodyArray,dbid,"referenceId");
            }

            UpdateDbAttrPojo updateDbAttrPojo = new UpdateDbAttrPojo();
            updateDbAttrPojo.setSfRetObjJson(sfRetObjJson);


            updateDbAttrPojo.setDbIdKey(sfIdKey);
            updateDbAttrPojo.setRecord(record);

            if(dbid == null){
                updateDbAttrPojoList.add(updateDbAttrPojo);
                continue ;
            }
            String dbidStr = String.valueOf(dbid);
            String sql = updateToDB(code, dbidStr, pojo, sfRetObjJson);

            updateDbAttrPojo.setDbIdVal(dbidStr);
            updateDbAttrPojo.setUpdateSql(sql);

            updateDbAttrPojoList.add(updateDbAttrPojo);
            if(StringUtils.isEmpty(sql)){
                continue;
            }
            sqlList.add(sql);
        }
        Db.use().batch(sqlList, AppKit.BATCH_SIZE);

        return updateDbAttrPojoList;
    }


    private JSONObject getRetByDbId(JSONArray sfRetBodyArray,Object dbid,String dbidKey){
        if(sfRetBodyArray == null || sfRetBodyArray.size() <= 0 || dbid == null){
            return null;
        }
        int retSize = sfRetBodyArray.size();
        for (int i = 0; i < retSize; i++) {
            JSONObject sfRetObj = sfRetBodyArray.getJSONObject(i);
            String targetDbId = sfRetObj.getString(dbidKey);
            if(StringUtils.isEmpty(targetDbId)){
                continue;
            }
            if(StringUtils.equals(targetDbId,String.valueOf(dbid))){
                return sfRetObj;
            }
        }
        return null;
    }


    private String updateToDB(String code, String dbid, Db2SFConfPojo pojo, String sfRetStr){
        if(StringUtils.isEmpty(sfRetStr)){
            return null;
        }

        JSONObject sfRetJson = JSON.parseObject(sfRetStr);
        JSONArray sfRetBodyArray = sfRetJson.getJSONArray("compositeResponse");
        if(CollectionUtils.isEmpty(sfRetBodyArray)){
            return null;
        }

        JSONObject sfRetObjJson = sfRetBodyArray.getJSONObject(0);
        String sql = updateToDB(code, dbid, pojo, sfRetObjJson);
        if(StringUtils.isNotEmpty(sql)){
            Db.use().update(sql);
        }

        return sql;
    }



    private String updateToDB(String code, String dbid, Db2SFConfPojo pojo, JSONObject sfRetJson){
        if(sfRetJson == null){
            return null;
        }
        Map<String, Object> updateParamMap = new HashMap<>();
        updateParamMap.put("pojo",pojo);
        updateParamMap.put("dbid",dbid);

        int httpStatusCode = sfRetJson.getInteger("httpStatusCode");
        if(httpStatusCode != HttpStatus.HTTP_CREATED && httpStatusCode != HttpStatus.HTTP_OK){
            List<SfSyncConfDbSfDetailModel> updateAttrList = SalesforceKit.initUpdateColList(SFKit.SYNC_STATUS_3);
            updateParamMap.put("updateList",updateAttrList);
            return SalesforceKit.initUpdateSql(code,updateParamMap);
        }
        JSONObject sfRetBodyJson = sfRetJson.getJSONObject("body");
        if(sfRetBodyJson == null){
            return null;
        }
        boolean isSuccess = sfRetBodyJson.getBoolean("success");
        if(!isSuccess){
            return null;
        }
        List<SfSyncConfDbSfDetailModel> updateAttrList = SalesforceKit.initUpdateColList(SFKit.SYNC_STATUS_2);
        List<SfSyncConfDbSfDetailModel> updateList = pojo.getUpdateList();
        if(CollectionUtils.isNotEmpty(updateList)){
            for (SfSyncConfDbSfDetailModel detailModel : updateList){
                String sfAttrKey = detailModel.get("sf_attr_code");

                String sfAttrVal = sfRetBodyJson.getString(sfAttrKey);
                if(StringUtils.isEmpty(sfAttrVal)){
                    sfAttrVal = sfRetBodyJson.getString(StringUtils.lowerCase(sfAttrKey));
                }
                if(StringUtils.isEmpty(sfAttrVal)){
                    continue;
                }
                detailModel.put("sfAttrVal",sfAttrVal);
                updateAttrList.add(detailModel);
            }
        }

        updateParamMap.put("updateList",updateAttrList);

        return SalesforceKit.initUpdateSql(code,updateParamMap);
    }


    public List<UpdateDbAttrPojo> update2ToDB(String code, List<Record> recordList, Db2SFConfPojo pojo, String sfRetStr){
        if(StringUtils.isEmpty(sfRetStr)){
            return null;
        }

        JSONObject sfRetJson = JSON.parseObject(sfRetStr);
        JSONArray sfRetBodyArray = sfRetJson.getJSONArray("data");

        List<UpdateDbAttrPojo> updateDbAttrPojoList = new ArrayList<>();
        if(CollectionUtils.isEmpty(sfRetBodyArray)){
            sfRetBodyArray = new JSONArray();
        }

        List<String> sqlList = new ArrayList<>();

        int recordListSize = recordList.size();

        for (int i = 0; i < recordListSize; i++) {
            Record record = recordList.get(i);
            String sfIdKey = confDbSfBusi.getSfidName(pojo);
            Object dbid = record.getObject(sfIdKey);
            if(dbid == null){
                dbid = record.getObject(StringUtils.lowerCase(sfIdKey));
            }

            JSONObject sfRetObjJson = getRetByDbId(sfRetBodyArray,dbid,"awsId");

            UpdateDbAttrPojo updateDbAttrPojo = new UpdateDbAttrPojo();
            if(sfRetObjJson == null){
                updateDbAttrPojo.setSfRetObjJson(sfRetJson);
            }else{
                updateDbAttrPojo.setSfRetObjJson(sfRetObjJson);
            }

            updateDbAttrPojo.setDbIdKey(sfIdKey);
            updateDbAttrPojo.setRecord(record);

            if(dbid == null){
                updateDbAttrPojoList.add(updateDbAttrPojo);
                continue ;
            }
            String dbidStr = String.valueOf(dbid);
            String sql = update2ToDB(code, dbidStr, pojo, sfRetObjJson);

            updateDbAttrPojo.setDbIdVal(dbidStr);
            updateDbAttrPojo.setUpdateSql(sql);

            updateDbAttrPojoList.add(updateDbAttrPojo);
            if(StringUtils.isEmpty(sql)){
                continue;
            }

            sqlList.add(sql);
        }
        Db.use().batch(sqlList, AppKit.BATCH_SIZE);


        return updateDbAttrPojoList;
    }


    public String update2ToDB(String code, String dbid, Db2SFConfPojo pojo, JSONObject sfRetBodyJson){
        if(sfRetBodyJson == null){
            return null;
        }

        List<SfSyncConfDbSfDetailModel> updateList = pojo.getUpdateList();
        if(CollectionUtils.isEmpty(updateList)){
            log.info(code + "更新的配置为空，不执行更新操作");
            return null;
        }

        Map<String, Object> updateParamMap = new HashMap<>();
        updateParamMap.put("pojo",pojo);


        List<SfSyncConfDbSfDetailModel> updateAttrList = new ArrayList<>();
        for (SfSyncConfDbSfDetailModel detailModel : updateList){
            String sfAttrKey = detailModel.get("sf_attr_code");

            String sfAttrVal = sfRetBodyJson.getString(sfAttrKey);
            if(StringUtils.isEmpty(sfAttrVal)){
                sfAttrVal = sfRetBodyJson.getString(StringUtils.lowerCase(sfAttrKey));
            }
            if(StringUtils.isEmpty(sfAttrVal)){
                continue;
            }
            detailModel.put("sfAttrVal",sfAttrVal);
            updateAttrList.add(detailModel);
        }
        updateParamMap.put("dbid",dbid);
        updateParamMap.put("updateList",updateAttrList);

        String sql = EnjoyKit.render("/tpl_db/tpl_generate_update_data.sql",updateParamMap);
        if(StringUtils.isEmpty(sql)){
            log.error(code + "生成的更新SQL为空");
            return null;
        }

        return sql;
    }


    public Record generateBodyForSF(String code, String dbid){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("dbid",dbid);

        List<Record> recordList = generateBodyForSF(code,paramsMap);

        return CollectionUtils.isEmpty(recordList) ? null : recordList.get(0);
    }


    public List<Record> generateBodyForSF(String code, Map<String,Object> params){
        DbRecordPojo awsRecordPojo = generateBodyToPojoForSF(code,params);
        return awsRecordPojo != null ? awsRecordPojo.getTargetList() : null;
    }


    public DbRecordPojo generateBodyToPojoForSF(String code, Map<String,Object> params){
        RestApiResult RestApiResult = confDbSfBusi.queryConf(code);
        if(RestApiResult.isFail()){
            log.error(code + "查询配置数据出错，出错原因：" + JsonKit.toJson(RestApiResult));
            return null;
        }
        Db2SFConfPojo pojo = (Db2SFConfPojo) RestApiResult.getData();

        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("pojo",pojo);
        paramsMap.putAll(params);

        String sql = EnjoyKit.render("/tpl_db/tpl_generate_query_data.sql",paramsMap);
        if(StringUtils.isEmpty(sql)){
            log.error(code + "生成的查询SQL为空");
            return null;
        }

        List<Record> recordList = Db.use().find(sql);
        if(CollectionUtils.isEmpty(recordList)){
            log.error("code->" +code+ ",查询参数->" + JSON.toJSONString(params) + "查询出的数据为空，不执行数据同步");
            return null;
        }

        DbRecordPojo awsRecordPojo = new DbRecordPojo();
        awsRecordPojo.setSourceList(recordList);
        awsRecordPojo.setTargetList(recordList);
        String[] removeAttrArray = pojo.getRemoveAttr();
        if(ArrayUtil.isNotEmpty(removeAttrArray)){
            List<Record> recordUpdateList = new ArrayList<>();
            for(Record record : recordList){
                Record targetRecord = new Record();
                targetRecord.setColumns(record);
                targetRecord = targetRecord.remove(removeAttrArray);
                recordUpdateList.add(targetRecord);
            }
            awsRecordPojo.setTargetList(recordUpdateList);
            return awsRecordPojo;
        }

        return awsRecordPojo;
    }


    public List<Record> generateBodyListForSF(String code, String tagetAttrKey,String tagetAttrVal){
        RestApiResult RestApiResult = confDbSfBusi.queryConf(code);
        if(RestApiResult.isFail()){
            log.error(code + "查询配置数据出错，出错原因：" + JsonKit.toJson(RestApiResult));
            return null;
        }
        Db2SFConfPojo pojo = (Db2SFConfPojo) RestApiResult.getData();

        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("tagetAttrKey",tagetAttrKey);
        paramsMap.put("tagetAttrVal",tagetAttrVal);
        paramsMap.put("pojo",pojo);

        String sql = EnjoyKit.render("/tpl_db/tpl_generate_query_data.sql",paramsMap);
        if(StringUtils.isEmpty(sql)){
            log.error(code + "生成的查询SQL为空");
            return null;
        }

        List<Record> recordList = Db.use().find(sql);
        if(CollectionUtils.isEmpty(recordList)){
            log.error("code->" +code+ ",tagetAttrKey->" + tagetAttrKey + ",tagetAttrVal->" + tagetAttrVal + "查询出的数据为空，不执行数据同步");
            return null;
        }
        String[] removeAttrArray = pojo.getRemoveAttr();
        if(ArrayUtil.isNotEmpty(removeAttrArray)){
            List<Record> recordUpdateList = new ArrayList<>();
            for(Record record : recordList){
                record = record.remove(removeAttrArray);
                recordUpdateList.add(record);
            }

            return recordUpdateList;
        }

        return recordList;
    }


    public Map<String, Object> generateDataToSF(Db2SFConfPojo pojo, Record record){
        List<Record> recordList = CollUtil.newArrayList(record);
        return generateDataToSF(pojo,recordList);
    }



    private Map<String, Object> generateDataToSF(Db2SFConfPojo pojo, List<Record> recordList){
        Map<String, Object> retMap = new HashMap<>();
        retMap.put("allOrNone",false);

        SfSyncConfDbSfModel model = pojo.getModel();
        String objUrl = model.get("obj_url");
        String objKey = model.get("obj_url_key");
        String[] removeAttrArray = pojo.getRemoveAttr();

        String sfidName = confDbSfBusi.getSfidName(pojo);

        List<Map<String, Object>> dataMapList = new ArrayList<>();
        for(Record record : recordList){
            Map<String, Object> dataMap = new HashMap<>();
            dataMap.put("method","PATCH");
            Object referenceIdObj = record.get(sfidName);
            if(referenceIdObj == null){
                referenceIdObj  = record.get(StringUtils.lowerCase(sfidName));
            }
            String referenceId = referenceIdObj != null ? String.valueOf(referenceIdObj) : RandomStringUtils.randomNumeric(16);

            dataMap.put("referenceId",referenceId);

            Object objVal  = record.getObject(objKey);
            dataMap.put("url",new StringBuffer(objUrl).append("/").append(objVal));

            if(ArrayUtil.isNotEmpty(removeAttrArray)){
                record = record.remove(removeAttrArray);
            }
            dataMap.put("body",record);

            dataMapList.add(dataMap);
        }

        retMap.put("compositeRequest",dataMapList);

        return retMap;
    }
}
