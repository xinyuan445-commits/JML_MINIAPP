package com.glenls.salesforce.modules.log.busi;

import com.jfinal.plugin.activerecord.Db;
import lombok.extern.slf4j.Slf4j;


@Slf4j
public class XxlJobLogCleanBusi {



    public void clean(){
        Db.delete("truncate table xxl_job_log");
    }
}
