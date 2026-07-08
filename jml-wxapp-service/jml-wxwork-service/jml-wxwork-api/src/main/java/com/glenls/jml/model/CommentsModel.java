package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import com.jfinal.plugin.activerecord.Page;
import io.jboot.db.annotation.Table;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Table(tableName = "jml_comments",primaryKey = "id")
public class CommentsModel extends DbXmlModel4Jboot<CommentsModel> implements IBean {

    
    public Page<CommentsModel> queryParentPageBy(int pageNo, int pageSize, Map<String,Object> paramsMap){
        return paginateForXml(pageNo, pageSize, "comments.queryParentPageBy",paramsMap);
    }

    public List<CommentsModel> queryList(Map<String,Object> paramsMap){
        return findForXml("comments.queryList",paramsMap);
    }
    
    public List<CommentsModel> querySubCommentsByTopId(Map<String,Object> paramsMap){
        return findForXml("comments.querySubCommentsByTopId",paramsMap);
    }

    
    public CommentsModel queryDetails(String id){
        Map<String,Object> paramsMap = new HashMap<String,Object>();
        paramsMap.put("id",id);
        return findFirstForXml("comments.queryDetails",paramsMap);
    }

}
