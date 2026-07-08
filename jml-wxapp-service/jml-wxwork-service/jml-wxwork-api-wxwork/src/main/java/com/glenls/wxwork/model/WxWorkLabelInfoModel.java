package com.glenls.wxwork.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.glenls.commons.lang.kit.AppKit;
import com.jfinal.plugin.activerecord.Db;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.List;


@Table(tableName = "wxwork_lable_info", primaryKey = "id")
public class WxWorkLabelInfoModel extends DbXmlModel4Jboot<WxWorkLabelInfoModel> implements IBean {


   public List<WxWorkLabelInfoModel> queryAll(){
        return findForXml("wxwork_lable_info.queryAllTag");
   }


    public void batchInsert(List<WxWorkLabelInfoModel> list){
        String columns = "tag_id,tag_name, group_id, group_name, group_order, tag_order";
        batchForXml("wxwork_lable_info.batchInsert",columns,list, AppKit.BATCH_SIZE);
    }


    public void batchUpdate(List<WxWorkLabelInfoModel> list){
        Db.batchUpdate(list,AppKit.BATCH_SIZE);
    }
}
