package com.glenls.jml.conf;

import com.glenls.commons.jboot.render.JbootRender4GlenFactory;
import com.glenls.commons.jfinal.ineterceptor.CrossDomainInterceptor;
import com.glenls.commons.jfinal.ineterceptor.GlobalException4ApiInterceptor;
import com.glenls.commons.jfinal.plugins.sqlxml.SqlXmlPlugin;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.api.ApiConfigKit;
import com.glenls.commons.jfinal_wxmp.weixin.sdk.cache.JbootRedisAccessTokenCache;
import com.glenls.commons.salesforce.kit.DbKit;
import com.glenls.jml.weixin.openwx.kit.OpenWeixinKit;
import com.jfinal.config.Constants;
import com.jfinal.config.Interceptors;
import com.jfinal.config.Routes;
import com.jfinal.plugin.activerecord.tx.TxByMethodRegex;
import com.jfinal.template.Engine;
import io.jboot.Jboot;
import io.jboot.aop.jfinal.JfinalHandlers;
import io.jboot.aop.jfinal.JfinalPlugins;
import io.jboot.core.listener.JbootAppListenerBase;
import lombok.extern.slf4j.Slf4j;


@Slf4j
public class JfinalConf4Jml extends JbootAppListenerBase {

    @Override
    public void onInit() {
        super.onInit();
    }

    @Override
    public void onConstantConfig(Constants constants) {
        constants.setRenderFactory(new JbootRender4GlenFactory());
        super.onConstantConfig(constants);
    }

    @Override
    public void onRouteConfig(Routes routes) {
        super.onRouteConfig(routes);
    }

    @Override
    public void onEngineConfig(Engine engine) {
        super.onEngineConfig(engine);
    }

    @Override
    public void onPluginConfig(JfinalPlugins plugins) {
        plugins.add(new SqlXmlPlugin("classpath*:sql*-sql.xml"));

        super.onPluginConfig(plugins);
    }

    @Override
    public void onInterceptorConfig(Interceptors interceptors) {
        super.onInterceptorConfig(interceptors);
        interceptors.add(new TxByMethodRegex(".*(save|update|add|del|insert|modify|remove|do).*"));
        interceptors.addGlobalActionInterceptor(new CrossDomainInterceptor());
        interceptors.addGlobalActionInterceptor(new GlobalException4ApiInterceptor());
    }

    @Override
    public void onHandlerConfig(JfinalHandlers handlers) {
        super.onHandlerConfig(handlers);
    }

    @Override
    public void onStartBefore() {
        super.onStartBefore();
    }

    @Override
    public void onStart() {
        super.onStart();
    }

    @Override
    public void onStartFinish() {
        super.onStartFinish();
        DbKit.DB_NAME = Jboot.configValue("sf.sync.dbname");
        CrossDomainInterceptor.CROSS_HEADER = Jboot.configValue("cross.header");

        ApiConfigKit.setAccessTokenCache(new JbootRedisAccessTokenCache(Jboot.getRedis()));
        OpenWeixinKit.putApiConfig();
    }

    @Override
    public void onStop() {
        super.onStop();
    }
}
