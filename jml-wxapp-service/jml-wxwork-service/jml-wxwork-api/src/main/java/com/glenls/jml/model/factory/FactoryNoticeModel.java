package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.glenls.commons.jfinal.plugins.sqlxml.plugin.activerecord.DbXmlModel;
import com.jfinal.plugin.activerecord.BaseModel;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Model;
import org.bouncycastle.math.raw.Mod;

import java.util.List;
import java.util.Map;


public class FactoryNoticeModel extends DbXmlModel<FactoryNoticeModel>  implements IBean {

    public List<FactoryNoticeModel> getNoticeDay(Map<String,Object> paramsMap ) {
        return findForXml("factoryNotice.queryNoticeDay",paramsMap);
    }


    public List<FactoryNoticeModel> queryNoticeInfoByDay(Map<String,Object> paramsMap ) {
        return findForXml("factoryNotice.queryNoticeInfoByDay", paramsMap);
    }

}
