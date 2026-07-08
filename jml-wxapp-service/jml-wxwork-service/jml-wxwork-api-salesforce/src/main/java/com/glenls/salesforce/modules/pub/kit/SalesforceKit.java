package com.glenls.salesforce.modules.pub.kit;

import com.glenls.commons.jfinal.kit.EnjoyKit;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.salesforce.modules.db2sf.model.SfSyncConfDbSfDetailModel;
import com.jfinal.plugin.activerecord.Db;
import com.jfinal.plugin.activerecord.Record;
import io.jboot.Jboot;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.BooleanUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.*;


@Slf4j
public class SalesforceKit {

    
    public static final int CACHE_TIMEOUT_SENCONDS = 6000;

    public static String DB_NAME = "";


    public static final String getDbName4Log(){
        if(StringUtils.isEmpty(DB_NAME)){
            log.error("请设置DbKit.DB_NAME");
        }
        return DB_NAME;
    }


    public static final String generateTableName(String baseTableName){
        return baseTableName + "_" + AppKit.thisMonth3();
    }




    public static final boolean useConfCache(){
        return BooleanUtils.toBoolean(Jboot.configValue("sf.inf.cache"));
    }


    public static final List<SfSyncConfDbSfDetailModel> initUpdateColList(String syncStauts){
        List<SfSyncConfDbSfDetailModel> updateAttrList = new ArrayList<>();

        SfSyncConfDbSfDetailModel detailModel4Status = new SfSyncConfDbSfDetailModel();
        detailModel4Status.set("attr_code","sync_status");
        detailModel4Status.put("sfAttrVal", syncStauts);
        updateAttrList.add(detailModel4Status);

        SfSyncConfDbSfDetailModel detailModel4Time = new SfSyncConfDbSfDetailModel();
        detailModel4Time.set("attr_code","sync_time");
        detailModel4Time.put("sfAttrVal", AppKit.now4DB());
        updateAttrList.add(detailModel4Time);

        return updateAttrList;
    }


    public static final String initUpdateSql(String code,Map<String, Object> updateParamMap){
        String sql = EnjoyKit.render("/tpl_db/tpl_generate_update_data.sql",updateParamMap);
        if(StringUtils.isEmpty(sql)){
            log.error(code + "生成的更新SQL为空");
            return null;
        }
        log.info(code + "生成的SQL：" + sql);

        return sql;
    }
}
