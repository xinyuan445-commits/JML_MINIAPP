package com.glenls.wxwork.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.glenls.commons.lang.kit.AppKit;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "wxwork_rela_user_dept", primaryKey = "id")
public class WxworkRelaUserDeptModel extends DbXmlModel4Jboot<WxworkRelaUserDeptModel> implements IBean {

    public void delByDeptId(Long deptId){
        Map<String, Object> paramsMap = new HashMap<>();
        paramsMap.put("deptId",deptId);

        deleteForXml("wxwork_rela_user_dept.delByDeptId",paramsMap);
    }


    public void batchInsert(List<WxworkRelaUserDeptModel> list){
        String columns = "userid, deptid";
        batchForXml("wxwork_rela_user_dept.batchInsert",columns,list, AppKit.BATCH_SIZE);
    }


    public void batchDelByUserId(List<WxworkRelaUserDeptModel> list) {
        String columns = "userid";
        batchForXml("wxwork_rela_user_dept.batchDelByUserId",columns,list, AppKit.BATCH_SIZE);
    }
}
