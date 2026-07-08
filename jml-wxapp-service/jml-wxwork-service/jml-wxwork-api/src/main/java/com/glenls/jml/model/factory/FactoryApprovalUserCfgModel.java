package com.glenls.jml.model.factory;

import com.glenls.commons.jboot.plugins.sqlxml.plugin.activerecord.DbXmlModel4Jboot;
import com.jfinal.plugin.activerecord.IBean;
import io.jboot.db.annotation.Table;


@Table(tableName = "jml_factory_approval_user_cfg",primaryKey = "id")
public class FactoryApprovalUserCfgModel extends DbXmlModel4Jboot<FactoryApprovalUserCfgModel> implements IBean {


   public FactoryApprovalUserCfgModel queryApprovalStaffId(String approvalFRoleCode){
         return findFirstForXml("factoryApprovalUserCfg.queryApprovalStaffId",approvalFRoleCode);
   }
}
