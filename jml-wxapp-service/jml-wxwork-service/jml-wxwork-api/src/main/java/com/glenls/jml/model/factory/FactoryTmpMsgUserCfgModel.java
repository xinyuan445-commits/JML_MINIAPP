package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.List;
import java.util.Map;


@Table(tableName = "jml_factory_tmp_msg_user_cfg",primaryKey = "id")
public class FactoryTmpMsgUserCfgModel extends DbXmlModel4Jboot<FactoryTmpMsgUserCfgModel> implements IBean {


    public List<FactoryTmpMsgUserCfgModel> queryTmpUserOpenId(Map<String,Object> paramsMap){
        return findForXml("factoryTmpMsgUserCfg.queryTmpUserOpenId", paramsMap);
    }



    public List<FactoryTmpMsgUserCfgModel> queryStaffOpenId(Map<String,Object> paramsMap){
        return findForXml("factoryTmpMsgUserCfg.queryStaffOpenId", paramsMap);
    }
}
