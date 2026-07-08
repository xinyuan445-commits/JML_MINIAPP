package com.glenls.salesforce.modules.job.kit;

import com.glenls.salesforce.modules.job.handler.*;
import com.xxl.job.core.executor.XxlJobExecutor;
import io.jboot.Jboot;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.math.NumberUtils;


@Slf4j
public class XxlJobConfigKit {

    private static XxlJobExecutor xxlJobExecutor = null;


    public static void initXxlJobExecutor(){
        log.info("xxl-job客户端开始初始化");

        XxlJobExecutor.registJobHandler("Db2SfJobHandler", new Db2SfJobHandler());
        XxlJobExecutor.registJobHandler("Sf2DbJobHandler", new Sf2DbJobHandler());
        XxlJobExecutor.registJobHandler("Sf2DbUpdateJobHandler", new Sf2DbUpdateJobHandler());
        XxlJobExecutor.registJobHandler("LogDb2SfJobHandler",new LogDb2SfJobHandler());
        XxlJobExecutor.registJobHandler("SfTokenCleanJobHandler",new SfTokenCleanJobHandler());
        XxlJobExecutor.registJobHandler("WXFansSyncJobHandler",new WXFansSyncJobHandler());
        XxlJobExecutor.registJobHandler("Db2Sf4UpdateSfIdJobHandler",new Db2Sf4UpdateSfIdJobHandler());
        XxlJobExecutor.registJobHandler("DeviceRepairAutoAcceptedHandler",new DeviceRepairAutoAcceptedHandler());


        xxlJobExecutor = new XxlJobExecutor();
        xxlJobExecutor.setAdminAddresses(Jboot.configValue("xxl.job.admin.addresses"));
        xxlJobExecutor.setAccessToken(Jboot.configValue("xxl.job.accessToken"));
        xxlJobExecutor.setAddress(Jboot.configValue("xxl.job.executor.address"));
        xxlJobExecutor.setAppname(Jboot.configValue("xxl.job.executor.appname"));
        xxlJobExecutor.setIp(Jboot.configValue("xxl.job.executor.ip"));
        xxlJobExecutor.setPort(NumberUtils.toInt(Jboot.configValue("xxl.job.executor.port")));

        xxlJobExecutor.setLogPath(Jboot.configValue("xxl.job.executor.logpath"));
        xxlJobExecutor.setLogRetentionDays(NumberUtils.toInt(Jboot.configValue("xxl.job.executor.logretentiondays")));

        log.info("xxl-job客户端初始化完成");

        try {
            xxlJobExecutor.start();
        } catch (Exception e) {
            log.error(e.getMessage(), e);
        }
    }


    public static void destoryXxlJobExecutor() {
        if (xxlJobExecutor != null) {
            xxlJobExecutor.destroy();
        }
        log.info("xxl-job客户端destroy完成");
    }
}
