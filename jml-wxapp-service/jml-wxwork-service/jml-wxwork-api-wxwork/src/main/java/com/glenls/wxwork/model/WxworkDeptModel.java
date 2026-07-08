package com.glenls.wxwork.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.glenls.commons.lang.kit.AppKit;
import com.jfinal.plugin.activerecord.Db;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.List;


@Table(tableName = "wxwork_dept", primaryKey = "id")
public class WxworkDeptModel extends DbXmlModel4Jboot<WxworkDeptModel> implements IBean {

    public List<WxworkDeptModel> queryAll(){
        return findForXml("wxwork_dept.queryAll");
    }


    public void batchInsert(List<WxworkDeptModel> list){
        String columns = "id,name, parentid, order";
        batchForXml("wxwork_dept.batchInsert",columns,list, AppKit.BATCH_SIZE);
    }


    public void batchUpdate(List<WxworkDeptModel> list){
        Db.batchUpdate(list,AppKit.BATCH_SIZE);
    }
}
