package com.glenls.wxwork.job;

import com.glenls.wxwork.busi.WxWorkCustSyncBusi;
import com.jfinal.aop.Aop;
import lombok.extern.slf4j.Slf4j;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;


@Slf4j
public class WxworkCustSyncJob implements Job {

    private WxWorkCustSyncBusi wxWorkCustSyncBusi = Aop.get(WxWorkCustSyncBusi.class);

    @Override
    public void execute(JobExecutionContext jobExecutionContext) throws JobExecutionException {
        log.info("开始同步企业微信客户信息...");
        wxWorkCustSyncBusi.sync();
        log.info("完成同步企业微信客户信息...");
    }
}
