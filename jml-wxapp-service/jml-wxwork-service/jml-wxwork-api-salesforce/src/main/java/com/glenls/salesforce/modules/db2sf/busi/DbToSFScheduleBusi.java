package com.glenls.salesforce.modules.db2sf.busi;

import com.glenls.commons.jfinal.kit.EnjoyKit;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.salesforce.modules.db2sf.model.SfSyncConfAuthModel;
import com.glenls.salesforce.modules.db2sf.model.SfSyncConfDbSfModel;
import com.glenls.salesforce.modules.db2sf.pojo.Db2SFConfPojo;
import com.jfinal.aop.Inject;
import com.jfinal.kit.JsonKit;
import com.jfinal.plugin.activerecord.Db;
import com.jfinal.plugin.activerecord.Page;
import com.jfinal.plugin.activerecord.Record;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.*;


@Slf4j
public class DbToSFScheduleBusi {

    @Inject
    private ConfDbSfBusi confAwsSfBusi;

    @Inject
    private DbToSFBusi awsToSFBusi;

    @Inject
    private SfSyncConfDbSfModel confAwsSfDao;



    public void sync(String code){
        if(StringUtils.isEmpty(code)){
            log.info("对象为空，不执行同步");
            return ;
        }
        Date syncTime = new Date();
        RestApiResult restApiResult = confAwsSfBusi.queryConf(code);
        if(restApiResult.isFail()){
            log.error(code + "查询配置数据出错，出错原因：" + JsonKit.toJson(restApiResult));
            return ;
        }

        Db2SFConfPojo pojo = (Db2SFConfPojo) restApiResult.getData();

        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("pojo",pojo);

        String sql_select = EnjoyKit.render("/tpl_db/tpl_generate_query_data_for_schedule_select.sql",paramsMap);
        if(StringUtils.isEmpty(sql_select)){
            log.error(code + "生成的批量查询SQL为空");
            return ;
        }
        String sql_from = EnjoyKit.render("/tpl_db/tpl_generate_query_data_for_schedule_from.sql",paramsMap);

        int pageSize = AppKit.BATCH_SIZE;

        Page<Record> page = Db.use().paginate(1, pageSize,sql_select,sql_from);
        int totalPage = page.getTotalPage();
        if(totalPage <= 0){
            log.info("对象->" + code + "未查找出需要同步的对象");
            return ;
        }

        List<Record> recordList = page.getList();
        send(code,recordList);
        while(!page.isLastPage()){
            page = Db.use().paginate(page.getPageNumber() + 1, AppKit.BATCH_SIZE,sql_select,sql_from);
            recordList = page.getList();

            if(CollectionUtils.isEmpty(recordList)){
                break;
            }
            send(code,recordList);
        }

        confAwsSfDao.updateLastSyncTime(code,syncTime);
    }


    private void send(String code,List<Record> recordList){
        if(StringUtils.isEmpty(code) || CollectionUtils.isEmpty(recordList)){
            return ;
        }

        List<Object> idList = getIdList(recordList);


        awsToSFBusi.send(code,idList);
    }


    private List<Object> getIdList(List<Record> recordList){
        if(CollectionUtils.isEmpty(recordList)){
            return null ;
        }
        List<Object> idList = new ArrayList<>();
        for (Record record : recordList){
            idList.add(record.getObject("id"));
        }

        return idList;
    }
}
