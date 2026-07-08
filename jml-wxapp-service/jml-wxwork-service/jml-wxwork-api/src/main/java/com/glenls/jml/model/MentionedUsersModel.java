package com.glenls.jml.model;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;


@Table(tableName = "jml_mentioned_users",primaryKey = "id")
public class MentionedUsersModel  extends DbXmlModel4Jboot<MentionedUsersModel> implements IBean {
}
