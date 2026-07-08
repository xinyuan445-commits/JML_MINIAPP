package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.List;


@Table(tableName = "jml_tp_service_provider",primaryKey = "id")
public class TpServiceProviderModel extends DbXmlModel4Jboot<TpServiceProviderModel> implements IBean {

    public List<TpServiceProviderModel> queryList() {
        return findForXml("tpServiceProvider.queryList");
    }

}
