package com.glenls.wxwork.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.glenls.commons.lang.kit.AppKit;
import com.jfinal.plugin.activerecord.Db;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "wxwork_user", primaryKey = "userid")
public class WxworkUserModel extends DbXmlModel4Jboot<WxworkUserModel> implements IBean {

    public List<WxworkUserModel> queryByDeptId(Long deptId){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("deptId",deptId);

        return findForXml("wxwork_user.queryByDeptId",paramsMap);
    }


    public List<WxworkUserModel> queryAll(){
        return findForXml("wxwork_user.queryAll");
    }


    public void delByDeptId(Long deptId){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("deptId",deptId);

        deleteForXml("wxwork_user.delByDeptId",paramsMap);
    }


    public void batchInsert(List<WxworkUserModel> list){
        String columns = "userid, name, mobile, position, gender, email, avatar, thumb_avatar, telephone, alias, address, open_userid, main_department";
        batchForXml("wxwork_user.batchInsert",columns,list, AppKit.BATCH_SIZE);
    }


    public void batchUpdate(List<WxworkUserModel> list){
        Db.batchUpdate(list,AppKit.BATCH_SIZE);
    }
}
