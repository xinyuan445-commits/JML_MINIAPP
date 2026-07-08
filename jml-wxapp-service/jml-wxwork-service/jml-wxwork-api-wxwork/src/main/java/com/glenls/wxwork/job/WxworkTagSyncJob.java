package com.glenls.wxwork.job;

import com.glenls.wxwork.busi.WxworkTagSyncBusi;
import com.jfinal.aop.Aop;
import lombok.extern.slf4j.Slf4j;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;


@Slf4j
public class WxworkTagSyncJob implements Job {

    private WxworkTagSyncBusi wxworkTagSyncBusi = Aop.get(WxworkTagSyncBusi.class);

    @Override
    public void execute(JobExecutionContext jobExecutionContext) throws JobExecutionException {
        log.info("开始同步企业微信标签");
        wxworkTagSyncBusi.syncTag();
        log.info("完成企业微信标签同步");
    }
}
