package com.glenls.salesforce.modules.sf2db4update.busi;

import cn.hutool.core.bean.BeanPath;
import cn.hutool.core.date.DateUtil;
import cn.hutool.core.thread.ThreadUtil;
import cn.hutool.core.util.ReUtil;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.salesforce.modules.pub.busi.SfInfBusi;
import com.glenls.salesforce.modules.sf2db4update.bean.Sf2DbCheckPojo;
import com.glenls.salesforce.modules.sf2db4update.bean.Sf2DbInPojo;
import com.glenls.salesforce.modules.sf2db4update.bean.Sf2DbParsePojo;
import com.glenls.salesforce.modules.sf2db4update.model.ConfSF2DB4UpdateDetailModel;
import com.glenls.salesforce.modules.sf2db4update.model.ConfSF2DB4UpdateModel;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.Db;
import com.jfinal.plugin.activerecord.Record;
import lombok.extern.log4j.Log4j;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;


@Log4j
public class SF2DBUpdateBusi {
    
    private static final String REG_JSON_OBJ = "^\\{.+\\}$";
    
    private static final String REG_JSON_ARRAY = "^\\[.+\\]$";

    
    public static final String FLAG_N = "N";

    
    public static final String FLAG_Y = "Y";

    private static final ThreadPoolExecutor executor = ThreadUtil.newExecutor(5,10);

    @Inject
    private ConfSF2DB4UpdateDetailModel confSFAWSDetailDao;

    @Inject
    private ConfSF2DB4UpdateModel confSF2DBDao;

    @Inject
    private SfInfBusi sfInfBusi;


    public Sf2DbParsePojo getData(String code, String rawData){
        Sf2DbInPojo pojo = new Sf2DbInPojo();
        pojo.setData(rawData);

        Sf2DbParsePojo parsePojo = new Sf2DbParsePojo();
        parsePojo.setData(pojo);
        parsePojo.setObjCode(code);

        return parsePojo;
    }


     public RestApiResult save(String code){
        ConfSF2DB4UpdateModel model = confSF2DBDao.queryByCode(code);
        if(model == null){
            return RestApiResult.newFail("同步失败，未找到同步对象");
        }

        String uri = model.get("sfUrl");
        String sql = model.get("sfSql");

        if(StringUtils.isEmpty(uri) || StringUtils.isEmpty(sql)){
            return RestApiResult.newFail("对象：" + code + "参数配置不全，不能进行同步");
        }

        Map<String,Object> params = new HashMap<>();
        params.put("tbname",model.get("tbname"));

        List<Record> recordList = confSF2DBDao.findForXmlWithDb("sf_to_db.query4SfUpdate",params);
        if(CollectionUtils.isEmpty(recordList)){
            return RestApiResult.newFail("对象："+code+"待同步的数据为空，不执行同步！");
        }

        for(Record record : recordList){
            String sfid = record.get("sfid");

            sql = StringUtils.replace(sql, "#{sfid}",sfid);
            String url = new StringBuffer(uri).append("?q=").append(sql).toString();


            RestApiResult sfGetResult = sfInfBusi.getToResult(url);
            if(sfGetResult.isFail()){
                return RestApiResult.newFail("对象：" + code + "请求出错，错误原因" + sfGetResult.getData());
            }

            JSONObject retJson = JSON.parseObject( (String) sfGetResult.getData());
            JSONArray retDataArray = retJson.getJSONArray("records");

            save(code,JSON.toJSONString(retDataArray));
        }

        save(code);

        return RestApiResult.newSuccess("同步完成");
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
            if(checkPojo != null){
                restApiResult.setData(checkPojo.getFail());
            }

            return restApiResult;
        }
        RestApiResult result4Db = generateDbData(result4Check);
        if(result4Db.isFail()){
            return result4Db;
        }
        RestApiResult result4Save = saveData2Db(code,result4Db);

        Sf2DbCheckPojo checkPojo = (Sf2DbCheckPojo) result4Check.getData();
        List<JSONObject> checkFailList = checkPojo.getFail();

        if(CollectionUtils.isNotEmpty(checkFailList)){
            log.error("校验失败的数据：" + JSON.toJSONString(checkFailList));
            return RestApiResult.newFailWithData(checkFailList).setMsg("成功数据：" + checkPojo.getSuccess().size()+"，失败数据：" + checkPojo.getSuccess().size());
        }

        return result4Save;
    }




    private RestApiResult saveData2Db(String code,RestApiResult result4Db){
        ConfSF2DB4UpdateModel model = confSF2DBDao.queryByCode(code);

        final String tbname = model.get("tbname");
        final String priKeyName = model.get("priKeyName");
        final String sfidName = model.get("sfidName");

        final List<Record> recordList = (List<Record>) result4Db.getData();
        final List<String> sfidList = new ArrayList<>();

        for (Record record : recordList){
            String sfid = record.get(sfidName);

            sfidList.add(sfid);
        }

        List<Record> updateList = new ArrayList<>();

        for(Record record : recordList){
            updateList.add(record);
        }

        if(CollectionUtils.isNotEmpty(updateList)){
            Db.batchUpdate(tbname,updateList,AppKit.BATCH_SIZE);
        }

        return RestApiResult.newSuccess();
    }


    private RestApiResult generateDbData(RestApiResult result4Check){
        Sf2DbCheckPojo pojo = (Sf2DbCheckPojo) result4Check.getData();
        List<JSONObject> list = pojo.getSuccess();
        List<ConfSF2DB4UpdateDetailModel> confList = pojo.getConfList();

        List<Record> recordList = new ArrayList<>();
        for(JSONObject jsonObj : list){
            Record record = new Record();
            for(ConfSF2DB4UpdateDetailModel model : confList){
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
        List<ConfSF2DB4UpdateDetailModel> modelList = confSFAWSDetailDao.queryByCode(code);
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


    private RestApiResult checkData4Single(JSONObject jsonObj,List<ConfSF2DB4UpdateDetailModel> modelList){
        for (ConfSF2DB4UpdateDetailModel model : modelList){
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
