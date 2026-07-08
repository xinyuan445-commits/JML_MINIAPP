package com.glenls.salesforce.modules.log.busi;

import cn.hutool.core.date.DateUtil;
import cn.hutool.core.thread.ThreadUtil;
import com.alibaba.fastjson.JSON;
import com.glenls.commons.jfinal.kit.ExceptionKit;
import com.glenls.commons.jfinal.plugins.inftAuth.kit.DateKit;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.salesforce.modules.log.model.LogDbSfModel;
import com.glenls.salesforce.modules.log.pojo.LogDbToSFPojo;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.Db;
import com.jfinal.plugin.activerecord.Record;
import io.jboot.Jboot;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections.CollectionUtils;

import java.util.*;
import java.util.concurrent.ThreadPoolExecutor;

import static com.glenls.salesforce.modules.db2sf.busi.DbToSFBusi.SF_RET_FAIL;


@Slf4j
public class LogDbSFBusi {

    private ThreadPoolExecutor threadPoolExecutor = ThreadUtil.newExecutor(5,10);



    public static final String BASE_TABLE = "log_db_sf";

    @Inject
    private LogDbSfModel logDbSfDao;


    public Record generateRecord(LogDbToSFPojo pojo){
        if(pojo == null){
            return null;
        }

        Record record = new Record();
        record.set("code",pojo.getCode());
        record.set("val",pojo.getVal());
        record.set("post_json",pojo.getPost_json());
        record.set("ret_json",pojo.getRet_json());
        record.set("send_status",pojo.getSend_status());
        record.set("cost_time",pojo.getCost_time());
        record.set("update_sql",pojo.getUpdate_sql());

        return record;
    }


    public void record(LogDbToSFPojo pojo){
        if(pojo == null){
            return ;
        }
        String tableName = BASE_TABLE;

        Record record = generateRecord(pojo);
        if(record == null){
            return ;
        }

        Db.use().save(tableName,record);
    }


    public void record(List<LogDbToSFPojo> pojoList){
        if(CollectionUtils.isEmpty(pojoList)){
            return ;
        }
        String tableName = BASE_TABLE;
        List<Record> recordList = new ArrayList<>();
        for(LogDbToSFPojo pojo : pojoList){
            Record record = generateRecord(pojo);
            if(record == null){
                continue;
            }
            recordList.add(record);
        }

        if(CollectionUtils.isEmpty(recordList)){
            return ;
        }

        Db.use().batchSave(tableName,recordList,AppKit.BATCH_SIZE);

        for (LogDbToSFPojo pojo : pojoList){
            if(SF_RET_FAIL.equals(pojo.getSend_status())){
                Map<String,Object> paramsMap = new HashMap<>();
                paramsMap.put("code",pojo.getCode());
                paramsMap.put("val",pojo.getVal());
                if(logDbSfDao.cntFailByDate(paramsMap) == 1){
                    log.info("推送数据到SF失败，发送邮件通知");
                    String postJson = JSON.toJSONString(pojo.getPost_json()).replace("\\", "");
                    postJson = postJson.substring(1, postJson.length() - 1);
                    String retJson = JSON.toJSONString(pojo.getRet_json()).replace("\\", "");
                    retJson = retJson.substring(1, retJson.length() - 1);
                    String env = Jboot.configValue("env");
                    ExceptionKit.send("JML推送数据到SF失败-"+env,
                            "当前环境：" + env +
                                    "\n小程序对象名称：" + pojo.getCode() +
                                    "\n数据Id：" + pojo.getVal() +
                                    "\n推送信息：\n" + postJson +
                                    "\n错误信息：\n" + retJson);
                }
            }
        }



    }


    public void recordAsync(final LogDbToSFPojo pojo){
        threadPoolExecutor.execute(new Runnable() {
            @Override
            public void run() {
                record(pojo);
            }
        });
    }


    public void recordAsync(final List<LogDbToSFPojo> pojo){
        String tableName = BASE_TABLE;
        threadPoolExecutor.execute(new Runnable() {
            @Override
            public void run() {
                record(pojo);
            }
        });
    }


    public void bakData(){
        Date currentTime = new Date();
        Date beginOfMonthDayStart = DateUtil.beginOfMonth(currentTime);
        Date beginOfMonthDayEnd = DateUtil.endOfDay(beginOfMonthDayStart);

        if(!(currentTime.getTime() >= beginOfMonthDayStart.getTime() && currentTime.getTime() <= beginOfMonthDayEnd.getTime())){
            log.info("未到月初，不执行数据日志备份");
            return;
        }

        Date lastMonthBegin = DateUtil.beginOfMonth(DateUtil.lastMonth());
        Date lasMonthEnd = DateUtil.endOfMonth(lastMonthBegin);

        Map<String,Object> paramsMap = new HashMap<>();
        paramsMap.put("month",AppKit.thisMonth2());
        paramsMap.put("startTime",DateUtil.format(lastMonthBegin, DateKit.PATTERN_YMDHMS));
        paramsMap.put("endTime",DateUtil.format(lasMonthEnd, DateKit.PATTERN_YMDHMS));

        logDbSfDao.createBakData(paramsMap);
        logDbSfDao.delOldData(paramsMap);
    }

}
